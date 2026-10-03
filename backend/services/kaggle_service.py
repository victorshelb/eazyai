import base64
import zipfile
import json
from pathlib import Path
from typing import Dict, Any, List, Optional

import httpx

KAGGLE_DOWNLOADS = Path("kaggle_downloads")
CREDENTIALS_FILE = Path(".credentials.json")


def load_credentials() -> Optional[Dict[str, str]]:
    if not CREDENTIALS_FILE.exists():
        return None
    try:
        with open(CREDENTIALS_FILE) as f:
            return json.load(f)
    except Exception:
        return None


def save_credentials(username: str, api_key: str) -> None:
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump({"kaggle_username": username, "kaggle_key": api_key}, f)


def delete_credentials() -> None:
    if CREDENTIALS_FILE.exists():
        CREDENTIALS_FILE.unlink()


def _auth(username: str, api_key: str) -> str:
    return f"Basic {base64.b64encode(f'{username}:{api_key}'.encode()).decode()}"


async def verify_credentials(username: str, api_key: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://www.kaggle.com/api/v1/datasets/list",
                headers={"Authorization": _auth(username, api_key)},
                params={"page": 1, "pageSize": 1},
            )
            return resp.status_code == 200
    except Exception:
        return False


def _check_kaggle_verification(resp_text: str) -> None:
    """Raise a helpful error if Kaggle is asking for email verification."""
    low = resp_text.lower()
    if "verification code" in low or "verify your email" in low or "confirm your email" in low:
        raise PermissionError(
            "Kaggle sent a verification email to your inbox. "
            "Open that email, visit kaggle.com to enter the code, then try again. "
            "This is a one-time step for new API tokens."
        )


_KAGGLE_NSFW = ("porn", "nsfw", "xxx", "adult", "hentai", "erotic", "nude", "explicit")


def _kaggle_is_nsfw(blob: str) -> bool:
    low = blob.lower()
    return any(term in low for term in _KAGGLE_NSFW)


async def search_kaggle_datasets(query: str, username: str, api_key: str, limit: int = 20, page: int = 1) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://www.kaggle.com/api/v1/datasets/list",
            headers={"Authorization": _auth(username, api_key)},
            params={"search": query, "sortBy": "hotness", "page": page, "pageSize": limit},
        )
        if resp.status_code == 401:
            _check_kaggle_verification(resp.text)
            raise PermissionError("Invalid Kaggle credentials.")
        resp.raise_for_status()
        _check_kaggle_verification(resp.text)
        data = resp.json()

    from services.hf_search import quality_score

    return [
        {
            "id": f"kaggle:{ds['ownerRef']}/{ds['datasetSlug']}",
            "description": (ds.get("subtitle") or ds.get("description") or "No description available.")[:200],
            "downloads": ds.get("downloadCount", 0),
            "likes": ds.get("voteCount", 0),
            "tags": [t["name"] for t in (ds.get("tags") or [])[:3]],
            "source": "kaggle",
            "kaggle_ref": f"{ds['ownerRef']}/{ds['datasetSlug']}",
            "quality": quality_score(ds.get("downloadCount", 0), ds.get("voteCount", 0), bool(ds.get("subtitle") or ds.get("description"))),
        }
        for ds in data
        if ds.get("ownerRef") and ds.get("datasetSlug")
        and not _kaggle_is_nsfw(f"{ds.get('title', '')} {ds.get('subtitle', '')} {ds.get('datasetSlug', '')}")
    ]


def download_kaggle_dataset_sync(kaggle_ref: str, username: str, api_key: str) -> Path:
    safe_name = kaggle_ref.replace("/", "__")
    out_dir = KAGGLE_DOWNLOADS / safe_name

    if out_dir.exists() and any(out_dir.iterdir()):
        return out_dir

    out_dir.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=180.0, follow_redirects=True) as client:
        resp = client.get(
            f"https://www.kaggle.com/api/v1/datasets/{kaggle_ref}/download",
            headers={"Authorization": _auth(username, api_key)},
        )
        if resp.status_code == 401:
            _check_kaggle_verification(resp.text)
            raise PermissionError("Invalid Kaggle credentials.")
        _check_kaggle_verification(resp.text)
        resp.raise_for_status()

    zip_path = out_dir / "download.zip"
    with open(zip_path, "wb") as f:
        f.write(resp.content)

    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(out_dir)

    zip_path.unlink()
    return out_dir


def get_kaggle_csv_columns(dir_path: Path) -> List[Dict[str, str]]:
    import pandas as pd

    csv_files = sorted(dir_path.rglob("*.csv"), key=lambda p: p.stat().st_size, reverse=True)
    if not csv_files:
        raise ValueError("No CSV files found in the Kaggle dataset download.")

    df = pd.read_csv(csv_files[0], nrows=0)
    return [{"name": col, "type": "text"} for col in df.columns]


def load_kaggle_csv_as_dataset(dir_path: Path, text_column: str, label_column: str):
    import pandas as pd
    from datasets import Dataset

    csv_files = sorted(dir_path.rglob("*.csv"), key=lambda p: p.stat().st_size, reverse=True)
    if not csv_files:
        raise ValueError("No CSV files found in the Kaggle dataset download.")

    df = pd.read_csv(csv_files[0])

    missing = [c for c in [text_column, label_column] if c not in df.columns]
    if missing:
        raise ValueError(f"Columns not found in CSV: {missing}. Available: {list(df.columns)}")

    df = df[[text_column, label_column]].dropna()
    df[text_column] = df[text_column].astype(str)
    df[label_column] = df[label_column].astype(str)

    return Dataset.from_pandas(df, preserve_index=False)
