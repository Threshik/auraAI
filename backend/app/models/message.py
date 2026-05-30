from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from sqlalchemy.orm import relationship

from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)

    role = Column(String, nullable=False)

    content = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id"),
    )

    file_name = Column(String(255), nullable=True)
    file_media_type = Column(String(100), nullable=True)
    file_base64 = Column(Text, nullable=True)

    conversation = relationship(
        "Conversation",
        back_populates="messages",
    )