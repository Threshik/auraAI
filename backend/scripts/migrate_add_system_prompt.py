"""
One-time migration: add system_prompt column to conversations table.
Run from the backend/ directory with the venv active:
    python scripts/migrate_add_system_prompt.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(
        text(
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS system_prompt TEXT"
        )
    )
    conn.commit()

print("Migration complete: conversations.system_prompt column added.")
