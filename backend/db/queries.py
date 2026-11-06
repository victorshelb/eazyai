import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from db.database import get_conn


# ── Users ──────────────────────────────────────────────────────────────────

def create_user(email: str, username: str, password_hash: str) -> Dict[str, Any]:
    conn = get_conn()
    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO users (id, email, username, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (user_id, email.lower(), username, password_hash, now, now),
    )
    conn.commit()
    conn.close()
    return {"id": user_id, "email": email.lower(), "username": username, "created_at": now}


def get_user_by_email(email: str) -> Optional[Dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_username(username: str) -> Optional[Dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_user(user_id: str, **fields: Any) -> None:
    fields["updated_at"] = datetime.utcnow().isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    conn = get_conn()
    conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", [*fields.values(), user_id])
    conn.commit()
    conn.close()


# ── API keys ───────────────────────────────────────────────────────────────

def create_api_key(user_id: str, name: str, key_hash: str, key_preview: str) -> Dict[str, Any]:
    conn = get_conn()
    key_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO api_keys (id, user_id, name, key_hash, key_preview, created_at) VALUES (?,?,?,?,?,?)",
        (key_id, user_id, name, key_hash, key_preview, now),
    )
    conn.commit()
    conn.close()
    return {"id": key_id, "name": name, "key_preview": key_preview, "created_at": now}


def get_api_keys(user_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_api_key(key_id: str, user_id: str) -> bool:
    conn = get_conn()
    result = conn.execute("DELETE FROM api_keys WHERE id = ? AND user_id = ?", (key_id, user_id))
    conn.commit()
    conn.close()
    return result.rowcount > 0
