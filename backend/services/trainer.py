import os
import uuid
import zipfile
import shutil
import json
import multiprocessing
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

MODELS_DIR = Path("trained_models")
MODELS_DIR.mkdir(exist_ok=True)
HISTORY_FILE = MODELS_DIR / "history.json"

# Web-process-side registry of live training processes (job_id -> Process).
# Lost on server reload; cooperative cancellation via the status file covers that case.
_procs: Dict[str, "multiprocessing.Process"] = {}


# ── File-based job status (shared between web process and training process) ──

def _status_path(job_id: str) -> Path:
    return MODELS_DIR / job_id / "status.json"


def _read_status(job_id: str) -> Optional[Dict[str, Any]]:
    p = _status_path(job_id)
    if not p.exists():
        return None
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return None


def _write_status(job_id: str, data: Dict[str, Any]) -> None:
    p = _status_path(job_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, p)  # atomic swap — readers never see a torn file


def _update(job_id: str, **kwargs: Any) -> None:
    data = _read_status(job_id) or {}
    data.update(kwargs)
    _write_status(job_id, data)


def create_job() -> str:
    job_id = str(uuid.uuid4())
    _write_status(job_id, {
        "status": "pending", "progress": 0, "message": "Job queued...",
        "results": None, "download_url": None, "cancel_requested": False,
    })
    return job_id


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    return _read_status(job_id)


def start_training_process(job_id: str, config: Dict[str, Any]) -> None:
    """Run training in a SEPARATE process so the web server stays responsive."""
    ctx = multiprocessing.get_context("spawn")
    proc = ctx.Process(target=run_training_job, args=(job_id, config), daemon=False)
    proc.start()
    _procs[job_id] = proc


def request_cancel(job_id: str) -> bool:
    data = _read_status(job_id)
    if data is None or data.get("status") not in ("pending", "running"):
        return False

    # Cooperative flag (works even after a server reload).
    data["cancel_requested"] = True
    data["message"] = "Cancelling..."
    _write_status(job_id, data)

    # Hard stop if we still hold the process handle.
    proc = _procs.get(job_id)
    if proc is not None and proc.is_alive():
        proc.terminate()
        proc.join(timeout=8)
        _cleanup_job_files(job_id)
        _write_status(job_id, {
            "status": "cancelled", "progress": 0, "message": "Training cancelled.",
            "results": None, "download_url": None, "cancel_requested": True,
        })
        _procs.pop(job_id, None)
    return True


def is_cancelled(job_id: str) -> bool:
    data = _read_status(job_id)
    return bool(data and data.get("cancel_requested"))


class _CancelledError(Exception):
    """Raised internally when a user cancels a training job."""


def get_history() -> List[Dict[str, Any]]:
    if not HISTORY_FILE.exists():
        return []
    try:
        with open(HISTORY_FILE) as f:
            return json.load(f)
    except Exception:
        return []


def _append_history(job_id: str, config: dict, results: dict) -> None:
    entry = {
        "job_id": job_id,
        "user_id": config.get("user_id"),
        "dataset_id": config["dataset_id"],
        "task_type": config.get("task_type", "text"),
        "model_name": config["model_name"],
        "preset": config["preset"],
        "accuracy": results["accuracy"],
        "f1_score": results["f1_score"],
        "train_samples": results.get("train_samples", 0),
        "completed_at": results.get("completed_at", datetime.now().isoformat()),
        "download_url": f"/api/training/download/{job_id}",
    }
    history = get_history()
    history = [entry] + history[:49]
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


def _zip_model(job_id: str, model_dir: Path, output_dir: Path, config: dict, results: dict) -> None:
    from services.inference import get_inference_script, build_readme, build_metrics_txt
    task_type = config.get("task_type", "text")

    zip_path = MODELS_DIR / f"{job_id}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in model_dir.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(output_dir))
        zf.writestr("inference.py", get_inference_script(task_type))
        zf.writestr("README.md", build_readme(results, config))
        zf.writestr("metrics.txt", build_metrics_txt(results, config))
        zf.writestr("training_report.json", json.dumps(results, indent=2))

    ckpt = output_dir / "checkpoints"
    if ckpt.exists():
        shutil.rmtree(ckpt)


def run_training_job(job_id: str, config: Dict[str, Any]) -> None:
    try:
        if config.get("task_type") == "image":
            _run_image_training(job_id, config)
        else:
            _run_text_training(job_id, config)
    except _CancelledError:
        print(f"[trainer] {job_id} cancelled by user.")
        _cleanup_job_files(job_id)
        _update(job_id, status="cancelled", progress=0, message="Training cancelled.")
    except Exception as exc:
        import traceback
        print(f"[trainer] {job_id} failed:\n{traceback.format_exc()}")
        _update(job_id, status="failed", progress=0, message=f"Training failed: {_friendly_error(str(exc))}")


def _friendly_error(msg: str) -> str:
    low = msg.lower()
    if "429" in msg or "too many requests" in low or "rate limit" in low:
        return "HuggingFace is rate-limiting requests right now. Please wait a minute and try again."
    if "trust_remote_code" in low:
        return "This dataset needs custom loading code that we don't run for safety. Please pick a different dataset."
    return msg


def _cleanup_job_files(job_id: str) -> None:
    out_dir = MODELS_DIR / job_id
    if out_dir.exists():
        shutil.rmtree(out_dir, ignore_errors=True)


def _checkpoint_cancel(job_id: str) -> None:
    """Raise if the user requested cancellation. Call at safe points."""
    if is_cancelled(job_id):
        raise _CancelledError()


def _make_cancel_callback(job_id: str):
    from transformers import TrainerCallback

    class _CancelCb(TrainerCallback):
        def on_step_end(self, args, state, control, **kwargs):
            if is_cancelled(job_id):
                control.should_training_stop = True
            return control

    return _CancelCb()


def _load_hf_or_kaggle(config: dict, max_samples: int = 10000):
    dataset_id = config["dataset_id"]

    # "upload:" (and legacy "file:") = user-uploaded CSV in the uploads/ folder.
    if dataset_id.startswith("upload:") or dataset_id.startswith("file:"):
        filename = dataset_id.split(":", 1)[1]
        file_path = Path("uploads") / filename
        if not file_path.exists():
            raise ValueError(f"Uploaded file not found: {filename}. Please re-upload and try again.")
        import pandas as pd
        from datasets import Dataset
        sep = "\t" if filename.endswith(".tsv") else ","
        df = pd.read_csv(file_path, sep=sep)
        missing = [c for c in [config["text_column"], config["label_column"]] if c not in df.columns]
        if missing:
            raise ValueError(f"Columns not found in file: {missing}. Available: {list(df.columns)}")
        df[config["text_column"]] = df[config["text_column"]].astype(str)
        df[config["label_column"]] = df[config["label_column"]].astype(str)
        return Dataset.from_pandas(df[[config["text_column"], config["label_column"]]], preserve_index=False)

    if dataset_id.startswith("kaggle:"):
        kaggle_ref = dataset_id[7:]
        from services.kaggle_service import load_credentials, download_kaggle_dataset_sync, load_kaggle_csv_as_dataset
        creds = load_credentials()
        if not creds:
            raise ValueError("Kaggle credentials not configured. Go to Settings to add them.")
        dl_dir = download_kaggle_dataset_sync(kaggle_ref, creds["kaggle_username"], creds["kaggle_key"])
        return load_kaggle_csv_as_dataset(dl_dir, config["text_column"], config["label_column"])

    # Only pull up to max_samples rows so huge datasets don't take forever / blow up memory.
    # smart_load_hf also handles multi-config datasets and non-'train' splits.
    cap = max(200, int(max_samples))
    from services.hf_search import smart_load_hf
    dataset, _configs, _sel, _split = smart_load_hf(dataset_id, config.get("config_name"), max_rows=cap)
    return dataset


# ── Text classification ────────────────────────────────────────────────────

def _run_text_training(job_id: str, config: dict) -> None:
    _update(job_id, status="running", progress=5, message="Loading dataset...")

    from datasets import ClassLabel
    from transformers import (
        AutoTokenizer, AutoModelForSequenceClassification,
        TrainingArguments, Trainer, TrainerCallback,
    )
    import numpy as np
    from sklearn.metrics import accuracy_score, f1_score

    max_samples = config.get("max_samples", 10000)
    dataset = _load_hf_or_kaggle(config, max_samples)
    _checkpoint_cancel(job_id)
    if len(dataset) > max_samples:
        dataset = dataset.select(range(max_samples))

    _update(job_id, progress=15, message="Splitting dataset...")
    split = dataset.train_test_split(test_size=config["test_size"], seed=42)
    train_ds, test_ds = split["train"], split["test"]

    text_col = config["text_column"]
    label_col = config["label_column"]
    label_feat = train_ds.features.get(label_col)

    if isinstance(label_feat, ClassLabel):
        num_labels = label_feat.num_classes
        id2label = {i: n for i, n in enumerate(label_feat.names)}
        label2id = {n: i for i, n in enumerate(label_feat.names)}
        needs_enc = False
    else:
        unique = sorted(set(str(x) for x in train_ds[label_col]))
        num_labels = len(unique)
        label2id = {l: i for i, l in enumerate(unique)}
        id2label = {i: l for i, l in enumerate(unique)}
        needs_enc = True

    if num_labels > 100:
        raise ValueError(
            f"This dataset has {num_labels} distinct labels, which is too many for quick training "
            f"(and usually means the label column is wrong — e.g. an ID or free-text column). "
            f"Pick a column with fewer categories, or choose a different label column."
        )
    if num_labels < 2:
        raise ValueError("The label column needs at least 2 distinct categories to train a classifier.")

    _update(job_id, progress=25, message="Loading model and tokenizer...")
    model_name = config["model_name"]
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name, num_labels=num_labels, id2label=id2label,
        label2id=label2id, ignore_mismatched_sizes=True,
    )

    _update(job_id, progress=35, message="Tokenizing data...")

    def tokenize(examples):
        texts = [str(t) if t is not None else "" for t in examples[text_col]]
        return tokenizer(texts, padding="max_length", truncation=True, max_length=128)

    drop = [c for c in train_ds.column_names if c != label_col]
    tok_train = train_ds.map(tokenize, batched=True, remove_columns=drop)
    tok_test = test_ds.map(tokenize, batched=True, remove_columns=drop)

    if needs_enc:
        if label_col == "labels":
            def enc(ex): return {"labels": label2id[str(ex["labels"])]}
            tok_train = tok_train.map(enc)
            tok_test = tok_test.map(enc)
        else:
            def enc(ex): return {"labels": label2id[str(ex[label_col])]}
            tok_train = tok_train.map(enc, remove_columns=[label_col])
            tok_test = tok_test.map(enc, remove_columns=[label_col])
    elif label_col != "labels":
        tok_train = tok_train.rename_column(label_col, "labels")
        tok_test = tok_test.rename_column(label_col, "labels")

    tok_train.set_format("torch")
    tok_test.set_format("torch")

    num_epochs = config["num_epochs"]
    output_dir = MODELS_DIR / job_id
    _update(job_id, progress=45, message=f"Training started — epoch 0/{num_epochs}")

    class _Cb(TrainerCallback):
        def on_epoch_end(self, args, state, control, **kwargs):
            e = int(state.epoch)
            _update(job_id, progress=45 + int((e / num_epochs) * 40), message=f"Training... epoch {e}/{num_epochs}")

    args = TrainingArguments(
        output_dir=str(output_dir / "checkpoints"),
        num_train_epochs=num_epochs,
        per_device_train_batch_size=config["batch_size"],
        per_device_eval_batch_size=config["batch_size"],
        learning_rate=config["learning_rate"],
        eval_strategy="epoch", save_strategy="epoch",
        load_best_model_at_end=True, logging_steps=20,
        report_to="none", fp16=False,
    )

    def metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=-1)
        return {"accuracy": accuracy_score(labels, preds), "f1": f1_score(labels, preds, average="weighted", zero_division=0)}

    trainer = Trainer(model=model, args=args, train_dataset=tok_train, eval_dataset=tok_test, compute_metrics=metrics, callbacks=[_Cb(), _make_cancel_callback(job_id)])
    trainer.train()
    _checkpoint_cancel(job_id)

    _update(job_id, progress=87, message="Evaluating model and computing metrics...")
    from sklearn.metrics import classification_report, confusion_matrix as sk_cm
    pred_output = trainer.predict(tok_test)
    preds_all = np.argmax(pred_output.predictions, axis=-1)
    labels_all = pred_output.label_ids
    label_names = [id2label[i] for i in range(num_labels)]
    class_report = classification_report(labels_all, preds_all, target_names=label_names, output_dict=True, zero_division=0)
    conf_matrix = sk_cm(labels_all, preds_all).tolist()
    per_class = {k: {m: round(v, 4) for m, v in vals.items()} for k, vals in class_report.items() if k not in ("accuracy", "macro avg", "weighted avg")}
    eval_accuracy = float(class_report.get("accuracy", 0))
    eval_f1 = class_report.get("weighted avg", {}).get("f1-score", 0)
    eval_precision = class_report.get("weighted avg", {}).get("precision", 0)
    eval_recall = class_report.get("weighted avg", {}).get("recall", 0)

    _update(job_id, progress=92, message="Saving model...")
    final_dir = output_dir / "final_model"
    trainer.save_model(str(final_dir))
    tokenizer.save_pretrained(str(final_dir))
    with open(final_dir / "labels.json", "w") as f:
        json.dump({"id2label": id2label, "label2id": label2id}, f, indent=2)

    results = {
        "accuracy": round(eval_accuracy * 100, 2),
        "f1_score": round(eval_f1, 4),
        "precision": round(eval_precision, 4),
        "recall": round(eval_recall, 4),
        "num_labels": num_labels, "labels": label_names,
        "train_samples": len(train_ds), "test_samples": len(test_ds),
        "model_name": model_name, "dataset_id": config["dataset_id"], "task_type": "text",
        "per_class_metrics": per_class,
        "confusion_matrix": conf_matrix,
        "training_config": {
            "num_epochs": config["num_epochs"], "batch_size": config["batch_size"],
            "learning_rate": config["learning_rate"], "test_size": config["test_size"],
            "max_samples": config.get("max_samples", 10000),
        },
        "completed_at": datetime.now().isoformat(),
        "preset": config.get("preset", ""),
    }
    with open(output_dir / "results.json", "w") as f:
        json.dump({**results, "job_id": job_id}, f, indent=2)

    _update(job_id, progress=96, message="Packaging model and generating code...")
    _zip_model(job_id, final_dir, output_dir, config, results)

    _append_history(job_id, config, results)
    _update(job_id, status="completed", progress=100, message="Training complete!", results=results, download_url=f"/api/training/download/{job_id}")


# ── Image classification ───────────────────────────────────────────────────

def _run_image_training(job_id: str, config: dict) -> None:
    _update(job_id, status="running", progress=5, message="Loading image dataset...")

    from datasets import load_dataset, ClassLabel
    from transformers import (
        AutoImageProcessor, AutoModelForImageClassification,
        TrainingArguments, Trainer, TrainerCallback, DefaultDataCollator,
    )
    from PIL import Image as PILImage
    import io
    import numpy as np
    from sklearn.metrics import accuracy_score, f1_score

    max_samples = config.get("max_samples", 5000)
    cap = max(200, int(max_samples))
    from services.hf_search import smart_load_hf
    dataset, _configs, _sel, _split = smart_load_hf(config["dataset_id"], config.get("config_name"), max_rows=cap)
    _checkpoint_cancel(job_id)
    if len(dataset) > max_samples:
        dataset = dataset.select(range(max_samples))

    _update(job_id, progress=15, message="Splitting dataset...")
    split = dataset.train_test_split(test_size=config["test_size"], seed=42)
    train_ds, test_ds = split["train"], split["test"]

    image_col = config["text_column"]
    label_col = config["label_column"]
    label_feat = train_ds.features.get(label_col)

    if isinstance(label_feat, ClassLabel):
        num_labels = label_feat.num_classes
        id2label = {i: n for i, n in enumerate(label_feat.names)}
        label2id = {n: i for i, n in enumerate(label_feat.names)}
        needs_enc = False
    else:
        unique = sorted(set(str(x) for x in train_ds[label_col]))
        num_labels = len(unique)
        label2id = {l: i for i, l in enumerate(unique)}
        id2label = {i: l for i, l in enumerate(unique)}
        needs_enc = True

    if num_labels > 100:
        raise ValueError(
            f"This dataset has {num_labels} distinct labels, which is too many for quick training "
            f"(and usually means the label column is wrong). Pick a column with fewer categories."
        )
    if num_labels < 2:
        raise ValueError("The label column needs at least 2 distinct categories to train a classifier.")

    _update(job_id, progress=25, message="Loading image model and processor...")
    model_name = config["model_name"]
    processor = AutoImageProcessor.from_pretrained(model_name)
    model = AutoModelForImageClassification.from_pretrained(
        model_name, num_labels=num_labels, id2label=id2label,
        label2id=label2id, ignore_mismatched_sizes=True,
    )

    size_info = getattr(processor, "size", {})
    size = size_info.get("shortest_edge", size_info.get("height", 224)) if isinstance(size_info, dict) else 224

    from torchvision.transforms import Compose, Normalize, RandomHorizontalFlip, RandomResizedCrop, Resize, CenterCrop, ToTensor
    img_mean = getattr(processor, "image_mean", [0.485, 0.456, 0.406])
    img_std = getattr(processor, "image_std", [0.229, 0.224, 0.225])
    norm = Normalize(mean=img_mean, std=img_std)
    train_tf = Compose([RandomResizedCrop(size), RandomHorizontalFlip(), ToTensor(), norm])
    test_tf = Compose([Resize(size), CenterCrop(size), ToTensor(), norm])

    def to_rgb(img):
        if isinstance(img, PILImage.Image):
            return img.convert("RGB")
        if isinstance(img, dict) and "bytes" in img:
            return PILImage.open(io.BytesIO(img["bytes"])).convert("RGB")
        return PILImage.fromarray(img).convert("RGB")

    _update(job_id, progress=35, message="Preprocessing images...")
    drop = [c for c in train_ds.column_names if c != label_col]

    def pre_train(ex): ex["pixel_values"] = [train_tf(to_rgb(i)) for i in ex[image_col]]; return ex
    def pre_test(ex): ex["pixel_values"] = [test_tf(to_rgb(i)) for i in ex[image_col]]; return ex

    train_ds = train_ds.map(pre_train, batched=True, remove_columns=drop)
    test_ds = test_ds.map(pre_test, batched=True, remove_columns=drop)

    if needs_enc:
        if label_col == "labels":
            def enc(ex): return {"labels": label2id[str(ex["labels"])]}
            train_ds = train_ds.map(enc)
            test_ds = test_ds.map(enc)
        else:
            def enc(ex): return {"labels": label2id[str(ex[label_col])]}
            train_ds = train_ds.map(enc, remove_columns=[label_col])
            test_ds = test_ds.map(enc, remove_columns=[label_col])
    elif label_col != "labels":
        train_ds = train_ds.rename_column(label_col, "labels")
        test_ds = test_ds.rename_column(label_col, "labels")

    train_ds.set_format("torch")
    test_ds.set_format("torch")

    num_epochs = config["num_epochs"]
    output_dir = MODELS_DIR / job_id
    _update(job_id, progress=45, message=f"Image training started — epoch 0/{num_epochs}")

    class _Cb(TrainerCallback):
        def on_epoch_end(self, args, state, control, **kwargs):
            e = int(state.epoch)
            _update(job_id, progress=45 + int((e / num_epochs) * 40), message=f"Training... epoch {e}/{num_epochs}")

    args = TrainingArguments(
        output_dir=str(output_dir / "checkpoints"),
        num_train_epochs=num_epochs,
        per_device_train_batch_size=config["batch_size"],
        per_device_eval_batch_size=config["batch_size"],
        learning_rate=config["learning_rate"],
        eval_strategy="epoch", save_strategy="epoch",
        load_best_model_at_end=True, logging_steps=20,
        report_to="none", fp16=False, remove_unused_columns=False,
    )

    def metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=-1)
        return {"accuracy": accuracy_score(labels, preds), "f1": f1_score(labels, preds, average="weighted", zero_division=0)}

    trainer = Trainer(
        model=model, args=args, train_dataset=train_ds, eval_dataset=test_ds,
        compute_metrics=metrics, callbacks=[_Cb(), _make_cancel_callback(job_id)], data_collator=DefaultDataCollator(),
    )
    trainer.train()
    _checkpoint_cancel(job_id)

    _update(job_id, progress=87, message="Evaluating model and computing metrics...")
    from sklearn.metrics import classification_report, confusion_matrix as sk_cm
    pred_output = trainer.predict(test_ds)
    preds_all = np.argmax(pred_output.predictions, axis=-1)
    labels_all = pred_output.label_ids
    label_names = [id2label[i] for i in range(num_labels)]
    class_report = classification_report(labels_all, preds_all, target_names=label_names, output_dict=True, zero_division=0)
    conf_matrix = sk_cm(labels_all, preds_all).tolist()
    per_class = {k: {m: round(v, 4) for m, v in vals.items()} for k, vals in class_report.items() if k not in ("accuracy", "macro avg", "weighted avg")}
    eval_accuracy = float(class_report.get("accuracy", 0))
    eval_f1 = class_report.get("weighted avg", {}).get("f1-score", 0)
    eval_precision = class_report.get("weighted avg", {}).get("precision", 0)
    eval_recall = class_report.get("weighted avg", {}).get("recall", 0)

    _update(job_id, progress=92, message="Saving model...")
    final_dir = output_dir / "final_model"
    trainer.save_model(str(final_dir))
    processor.save_pretrained(str(final_dir))
    with open(final_dir / "labels.json", "w") as f:
        json.dump({"id2label": id2label, "label2id": label2id}, f, indent=2)

    results = {
        "accuracy": round(eval_accuracy * 100, 2),
        "f1_score": round(eval_f1, 4),
        "precision": round(eval_precision, 4),
        "recall": round(eval_recall, 4),
        "num_labels": num_labels, "labels": label_names,
        "train_samples": len(train_ds), "test_samples": len(test_ds),
        "model_name": model_name, "dataset_id": config["dataset_id"], "task_type": "image",
        "per_class_metrics": per_class,
        "confusion_matrix": conf_matrix,
        "training_config": {
            "num_epochs": config["num_epochs"], "batch_size": config["batch_size"],
            "learning_rate": config["learning_rate"], "test_size": config["test_size"],
            "max_samples": config.get("max_samples", 5000),
        },
        "completed_at": datetime.now().isoformat(),
        "preset": config.get("preset", ""),
    }
    with open(output_dir / "results.json", "w") as f:
        json.dump({**results, "job_id": job_id}, f, indent=2)

    _update(job_id, progress=96, message="Packaging model and generating code...")
    _zip_model(job_id, final_dir, output_dir, config, results)

    _append_history(job_id, config, results)
    _update(job_id, status="completed", progress=100, message="Training complete!", results=results, download_url=f"/api/training/download/{job_id}")
