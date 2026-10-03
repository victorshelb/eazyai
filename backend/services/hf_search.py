import math
import httpx
from typing import List, Dict, Any, Optional


def quality_score(downloads: int, likes: int, has_description: bool) -> float:
    """A 1.0–5.0 quality rating. Weighs community approval (likes) and
    popularity (downloads) on a log scale, plus a small bonus for being
    documented. Bigger isn't always better — a well-liked smaller dataset
    can outrank a huge undocumented one."""
    popularity = min(math.log10(max(downloads, 0) + 1) / 6.0, 1.0)   # ~1M downloads → 1.0
    approval = min(math.log10(max(likes, 0) + 1) / 3.0, 1.0)         # ~1k likes → 1.0
    documented = 1.0 if has_description else 0.0
    raw = 0.40 * popularity + 0.45 * approval + 0.15 * documented    # 0..1
    return round(1.0 + raw * 4.0, 1)                                  # 1.0..5.0

_POPULAR_TEXT = [
    {"id": "imdb", "description": "50k movie reviews labeled positive or negative. Great for sentiment analysis.", "downloads": 1200000, "likes": 450, "tags": ["text-classification", "sentiment"], "source": "huggingface"},
    {"id": "ag_news", "description": "120k news articles in 4 categories: World, Sports, Business, Sci/Tech.", "downloads": 980000, "likes": 320, "tags": ["text-classification", "news"], "source": "huggingface"},
    {"id": "sms_spam", "description": "SMS messages labeled as spam or ham. Perfect for spam detection.", "downloads": 560000, "likes": 180, "tags": ["text-classification", "spam-detection"], "source": "huggingface"},
    {"id": "dair-ai/emotion", "description": "Twitter messages labeled with 6 emotions: sadness, joy, love, anger, fear, surprise.", "downloads": 890000, "likes": 290, "tags": ["text-classification", "emotion"], "source": "huggingface"},
]

_POPULAR_IMAGE = [
    {"id": "cifar10", "description": "60k 32×32 images in 10 classes: airplane, car, bird, cat, deer, dog, frog, horse, ship, truck.", "downloads": 2100000, "likes": 580, "tags": ["image-classification", "computer-vision"], "source": "huggingface"},
    {"id": "food101", "description": "101 food categories with 1,000 images each. Great for fine-grained image classification.", "downloads": 890000, "likes": 310, "tags": ["image-classification", "food"], "source": "huggingface"},
    {"id": "beans", "description": "Bean plant disease detection: angular_leaf_spot, bean_rust, or healthy.", "downloads": 340000, "likes": 120, "tags": ["image-classification", "agriculture"], "source": "huggingface"},
    {"id": "cats_vs_dogs", "description": "Binary classification: cats vs dogs. 25k images. Classic computer vision benchmark.", "downloads": 670000, "likes": 245, "tags": ["image-classification", "animals"], "source": "huggingface"},
]

# Strip these noisy tag prefixes; keep the human-readable part.
_TAG_PREFIXES = (
    "task_categories:", "task_ids:", "format:", "region:", "modality:",
    "size_categories:", "language:", "language_creators:", "annotations_creators:",
    "license:", "arxiv:", "doi:", "source_datasets:", "multilinguality:",
    "pretty_name:", "config_name:",
)

_NSFW_TERMS = ("porn", "nsfw", "xxx", "adult", "hentai", "erotic", "nude", "explicit")


def _is_nsfw(text_blob: str) -> bool:
    low = text_blob.lower()
    return any(term in low for term in _NSFW_TERMS)


def _clean_tags(raw_tags: List[str]) -> List[str]:
    cleaned: List[str] = []
    for t in raw_tags:
        label = t
        for prefix in _TAG_PREFIXES:
            if t.startswith(prefix):
                label = t[len(prefix):]
                break
        else:
            # Skip opaque/irrelevant tags that have no readable prefix match
            if ":" in t or t in ("croissant",):
                continue
        label = label.strip().replace("_", " ")
        if label and label not in cleaned:
            cleaned.append(label)
    return cleaned[:3]


def get_popular_datasets(task_type: str = "text") -> List[Dict[str, Any]]:
    base = _POPULAR_IMAGE if task_type == "image" else _POPULAR_TEXT
    out = []
    for ds in base:
        out.append({**ds, "quality": quality_score(ds["downloads"], ds["likes"], True)})
    return out


async def search_hf_datasets(query: str, task_type: str = "text", limit: int = 12, offset: int = 0) -> List[Dict[str, Any]]:
    task_filter = "task_categories:image-classification" if task_type == "image" else "task_categories:text-classification"
    url = "https://huggingface.co/api/datasets"
    # HF list endpoint has no offset param, so over-fetch and slice for pagination.
    fetch_count = offset + limit + 4
    params = {"search": query, "sort": "downloads", "direction": -1, "limit": fetch_count, "full": "true", "filter": task_filter}

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        results = []
        for ds in data:
            ds_id = ds.get("id", "")
            description = (ds.get("description") or "No description available.")[:200]
            if _is_nsfw(f"{ds_id} {description}"):
                continue
            results.append({
                "id": ds_id,
                "description": description,
                "downloads": ds.get("downloads", 0),
                "likes": ds.get("likes", 0),
                "tags": _clean_tags(ds.get("tags") or []),
                "source": "huggingface",
                "quality": quality_score(ds.get("downloads", 0), ds.get("likes", 0), bool(ds.get("description"))),
            })
        return results[offset:offset + limit]
    except Exception:
        return []


def smart_load_hf(dataset_id: str, config_name: Optional[str] = None, max_rows: int = 5):
    """Load up to max_rows from an HF dataset, auto-handling two common pitfalls:
      1. Datasets that ship multiple configs (subsets) — pick one.
      2. Datasets whose split isn't called 'train' (e.g. only 'test'/'validation').
    Returns (dataset, configs_list, selected_config, split_name)."""
    from datasets import load_dataset, get_dataset_config_names, get_dataset_split_names

    try:
        configs = get_dataset_config_names(dataset_id, trust_remote_code=False)
    except Exception:
        configs = []
    multi = len(configs) > 1
    chosen = config_name or (configs[0] if multi else None)
    args = (dataset_id, chosen) if chosen else (dataset_id,)

    try:
        splits = get_dataset_split_names(*args, trust_remote_code=False)
    except Exception:
        splits = []
    split = "train" if (not splits or "train" in splits) else splits[0]

    try:
        dataset = load_dataset(*args, split=f"{split}[:{max_rows}]", trust_remote_code=False)
    except Exception:
        dataset = load_dataset(*args, split=split, trust_remote_code=False)

    return dataset, (configs if multi else []), (chosen if multi else None), split


async def get_dataset_columns(dataset_id: str, config_name: Optional[str] = None) -> Dict[str, Any]:
    from datasets import ClassLabel, Value

    dataset, configs, selected, _split = smart_load_hf(dataset_id, config_name, max_rows=5)

    columns = []
    for name, feature in dataset.features.items():
        if isinstance(feature, ClassLabel):
            col_type = "label"
        elif isinstance(feature, Value) and feature.dtype == "string":
            col_type = "text"
        elif isinstance(feature, Value):
            col_type = "number"
        else:
            col_type = "other"
        columns.append({"name": name, "type": col_type})

    return {
        "columns": columns,
        "configs": configs,
        "selected_config": selected,
    }
