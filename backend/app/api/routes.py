from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.database import SessionLocal
from app.models.message import Message
from app.schemas.chat import ChatRequest, MessageResponse, ConversationResponse, ConversationUpdate, ShareResponse, SharedConversationResponse
from app.services.openai_service import stream_response, generate_title
from app.models.conversation import Conversation
from app.core.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])
public_router = APIRouter()


@router.get("/hello")
async def hello():
    return {"message": "Hello from FastAPI backend"}


@router.get("/azure-devops/status")
async def azure_devops_status():
    """Returns whether Azure DevOps integration is configured."""
    from app.services.azure_devops import is_configured
    from app.core.config import AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT
    configured = is_configured()
    return {
        "configured": configured,
        "org": AZURE_DEVOPS_ORG if configured else None,
        "default_project": AZURE_DEVOPS_PROJECT if configured else None,
    }


@router.get("/azure-devops/projects")
async def azure_devops_projects():
    """Returns all projects in the Azure DevOps organisation."""
    from app.services.azure_devops import is_configured, list_projects
    if not is_configured():
        return []
    try:
        return await list_projects()
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/azure-devops/pipelines")
async def azure_devops_pipelines(project: str | None = None):
    """Returns pipeline definitions with their latest run result."""
    from app.services.azure_devops import is_configured, list_pipelines, get_pipeline_runs
    from fastapi import HTTPException
    if not is_configured():
        return []
    try:
        pipelines = await list_pipelines(project=project)
        runs = await get_pipeline_runs(top=100, project=project)
        # Build map: pipeline_id → most-recent run (runs come back newest-first)
        latest: dict[int, dict] = {}
        for r in runs:
            pid = r["pipeline_id"]
            if pid not in latest:
                latest[pid] = r
        return [{**p, "last_run": latest.get(p["id"])} for p in pipelines]
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/auth/login")
async def auth_login(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.user import UserActivityLog
    log = UserActivityLog(
        user_id=current_user["sub"],
        action="login",
        timestamp=datetime.utcnow()
    )
    db.add(log)
    db.commit()
    return {"status": "success", "username": current_user.get("preferred_username")}


@router.post("/auth/logout")
async def auth_logout(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.user import UserActivityLog
    log = UserActivityLog(
        user_id=current_user["sub"],
        action="logout",
        timestamp=datetime.utcnow()
    )
    db.add(log)
    db.commit()
    return {"status": "success"}


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
async def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from fastapi import HTTPException
    conversation = db.get(Conversation, conversation_id)
    if not conversation or (conversation.user_id is not None and conversation.user_id != current_user["sub"]):
        raise HTTPException(status_code=404, detail="Conversation not found")

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
    current_user: dict = Depends(get_current_user),
):
    conversation = Conversation(
        title="New Chat",
        user_id=current_user["sub"],
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
    current_user: dict = Depends(get_current_user),
):
    conversations = (
        db.query(Conversation)
        .filter((Conversation.user_id == current_user["sub"]) | (Conversation.user_id == None))
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
    current_user: dict = Depends(get_current_user),
):
    from fastapi import HTTPException
    conversation = db.get(Conversation, conversation_id)
    if not conversation or (conversation.user_id is not None and conversation.user_id != current_user["sub"]):
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
    current_user: dict = Depends(get_current_user),
):
    from fastapi import HTTPException
    conversation = db.get(Conversation, conversation_id)
    if not conversation or (conversation.user_id is not None and conversation.user_id != current_user["sub"]):
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
    current_user: dict = Depends(get_current_user),
):
    """Delete a message and all subsequent messages in the conversation."""
    from fastapi import HTTPException

    conversation = db.get(Conversation, conversation_id)
    if not conversation or (conversation.user_id is not None and conversation.user_id != current_user["sub"]):
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
    current_user: dict = Depends(get_current_user),
):
    from fastapi import HTTPException
    conversation = db.get(Conversation, request.conversation_id)
    if not conversation or (conversation.user_id is not None and conversation.user_id != current_user["sub"]):
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message first
    user_message = Message(
        role="user",
        content=request.message,
        conversation_id=request.conversation_id,
        file_name=request.file_name,
        file_media_type=request.file_media_type,
        file_base64=request.file_base64,
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
    message_dicts = [
        {
            "role": m.role,
            "content": m.content,
            "file_name": m.file_name,
            "file_media_type": m.file_media_type,
            "file_base64": m.file_base64,
        }
        for m in history
    ]

    # Pick up system prompt and check if this is the first exchange
    system_prompt = (conversation.system_prompt or "") if conversation else ""
    is_first_message = len(history) == 1  # only the user msg we just saved


    async def event_generator():
        full_response = ""

        async for chunk in stream_response(
            message_dicts, system_prompt,
            file_base64=request.file_base64,
            file_media_type=request.file_media_type,
            file_name=request.file_name,
            active_project=request.active_project,
        ):
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


@router.post("/conversations/{conversation_id}/share", response_model=ShareResponse)
async def share_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    import uuid
    from fastapi import HTTPException
    conversation = db.get(Conversation, conversation_id)
    if not conversation or (conversation.user_id is not None and conversation.user_id != current_user["sub"]):
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not conversation.share_token:
        conversation.share_token = uuid.uuid4().hex
    conversation.is_shared = True
    db.commit()
    db.refresh(conversation)

    from app.core.config import FRONTEND_URL
    share_url = f"{FRONTEND_URL.rstrip('/')}/share/{conversation.share_token}"
    return {
        "is_shared": conversation.is_shared,
        "share_token": conversation.share_token,
        "share_url": share_url
    }


@router.delete("/conversations/{conversation_id}/share", response_model=ShareResponse)
async def unshare_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from fastapi import HTTPException
    conversation = db.get(Conversation, conversation_id)
    if not conversation or (conversation.user_id is not None and conversation.user_id != current_user["sub"]):
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation.is_shared = False
    conversation.share_token = None
    db.commit()
    db.refresh(conversation)
    return {
        "is_shared": conversation.is_shared,
        "share_token": None,
        "share_url": None
    }


@public_router.get("/shared/{share_token}", response_model=SharedConversationResponse)
async def get_shared_conversation(share_token: str, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    conversation = db.query(Conversation).filter(
        Conversation.share_token == share_token,
        Conversation.is_shared == True
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Shared conversation not found")
    return conversation


@public_router.get("/shared/{share_token}/messages", response_model=list[MessageResponse])
async def get_shared_messages(share_token: str, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    conversation = db.query(Conversation).filter(
        Conversation.share_token == share_token,
        Conversation.is_shared == True
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Shared conversation not found")

    messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.id).all()
    return messages