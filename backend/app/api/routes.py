from fastapi import APIRouter
from app.services.openai_service import generate_response

from app.schemas.chat import ChatRequest

router = APIRouter()


@router.get("/hello")
async def hello():
    return {"message": "Hello from FastAPI backend"}


@router.post("/chat")
async def chat(request: ChatRequest):
    response = await generate_response(request.message)

    return {
        "response": response
    }