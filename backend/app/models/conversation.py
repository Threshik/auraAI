from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=True)
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    is_shared = Column(Boolean, default=False, nullable=False)
    share_token = Column(String(100), unique=True, nullable=True, index=True)

    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="conversations")

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )