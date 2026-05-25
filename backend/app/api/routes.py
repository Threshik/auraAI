from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.database import SessionLocal
from app.models.message import Message
from app.schemas.chat import ChatRequest, MessageResponse, ConversationResponse, ConversationUpdate
from app.services.openai_service import stream_response, generate_title
from app.models.conversation import Conversation

router = APIRouter()


@router.get("/hello")
async def hello():
    return {"message": "Hello from FastAPI backend"}

@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
async def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
):

    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).all()

    return messages

@router.post(
    "/conversations",
    response_model=ConversationResponse,
)
async def create_conversation(
    db: Session = Depends(get_db),
):

    conversation = Conversation(
        title="New Chat",
    )

    db.add(conversation)

    db.commit()

    db.refresh(conversation)

    return conversation


@router.get(
    "/conversations",
    response_model=list[ConversationResponse],
)
async def get_conversations(
    db: Session = Depends(get_db),
):

    conversations = (
        db.query(Conversation)
        .order_by(Conversation.updated_at.desc())
        .all()
    )

    return conversations


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
)
async def rename_conversation(
    conversation_id: int,
    body: ConversationUpdate,
    db: Session = Depends(get_db),
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Conversation not found")
    if body.title is not None:
        conversation.title = body.title
    if body.system_prompt is not None:
        # Empty string clears the override
        conversation.system_prompt = body.system_prompt if body.system_prompt.strip() else None
    conversation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conversation)
    db.commit()


@router.delete(
    "/conversations/{conversation_id}/messages/from/{message_id}",
    status_code=204,
)
async def delete_messages_from(
    conversation_id: int,
    message_id: int,
    db: Session = Depends(get_db),
):
    """Delete a message and all subsequent messages in the conversation."""
    from fastapi import HTTPException

    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.id >= message_id,
    ).delete()

    conversation.updated_at = datetime.utcnow()
    db.commit()

@router.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
):
    # Save user message first
    user_message = Message(
        role="user",
        content=request.message,
        conversation_id=request.conversation_id,
    )
    db.add(user_message)
    db.commit()

    # Load full conversation history (including the message just saved)
    history = (
        db.query(Message)
        .filter(Message.conversation_id == request.conversation_id)
        .order_by(Message.id)
        .all()
    )
    message_dicts = [{"role": m.role, "content": m.content} for m in history]

    # Pick up system prompt and check if this is the first exchange
    conversation = db.get(Conversation, request.conversation_id)
    system_prompt = (conversation.system_prompt or "") if conversation else ""
    is_first_message = len(history) == 1  # only the user msg we just saved

    async def event_generator():
        full_response = ""

        async for chunk in stream_response(message_dicts, system_prompt):
            full_response += chunk
            yield chunk

        # Use a new session — the dependency session closes after chat() returns
        session = SessionLocal()
        try:
            assistant_message = Message(
                role="assistant",
                content=full_response,
                conversation_id=request.conversation_id,
            )
            session.add(assistant_message)

            # Bump conversation updated_at so sidebar sorts correctly
            conv = session.get(Conversation, request.conversation_id)
            if conv:
                conv.updated_at = datetime.utcnow()

                # Auto-generate title after the very first exchange
                if is_first_message:
                    title = await generate_title(request.message)
                    conv.title = title

            session.commit()
        finally:
            session.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
    )