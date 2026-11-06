import os
import uuid
import hashlib
import io
import base64
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt
import pyotp
import qrcode

SECRET_KEY = os.getenv("JWT_SECRET", "eazyai-dev-secret-change-before-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days — keeps users signed in across sessions


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user_id: str, username: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "username": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None


def generate_mfa_secret() -> str:
    return pyotp.random_base32()


def get_mfa_qr_code(username: str, secret: str) -> str:
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=username, issuer_name="EazyAI")
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def generate_api_key() -> tuple:
    random_part = uuid.uuid4().hex + uuid.uuid4().hex
    full_key = f"ezai_sk_{random_part[:32]}"
    preview = full_key[:16] + "..."
    return full_key, preview


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()
