from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: int
    file_base64: Optional[str] = None
    file_media_type: str = "application/octet-stream"
    file_name: Optional[str] = None
    active_project: Optional[str] = None  # Azure DevOps project selected in UI


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    system_prompt: Optional[str] = None


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: Optional[datetime] = None
    file_name: Optional[str] = None
    file_media_type: Optional[str] = None
    file_base64: Optional[str] = None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    title: str
    system_prompt: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_shared: bool = False
    share_token: Optional[str] = None

    class Config:
        from_attributes = True


class ShareResponse(BaseModel):
    is_shared: bool
    share_token: Optional[str] = None
    share_url: Optional[str] = None


class SharedConversationResponse(BaseModel):
    id: int
    title: str
    system_prompt: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True