"""
One-time migration: add created_at to messages and updated_at to conversations.
Run from the backend/ directory with the venv active:
    python scripts/migrate_add_timestamps.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    for sql, backfill in [
        (
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
            "UPDATE messages SET created_at = NOW() WHERE created_at IS NULL",
        ),
        (
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
            "UPDATE conversations SET updated_at = NOW() WHERE updated_at IS NULL",
        ),
    ]:
        conn.execute(text(sql))
        conn.execute(text(backfill))
        conn.commit()

print("Migration complete: messages.created_at and conversations.updated_at added.")

