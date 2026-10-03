from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from routes.auth import get_current_user
from services.auth_service import (
    hash_password, verify_password,
    generate_mfa_secret, get_mfa_qr_code, verify_totp,
    generate_api_key, hash_api_key,
)
from db.queries import update_user, create_api_key, get_api_keys, delete_api_key, get_user_by_email, get_user_by_username

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None


class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class VerifyCodeRequest(BaseModel):
    code: str


class CreateApiKeyRequest(BaseModel):
    name: str


@router.put("/profile")
async def update_profile(body: UpdateProfileRequest, current_user=Depends(get_current_user)):
    updates = {}
    if body.username and body.username != current_user["username"]:
        if get_user_by_username(body.username):
            raise HTTPException(status_code=400, detail="That username is already taken.")
        updates["username"] = body.username
    if body.email and body.email.lower() != current_user["email"]:
        if get_user_by_email(body.email):
            raise HTTPException(status_code=400, detail="That email is already in use.")
        updates["email"] = body.email.lower()
    if updates:
        update_user(current_user["id"], **updates)
    return {"success": True}


@router.put("/password")
async def update_password(body: UpdatePasswordRequest, current_user=Depends(get_current_user)):
    if not verify_password(body.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    update_user(current_user["id"], password_hash=hash_password(body.new_password))
    return {"success": True}


@router.post("/mfa/setup")
async def setup_mfa(current_user=Depends(get_current_user)):
    secret = generate_mfa_secret()
    qr_code = get_mfa_qr_code(current_user["username"], secret)
    update_user(current_user["id"], mfa_secret=secret)
    return {"qr_code": qr_code}


@router.post("/mfa/enable")
async def enable_mfa(body: VerifyCodeRequest, current_user=Depends(get_current_user)):
    if not current_user.get("mfa_secret"):
        raise HTTPException(status_code=400, detail="Start MFA setup first.")
    if not verify_totp(current_user["mfa_secret"], body.code):
        raise HTTPException(status_code=400, detail="Invalid code. Check your authenticator app and try again.")
    update_user(current_user["id"], mfa_enabled=1)
    return {"mfa_enabled": True}


@router.post("/mfa/disable")
async def disable_mfa(body: VerifyCodeRequest, current_user=Depends(get_current_user)):
    if not verify_totp(current_user["mfa_secret"], body.code):
        raise HTTPException(status_code=400, detail="Invalid code.")
    update_user(current_user["id"], mfa_enabled=0, mfa_secret=None)
    return {"mfa_enabled": False}


@router.get("/api-keys")
async def list_api_keys(current_user=Depends(get_current_user)):
    return get_api_keys(current_user["id"])


@router.post("/api-keys")
async def create_new_api_key(body: CreateApiKeyRequest, current_user=Depends(get_current_user)):
    full_key, preview = generate_api_key()
    entry = create_api_key(current_user["id"], body.name, hash_api_key(full_key), preview)
    return {**entry, "key": full_key}


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, current_user=Depends(get_current_user)):
    if not delete_api_key(key_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="API key not found.")
    return {"success": True}


@router.delete("/account")
async def delete_account(body: VerifyCodeRequest, current_user=Depends(get_current_user)):
    """Delete account — body.code must be the user's current password for confirmation."""
    if not verify_password(body.code, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password is incorrect. Account not deleted.")
    from db.database import get_conn
    conn = get_conn()
    conn.execute("DELETE FROM api_keys WHERE user_id = ?", (current_user["id"],))
    conn.execute("DELETE FROM users WHERE id = ?", (current_user["id"],))
    conn.commit()
    conn.close()
    return {"success": True}
