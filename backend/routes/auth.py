from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

from services.auth_service import (
    hash_password, verify_password, create_access_token,
    verify_token, verify_totp,
)
from db.queries import create_user, get_user_by_email, get_user_by_id, get_user_by_username

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    user = get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    if not credentials:
        return None
    payload = verify_token(credentials.credentials)
    if not payload:
        return None
    return get_user_by_id(payload["sub"])


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None


@router.post("/register")
async def register(body: RegisterRequest):
    if get_user_by_email(body.email):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    if get_user_by_username(body.username):
        raise HTTPException(status_code=400, detail="That username is already taken.")

    user = create_user(body.email, body.username, hash_password(body.password))
    token = create_access_token(user["id"], user["username"])
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "username": user["username"], "mfa_enabled": False},
    }


@router.post("/login")
async def login(body: LoginRequest):
    user = get_user_by_email(body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if user["mfa_enabled"]:
        if not body.mfa_code:
            return {"mfa_required": True, "token": None}
        if not verify_totp(user["mfa_secret"], body.mfa_code):
            raise HTTPException(status_code=401, detail="Invalid MFA code. Please try again.")

    token = create_access_token(user["id"], user["username"])
    return {
        "token": token,
        "mfa_required": False,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "mfa_enabled": bool(user["mfa_enabled"]),
        },
    }


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "username": current_user["username"],
        "mfa_enabled": bool(current_user["mfa_enabled"]),
        "created_at": current_user["created_at"],
    }
