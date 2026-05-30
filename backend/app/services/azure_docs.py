"""
Microsoft Learn documentation search client.

Queries the public Microsoft Learn search API to surface official Azure
documentation links and descriptions for any resource or topic.

This is intentionally kept lightweight — no API key required.
The results are fed back to the LLM so it can quote accurate doc references
instead of hallucinating URLs.
"""

import httpx

_LEARN_SEARCH_URL = "https://learn.microsoft.com/api/search"


async def search_azure_docs(query: str, top: int = 5) -> list[dict]:
    """
    Search Microsoft Learn for Azure documentation.

    Returns a list of {title, url, description} dicts (up to `top` results).
    On failure returns a single-item list with an 'error' key so the LLM
    can handle it gracefully rather than crashing the tool call.
    """
    params = {
        "search": query,
        "locale": "en-us",
        "$top": str(min(top, 4)),   # keep payload small
        "$filter": "category eq 'Documentation'",
        "facet": "category",
    }
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(_LEARN_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        return [
            {
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "description": item.get("description", ""),
            }
            for item in data.get("results", [])[:top]
            if item.get("url")
        ]
    except Exception as exc:
        return [{"error": f"Microsoft Learn search failed: {exc}"}]
