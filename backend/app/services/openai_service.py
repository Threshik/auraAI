"""
OpenAI service for a generic AI chat assistant.
"""

import base64
from typing import Any, Optional, AsyncGenerator

from openai import AsyncAzureOpenAI

from app.core.config import (
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT,
)

client = AsyncAzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version=AZURE_OPENAI_API_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
)

_DEFAULT_SYSTEM = (
    "You are Aura AI, a helpful, friendly, and knowledgeable AI assistant. "
    "Provide clear, accurate, and concise answers to the user's questions on any topic."
)


def _build_api_messages(
    messages: list[dict[str, Any]],
    file_base64: Optional[str] = None,
    file_media_type: Optional[str] = None,
    file_name: Optional[str] = None,
) -> list[dict]:
    """Convert message history to OpenAI format, injecting optional file context."""
    import io
    import pypdf

    api_messages = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]

        # Check for attachment fields in the message dictionary
        m_file_base64 = msg.get("file_base64")
        m_file_media_type = msg.get("file_media_type")
        m_file_name = msg.get("file_name")

        # Fallback to arguments for the last user message if not already set in the history dictionary
        if not m_file_base64 and role == "user" and (messages and msg is messages[-1]):
            m_file_base64 = file_base64
            m_file_media_type = file_media_type
            m_file_name = file_name

        if m_file_base64:
            media_type = m_file_media_type or "application/octet-stream"
            name = m_file_name or "uploaded-file"

            if media_type.startswith("image/"):
                api_messages.append({
                    "role": role,
                    "content": [
                        {"type": "text", "text": content},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{m_file_base64}",
                                "detail": "high",
                            },
                        },
                    ],
                })
            elif media_type == "application/pdf" or name.lower().endswith(".pdf"):
                payload = content
                try:
                    raw = base64.b64decode(m_file_base64, validate=False)
                    size = len(raw)
                    pdf_file = io.BytesIO(raw)
                    reader = pypdf.PdfReader(pdf_file)
                    text_content = ""
                    for page in reader.pages:
                        text_content += page.extract_text() or ""
                    
                    truncated = text_content[:15000]
                    if len(text_content) > 15000:
                        truncated += "\n\n[truncated for context window]"
                    payload = (
                        f"{payload}\n\n"
                        f"Attached file: {name} (application/pdf, {size} bytes)\n"
                        f"Use this parsed PDF content as additional context:\n"
                        f"```\n{truncated}\n```"
                    )
                except Exception as e:
                    payload = (
                        f"{payload}\n\n"
                        f"Attached PDF file: {name} but failed to parse: {str(e)}"
                    )
                api_messages.append({"role": role, "content": payload})
            else:
                payload = content
                try:
                    raw = base64.b64decode(m_file_base64, validate=False)
                    size = len(raw)
                    # Try to decode as UTF-8 text for common document/code formats.
                    decoded = raw.decode("utf-8")
                    truncated = decoded[:12000]
                    if len(decoded) > 12000:
                        truncated += "\n\n[truncated for context window]"
                    payload = (
                        f"{payload}\n\n"
                        f"Attached file: {name} ({media_type}, {size} bytes)\n"
                        f"Use this file content as additional context:\n"
                        f"```\n{truncated}\n```"
                    )
                except Exception:
                    payload = (
                        f"{payload}\n\n"
                        f"Attached file: {name} ({media_type}). "
                        "This file appears to be binary; ask the user for a text-based export "
                        "if detailed inspection is required."
                    )
                api_messages.append({"role": role, "content": payload})
        else:
            api_messages.append({"role": role, "content": content})

    return api_messages



async def stream_response(
    messages: list[dict[str, Any]],
    system_prompt: str = _DEFAULT_SYSTEM,
    file_base64: Optional[str] = None,
    file_media_type: str = "application/octet-stream",
    file_name: Optional[str] = None,
    active_project: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    api_messages = _build_api_messages(messages, file_base64, file_media_type, file_name)
    base_system = system_prompt or _DEFAULT_SYSTEM

    system_msg = {"role": "system", "content": base_system}
    all_messages = [system_msg] + api_messages

    call_kwargs: dict[str, Any] = {
        "model": AZURE_OPENAI_DEPLOYMENT,
        "messages": all_messages,
        "stream": True,
        "max_tokens": 1200,
    }

    stream = await client.chat.completions.create(**call_kwargs)

    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def generate_title(first_message: str) -> str:
    """Ask the model to produce a short conversation title."""
    response = await client.chat.completions.create(
        model=AZURE_OPENAI_DEPLOYMENT,
        messages=[
            {
                "role": "system",
                "content": (
                    "Generate a short, descriptive title (3–6 words) for a conversation "
                    "that starts with the user message below. "
                    "Reply with only the title — no punctuation, no quotes."
                ),
            },
            {"role": "user", "content": first_message},
        ],
        stream=False,
        max_tokens=20,
    )
    return response.choices[0].message.content.strip()
