"""LLM conversational agent (Claude / OpenAI API). Key read from .env."""
import httpx
from app.core.config import settings


async def reply(system_prompt: str, history: list[dict]) -> str:
    if not settings.LLM_API_KEY:
        return "I'm here with you. How has your week been going so far?"  # offline demo fallback
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": settings.LLM_API_KEY, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": settings.LLM_MODEL, "max_tokens": 400,
                  "system": system_prompt, "messages": history},
        )
        r.raise_for_status()
        return r.json()["content"][0]["text"]
