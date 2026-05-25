from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: int


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    system_prompt: Optional[str] = None


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    title: str
    system_prompt: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True