from typing import Any

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

_DEFAULT_SYSTEM = "You are a helpful AI assistant."


async def stream_response(
    messages: list[dict[str, Any]],
    system_prompt: str = _DEFAULT_SYSTEM,
):
    response = await client.chat.completions.create(
        model=AZURE_OPENAI_DEPLOYMENT,
        messages=[{"role": "system", "content": system_prompt or _DEFAULT_SYSTEM}]
        + messages,
        stream=True,
    )

    async for chunk in response:
        if chunk.choices:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


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
