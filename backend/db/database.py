import sqlite3
from pathlib import Path

DB_PATH = Path("eazyai.db")


def get_conn():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            email       TEXT UNIQUE NOT NULL,
            username    TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            mfa_enabled INTEGER DEFAULT 0,
            mfa_secret  TEXT
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            name        TEXT NOT NULL,
            key_hash    TEXT NOT NULL,
            key_preview TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            last_used_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()
