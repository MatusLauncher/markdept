from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.oauth_token import OAuthToken
from app.services.crypto import decrypt, encrypt

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_TOKEN_URL = "https://api.anthropic.com/oauth/token"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-sonnet-4-6"


async def _get_valid_token(user_id: int, db: AsyncSession) -> str:
    result = await db.execute(
        select(OAuthToken).where(
            OAuthToken.user_id == user_id, OAuthToken.provider == "anthropic"
        )
    )
    token = result.scalar_one_or_none()
    if not token:
        raise ValueError("No Anthropic OAuth token found for user")

    # Refresh if expired (with 60s buffer)
    now = datetime.now(timezone.utc)
    if token.expires_at and token.expires_at.replace(tzinfo=timezone.utc) < now:
        if not token.refresh_token_encrypted:
            raise ValueError("Anthropic token expired and no refresh token available")
        await _refresh_token(token, db)

    return decrypt(token.access_token_encrypted)


async def _refresh_token(token: OAuthToken, db: AsyncSession) -> None:
    from app.config import settings

    refresh_token = decrypt(token.refresh_token_encrypted)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            ANTHROPIC_TOKEN_URL,
            json={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": settings.ANTHROPIC_CLIENT_ID,
                "client_secret": settings.ANTHROPIC_CLIENT_SECRET,
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

    from datetime import timedelta

    token.access_token_encrypted = encrypt(data["access_token"])
    if data.get("refresh_token"):
        token.refresh_token_encrypted = encrypt(data["refresh_token"])
    if data.get("expires_in"):
        token.expires_at = datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"])
    await db.commit()


async def generate(
    user_id: int,
    messages: list[dict],
    system: str | None = None,
    max_tokens: int = 1024,
    db: AsyncSession | None = None,
) -> str:
    close_db = db is None
    if db is None:
        db = AsyncSessionLocal()

    try:
        access_token = await _get_valid_token(user_id, db)
    finally:
        if close_db:
            await db.close()

    payload: dict[str, Any] = {
        "model": DEFAULT_MODEL,
        "max_tokens": max_tokens,
        "messages": messages,
    }

    if system:
        # Use prompt caching on the stable system prompt
        payload["system"] = [
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ]

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            ANTHROPIC_API_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "anthropic-version": ANTHROPIC_VERSION,
                "anthropic-beta": "prompt-caching-2024-07-31",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    return data["content"][0]["text"]
