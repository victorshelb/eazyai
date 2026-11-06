from fastapi import APIRouter, HTTPException
from schemas.models import KaggleCredentials
from services.kaggle_service import (
    save_credentials, delete_credentials, load_credentials, verify_credentials
)

router = APIRouter()


@router.get("/kaggle/status")
async def kaggle_status():
    creds = load_credentials()
    if not creds:
        return {"connected": False}
    return {"connected": True, "username": creds["kaggle_username"]}


@router.post("/kaggle")
async def save_kaggle_credentials(body: KaggleCredentials):
    valid = await verify_credentials(body.username, body.api_key)
    if not valid:
        raise HTTPException(status_code=401, detail="Could not verify credentials with Kaggle. Check your username and API key.")
    save_credentials(body.username, body.api_key)
    return {"connected": True, "username": body.username}


@router.delete("/kaggle")
async def remove_kaggle_credentials():
    delete_credentials()
    return {"connected": False}
