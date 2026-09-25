"""
Tenure — User Authentication & Password Hashing Module
PBKDF2-HMAC-SHA256 salted password hashing for industrial security.
"""

import hashlib
import secrets
import uuid
import sqlite3
from pathlib import Path
from typing import Any
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from db.init_db import get_connection

HASH_ITERATIONS = 100_000


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Generates a secure PBKDF2 hash and salt."""
    if not salt:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        HASH_ITERATIONS,
    ).hex()
    return pw_hash, salt


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    """Verifies a password against the stored salt and hash."""
    computed_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(computed_hash, expected_hash)


def register_user(
    username: str,
    password: str,
    full_name: str,
    role: str = "Field Mechatronics Technician",
) -> dict[str, Any]:
    """Registers a new user in the SQLite database with password hashing."""
    username = username.strip().lower()
    full_name = full_name.strip()
    if not username or not password or not full_name:
        raise ValueError("Username, password, and full name are required.")

    pw_hash, salt = hash_password(password)
    user_id = f"user-{uuid.uuid4().hex[:8]}"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            raise ValueError(f"User with identifier '{username}' already exists.")

        cursor.execute(
            """
            INSERT INTO users (id, username, password_hash, salt, role, full_name)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, username, pw_hash, salt, role, full_name),
        )
        conn.commit()

    return {
        "id": user_id,
        "username": username,
        "full_name": full_name,
        "role": role,
        "is_new": True,
    }


def authenticate_user(username: str, password: str) -> dict[str, Any] | None:
    """Authenticates a user by username and password."""
    username = username.strip().lower()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash, salt, role, full_name FROM users WHERE username = ?",
            (username,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        user_id, uname, stored_hash, salt, role, full_name = row
        if verify_password(password, salt, stored_hash):
            return {
                "id": user_id,
                "username": uname,
                "full_name": full_name,
                "role": role,
            }
        return None
