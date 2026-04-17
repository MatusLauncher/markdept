import hashlib
import os
import base64
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db, get_current_user, set_session
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.schemas.user import UserOut
from app.services.crypto import encrypt

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_pkce() -> tuple[str, str]:
    code_verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


@router.get("/login")
async def login(request: Request):
    code_verifier, code_challenge = _generate_pkce()
    state = base64.urlsafe_b64encode(os.urandom(16)).rstrip(b"=").decode()

    # Store PKCE data in a temporary cookie (short-lived)
    response = RedirectResponse(
        url=(
            f"{settings.ANTHROPIC_AUTH_URL}"
            f"?response_type=code"
            f"&client_id={settings.ANTHROPIC_CLIENT_ID}"
            f"&redirect_uri={settings.ANTHROPIC_REDIRECT_URI}"
            f"&scope={settings.ANTHROPIC_SCOPE}"
            f"&code_challenge={code_challenge}"
            f"&code_challenge_method=S256"
            f"&state={state}"
        )
    )
    response.set_cookie("pkce_verifier", code_verifier, max_age=600, httponly=True, samesite="lax")
    response.set_cookie("oauth_state", state, max_age=600, httponly=True, samesite="lax")
    return response


@router.get("/callback")
async def callback(
    request: Request,
    code: str,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stored_state = request.cookies.get("oauth_state")
    if state and stored_state and state != stored_state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state")

    code_verifier = request.cookies.get("pkce_verifier")
    if not code_verifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing PKCE verifier")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            settings.ANTHROPIC_TOKEN_URL,
            json={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.ANTHROPIC_REDIRECT_URI,
                "client_id": settings.ANTHROPIC_CLIENT_ID,
                "client_secret": settings.ANTHROPIC_CLIENT_SECRET,
                "code_verifier": code_verifier,
            },
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Token exchange failed: {resp.text}",
            )
        token_data: dict[str, Any] = resp.json()

    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")
    expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=expires_in) if expires_in else None
    )

    # Fetch user info from Anthropic
    anthropic_user_id, email, display_name = await _fetch_anthropic_user(access_token)

    # Upsert user
    result = await db.execute(
        select(User).where(User.anthropic_user_id == anthropic_user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            anthropic_user_id=anthropic_user_id,
            email=email,
            display_name=display_name,
        )
        db.add(user)
        await db.flush()
    else:
        if email:
            user.email = email
        if display_name:
            user.display_name = display_name

    # Upsert OAuth token
    token_result = await db.execute(
        select(OAuthToken).where(
            OAuthToken.user_id == user.id, OAuthToken.provider == "anthropic"
        )
    )
    oauth_token = token_result.scalar_one_or_none()
    if oauth_token:
        oauth_token.access_token_encrypted = encrypt(access_token)
        oauth_token.refresh_token_encrypted = encrypt(refresh_token) if refresh_token else None
        oauth_token.expires_at = expires_at
        oauth_token.scope = token_data.get("scope")
    else:
        oauth_token = OAuthToken(
            user_id=user.id,
            provider="anthropic",
            access_token_encrypted=encrypt(access_token),
            refresh_token_encrypted=encrypt(refresh_token) if refresh_token else None,
            expires_at=expires_at,
            scope=token_data.get("scope"),
        )
        db.add(oauth_token)

    await db.commit()
    await db.refresh(user)

    session_token = set_session(None, user.id)
    response = RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)
    response.set_cookie("session", session_token, httponly=True, samesite="lax")
    response.delete_cookie("pkce_verifier")
    response.delete_cookie("oauth_state")
    return response


async def _fetch_anthropic_user(access_token: str) -> tuple[str, str | None, str | None]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.anthropic.com/v1/oauth/userinfo",
            headers={
                "Authorization": f"Bearer {access_token}",
                "anthropic-version": "2023-06-01",
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            return (
                data.get("sub", access_token[:32]),
                data.get("email"),
                data.get("name"),
            )
        # Fallback: use a hash of the token as the user ID
        return hashlib.sha256(access_token.encode()).hexdigest()[:32], None, None


@router.post("/logout")
async def logout():
    response = RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    response.delete_cookie("session")
    return response


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
