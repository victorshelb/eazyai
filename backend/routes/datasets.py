import asyncio
import uuid
from pathlib import Path
from fastapi import APIRouter, Query, HTTPException, UploadFile, File
from services.hf_search import search_hf_datasets, get_popular_datasets, get_dataset_columns
from services.kaggle_service import (
    load_credentials, search_kaggle_datasets,
    download_kaggle_dataset_sync, get_kaggle_csv_columns,
)

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

router = APIRouter()


@router.get("/popular")
async def popular_datasets(task_type: str = "text"):
    return get_popular_datasets(task_type)


@router.get("/search")
async def search_datasets(q: str = Query(..., min_length=1), task_type: str = "text", page: int = 1):
    page = max(1, page)
    HF_PER_PAGE = 12
    KAGGLE_PER_PAGE = 20

    hf_results = await search_hf_datasets(q, task_type=task_type, limit=HF_PER_PAGE, offset=(page - 1) * HF_PER_PAGE)

    kaggle_results = []
    kaggle_available = False
    kaggle_error = None
    creds = load_credentials()
    if creds:
        try:
            kaggle_results = await search_kaggle_datasets(
                q, creds["kaggle_username"], creds["kaggle_key"],
                limit=KAGGLE_PER_PAGE, page=page,
            )
            kaggle_available = True
        except PermissionError as e:
            kaggle_error = str(e)
        except Exception:
            pass

    # Merge both sources and rank best-to-worst by quality score.
    combined = hf_results + kaggle_results
    combined.sort(key=lambda d: d.get("quality", 0), reverse=True)

    # More pages likely exist if either source filled its page this round
    has_more = len(hf_results) >= HF_PER_PAGE or len(kaggle_results) >= KAGGLE_PER_PAGE

    return {
        "results": combined,
        "kaggle_available": kaggle_available,
        "kaggle_error": kaggle_error,
        "has_more": has_more,
        "page": page,
    }


def _friendly_dataset_error(exc: Exception) -> str:
    msg = str(exc)
    low = msg.lower()
    if "429" in msg or "too many requests" in low or "rate limit" in low:
        return "HuggingFace is rate-limiting requests right now. Please wait a minute and try again."
    if "trust_remote_code" in low or "custom code" in low:
        return "This dataset needs custom loading code that we don't run for safety. Please pick a different dataset."
    if "couldn't find" in low or "doesn't exist" in low or "404" in msg:
        return "Couldn't load this dataset — it may be private, gated, or unavailable."
    return msg


@router.get("/columns/{dataset_id:path}")
async def dataset_columns(dataset_id: str, config: str = None):
    try:
        return await get_dataset_columns(dataset_id, config_name=config)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=_friendly_dataset_error(exc))


def _cell_to_display(value) -> str:
    """Turn any dataset cell into a short, JSON-safe preview string."""
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        s = str(value)
    elif isinstance(value, (list, dict)):
        s = str(value)
    else:
        # PIL images, arrays, etc. — don't try to serialise.
        return f"[{type(value).__name__}]"
    return s[:200] + ("…" if len(s) > 200 else "")


def _is_junk_column(name: str) -> bool:
    """Pandas/arrow index artifacts that aren't real data columns."""
    n = str(name)
    return n.startswith("__index_level") or n.startswith("Unnamed:") or n == "__index__"


def _rows_from_hf(dataset, max_rows: int = 8):
    cols = [c for c in dataset.features.keys() if not _is_junk_column(c)]
    n = min(len(dataset), max_rows)
    rows = [{c: _cell_to_display(dataset[i][c]) for c in cols} for i in range(n)]
    return cols, rows


def _rows_from_csv(file_path: Path, max_rows: int = 8):
    import pandas as pd
    sep = "\t" if str(file_path).endswith(".tsv") else ","
    df = pd.read_csv(file_path, sep=sep, nrows=max_rows)
    cols = [str(c) for c in df.columns if not _is_junk_column(c)]
    rows = [{c: _cell_to_display(rec[c]) for c in cols} for rec in df.to_dict("records")]
    return cols, rows


@router.get("/preview/{dataset_id:path}")
async def dataset_preview(dataset_id: str, config: str = None):
    """Return a handful of sample rows so users can see what's inside a dataset."""
    try:
        if dataset_id.startswith("upload:") or dataset_id.startswith("file:"):
            filename = dataset_id.split(":", 1)[1]
            cols, rows = _rows_from_csv(UPLOADS_DIR / filename)
            return {"columns": cols, "rows": rows, "configs": [], "selected_config": None}

        if dataset_id.startswith("kaggle:"):
            kaggle_ref = dataset_id.replace("kaggle:", "")
            creds = load_credentials()
            if not creds:
                raise HTTPException(status_code=401, detail="Connect Kaggle in Settings to preview its datasets.")
            dl_dir = await asyncio.get_event_loop().run_in_executor(
                None, download_kaggle_dataset_sync, kaggle_ref, creds["kaggle_username"], creds["kaggle_key"],
            )
            csv_files = sorted(dl_dir.rglob("*.csv"), key=lambda p: p.stat().st_size, reverse=True)
            if not csv_files:
                raise HTTPException(status_code=400, detail="This Kaggle dataset has no CSV file to preview.")
            cols, rows = _rows_from_csv(csv_files[0])
            return {"columns": cols, "rows": rows, "configs": [], "selected_config": None}

        # HuggingFace
        from services.hf_search import smart_load_hf
        dataset, configs, selected, _split = smart_load_hf(dataset_id, config, max_rows=8)
        cols, rows = _rows_from_hf(dataset)
        return {"columns": cols, "rows": rows, "configs": configs, "selected_config": selected}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=_friendly_dataset_error(exc))


@router.post("/kaggle-columns")
async def kaggle_columns(body: dict):
    kaggle_ref = body.get("ref", "")
    if not kaggle_ref:
        raise HTTPException(status_code=400, detail="Missing 'ref' field.")
    creds = load_credentials()
    if not creds:
        raise HTTPException(status_code=401, detail="Kaggle credentials not configured.")
    try:
        dl_dir = await asyncio.get_event_loop().run_in_executor(
            None, download_kaggle_dataset_sync,
            kaggle_ref, creds["kaggle_username"], creds["kaggle_key"],
        )
        columns = get_kaggle_csv_columns(dl_dir)
        return {"columns": columns}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    import pandas as pd

    if not (file.filename or "").endswith((".csv", ".tsv", ".txt")):
        raise HTTPException(status_code=400, detail="Only CSV/TSV files are supported.")

    upload_id = str(uuid.uuid4())[:12]
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in (file.filename or "upload.csv"))
    file_path = UPLOADS_DIR / f"{upload_id}_{safe_name}"

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    try:
        sep = "\t" if (file.filename or "").endswith(".tsv") else ","
        df = pd.read_csv(file_path, sep=sep, nrows=5)
        columns = [{"name": col, "type": "text"} for col in df.columns]
        row_count = sum(1 for _ in open(file_path)) - 1
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Could not read file: {exc}")

    return {
        "dataset_id": f"upload:{upload_id}_{safe_name}",
        "filename": file.filename,
        "row_count": row_count,
        "columns": columns,
    }
