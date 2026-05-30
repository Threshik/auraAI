from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router, public_router
from app.core.config import APP_NAME, FRONTEND_URL
from app.core.telemetry import setup_phoenix

from app.core.database import engine, Base
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.user import User

# Initialize tables
Base.metadata.create_all(bind=engine)

# Programmatic database schema update (migration) for existing tables
from sqlalchemy import text
with engine.connect() as conn:
    try:
        res = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='conversations' AND column_name='user_id'"
        ))
        if not res.fetchone():
            conn.execute(text(
                "ALTER TABLE conversations ADD COLUMN user_id VARCHAR(255) "
                "REFERENCES users(id) ON DELETE CASCADE"
            ))
            conn.commit()
            print("Successfully migrated conversations table (added user_id column)")

        # Check and add is_shared to conversations
        res = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='conversations' AND column_name='is_shared'"
        ))
        if not res.fetchone():
            conn.execute(text("ALTER TABLE conversations ADD COLUMN is_shared BOOLEAN DEFAULT FALSE NOT NULL"))
            conn.commit()
            print("Successfully migrated conversations table (added is_shared column)")

        # Check and add share_token to conversations
        res = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='conversations' AND column_name='share_token'"
        ))
        if not res.fetchone():
            conn.execute(text("ALTER TABLE conversations ADD COLUMN share_token VARCHAR(100) UNIQUE"))
            conn.commit()
            print("Successfully migrated conversations table (added share_token column)")
    except Exception as e:
        print(f"Skipping programmatic schema migration: {e}")

    # Migrate messages table to add attachment columns
    with engine.connect() as conn:
        try:
            # Check and add file_name
            res = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='messages' AND column_name='file_name'"
            ))
            if not res.fetchone():
                conn.execute(text("ALTER TABLE messages ADD COLUMN file_name VARCHAR(255)"))
                conn.commit()
                print("Added file_name column to messages table")

            # Check and add file_media_type
            res = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='messages' AND column_name='file_media_type'"
            ))
            if not res.fetchone():
                conn.execute(text("ALTER TABLE messages ADD COLUMN file_media_type VARCHAR(100)"))
                conn.commit()
                print("Added file_media_type column to messages table")

            # Check and add file_base64
            res = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='messages' AND column_name='file_base64'"
            ))
            if not res.fetchone():
                conn.execute(text("ALTER TABLE messages ADD COLUMN file_base64 TEXT"))
                conn.commit()
                print("Added file_base64 column to messages table")
        except Exception as e:
            print(f"Skipping programmatic schema migration for messages: {e}")




@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_phoenix()
    yield


app = FastAPI(title=APP_NAME, lifespan=lifespan)

origins = [
    FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public_router)
app.include_router(router)