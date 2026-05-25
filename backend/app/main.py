from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import APP_NAME, FRONTEND_URL

from app.core.database import engine, Base
from app.models.message import Message
from app.models.conversation import Conversation

Base.metadata.create_all(bind=engine)

app = FastAPI(title=APP_NAME)

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

app.include_router(router)