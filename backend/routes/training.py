from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
from schemas.models import TrainingConfig
from services.trainer import create_job, get_job, get_history, request_cancel, start_training_process
from routes.auth import get_current_user, get_optional_user
import services.inference as inference_svc

router = APIRouter()
MODELS_DIR = Path("trained_models")


@router.post("/start")
async def start_training(
    config: TrainingConfig,
    current_user=Depends(get_current_user),
):
    job_id = create_job()
    config_dict = config.model_dump()
    config_dict["user_id"] = current_user["id"]
    # Runs in a separate OS process so heavy training never blocks the API server.
    start_training_process(job_id, config_dict)
    return {"job_id": job_id}


@router.get("/status/{job_id}")
async def training_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {**job, "job_id": job_id}


@router.post("/cancel/{job_id}")
async def cancel_training(job_id: str, current_user=Depends(get_current_user)):
    if not request_cancel(job_id):
        raise HTTPException(status_code=400, detail="Job is not running or already finished.")
    return {"success": True, "message": "Cancellation requested."}


@router.get("/history")
async def training_history(current_user=Depends(get_current_user)):
    all_history = get_history()
    return [h for h in all_history if h.get("user_id") == current_user["id"]]


@router.get("/results/{job_id}")
async def job_results(job_id: str):
    import json as _json
    results_path = MODELS_DIR / job_id / "results.json"
    if not results_path.exists():
        raise HTTPException(status_code=404, detail="Detailed results not found for this job.")
    with open(results_path) as f:
        return _json.load(f)


@router.post("/predict/{job_id}")
async def predict_text(job_id: str, body: dict):
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")
    try:
        return {"predictions": inference_svc.predict_text(job_id, text)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/predict-image/{job_id}")
async def predict_image(job_id: str, file: UploadFile = File(...)):
    try:
        return {"predictions": inference_svc.predict_image(job_id, await file.read())}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/download/{job_id}")
async def download_model(job_id: str):
    zip_path = MODELS_DIR / f"{job_id}.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Model file not found.")
    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=f"eazyai_model_{job_id[:8]}.zip",
    )
