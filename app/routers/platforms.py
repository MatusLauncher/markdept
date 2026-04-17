import json
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
from app.dependencies import get_current_user, get_db, get_session_user_id
from app.models.platform_account import PlatformAccount
from app.models.user import User
from app.schemas.platform import LemmyConnectRequest, MastodonConnectRequest, PlatformAccountOut
from app.services.crypto import decrypt, encrypt
from app.services.platforms.lemmy import LemmyClient
from app.services.platforms.linkedin import LinkedInClient
from app.services.platforms.youtube import YouTubeClient

router = APIRouter(prefix="/api/platforms", tags=["platforms"])

LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_REDIRECT_URI = "http://localhost:8000/api/platforms/linkedin/callback"

YOUTUBE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
YOUTUBE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YOUTUBE_SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly"


@router.get("", response_model=list[PlatformAccountOut])
async def list_platforms(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlatformAccount).where(PlatformAccount.user_id == user.id)
    )
    return result.scalars().all()


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_platform(
    account_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.id == account_id, PlatformAccount.user_id == user.id
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")
    await db.delete(account)
    await db.commit()


# ── Mastodon ──────────────────────────────────────────────────────────────────

@router.post("/mastodon/connect")
async def mastodon_connect(
    body: MastodonConnectRequest,
    request: Request,
    user: User = Depends(get_current_user),
):
    instance = body.instance_url.rstrip("/")
    # Register the app with this instance
    async with httpx.AsyncClient() as client:
        reg = await client.post(
            f"{instance}/api/v1/apps",
            json={
                "client_name": "Markdept",
                "redirect_uris": "http://localhost:8000/api/platforms/mastodon/callback",
                "scopes": "read write",
                "website": "http://localhost:8000",
            },
        )
        reg.raise_for_status()
        app_data = reg.json()

    client_id = app_data["client_id"]
    client_secret = app_data["client_secret"]
    state = base64.urlsafe_b64encode(os.urandom(16)).rstrip(b"=").decode()

    # Store temp data in a cookie
    temp = json.dumps(
        {"instance": instance, "client_id": client_id, "client_secret": client_secret, "state": state}
    )
    auth_url = (
        f"{instance}/oauth/authorize"
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri=http://localhost:8000/api/platforms/mastodon/callback"
        f"&scope=read+write"
        f"&state={state}"
    )
    response = JSONResponse({"auth_url": auth_url})
    response.set_cookie("mastodon_connect", temp, max_age=600, httponly=True, samesite="lax")
    return response


@router.get("/mastodon/callback")
async def mastodon_callback(
    request: Request,
    code: str,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    user_id = get_session_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    temp_raw = request.cookies.get("mastodon_connect")
    if not temp_raw:
        raise HTTPException(status_code=400, detail="Missing Mastodon connect session")
    temp = json.loads(temp_raw)
    instance = temp["instance"]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{instance}/oauth/token",
            json={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": temp["client_id"],
                "client_secret": temp["client_secret"],
                "redirect_uri": "http://localhost:8000/api/platforms/mastodon/callback",
                "scope": "read write",
            },
        )
        resp.raise_for_status()
        token_data = resp.json()
        access_token = token_data["access_token"]

        # Get account info
        me_resp = await client.get(
            f"{instance}/api/v1/accounts/verify_credentials",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        me_resp.raise_for_status()
        me = me_resp.json()

    account = PlatformAccount(
        user_id=user_id,
        platform="mastodon",
        account_name=f"@{me['username']}@{instance.replace('https://', '')}",
        account_id_on_platform=me["id"],
        instance_url=instance,
        access_token_encrypted=encrypt(access_token),
    )
    db.add(account)
    await db.commit()

    response = RedirectResponse(url="/platforms")
    response.delete_cookie("mastodon_connect")
    return response


# ── LinkedIn ──────────────────────────────────────────────────────────────────

@router.post("/linkedin/connect")
async def linkedin_connect(user: User = Depends(get_current_user)):
    state = base64.urlsafe_b64encode(os.urandom(16)).rstrip(b"=").decode()
    auth_url = (
        f"{LINKEDIN_AUTH_URL}"
        f"?response_type=code"
        f"&client_id={settings.LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={LINKEDIN_REDIRECT_URI}"
        f"&scope=r_liteprofile%20r_emailaddress%20w_member_social"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/linkedin/connect")
async def linkedin_connect_get(user: User = Depends(get_current_user)):
    state = base64.urlsafe_b64encode(os.urandom(16)).rstrip(b"=").decode()
    auth_url = (
        f"{LINKEDIN_AUTH_URL}"
        f"?response_type=code"
        f"&client_id={settings.LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={LINKEDIN_REDIRECT_URI}"
        f"&scope=r_liteprofile%20r_emailaddress%20w_member_social"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/linkedin/callback")
async def linkedin_callback(
    request: Request,
    code: str,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    user_id = get_session_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            LINKEDIN_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": LINKEDIN_REDIRECT_URI,
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        token_data = resp.json()
        access_token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 5184000)

    li_client = LinkedInClient()
    urn = await li_client.get_profile_urn(access_token)
    account_name = urn.split(":")[-1]

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    account = PlatformAccount(
        user_id=user_id,
        platform="linkedin",
        account_name=account_name,
        account_id_on_platform=urn,
        access_token_encrypted=encrypt(access_token),
        token_expires_at=expires_at,
    )
    db.add(account)
    await db.commit()
    return RedirectResponse(url="/platforms")


# ── Lemmy ─────────────────────────────────────────────────────────────────────

@router.post("/lemmy/connect")
async def lemmy_connect(
    body: LemmyConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        jwt, account_name, extra = await LemmyClient.connect(
            body.instance_url, body.username, body.password
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Lemmy login failed: {e.response.text}")

    account = PlatformAccount(
        user_id=user.id,
        platform="lemmy",
        account_name=account_name,
        account_id_on_platform=extra.get("account_id", ""),
        instance_url=body.instance_url,
        access_token_encrypted=encrypt(jwt),
        extra_data_encrypted=encrypt(json.dumps(extra)),
    )
    db.add(account)
    await db.commit()
    return {"status": "connected", "account_name": account_name}


# ── YouTube ───────────────────────────────────────────────────────────────────

@router.get("/youtube/connect")
async def youtube_connect(user: User = Depends(get_current_user)):
    state = base64.urlsafe_b64encode(os.urandom(16)).rstrip(b"=").decode()
    auth_url = (
        f"{YOUTUBE_AUTH_URL}"
        f"?response_type=code"
        f"&client_id={settings.YOUTUBE_CLIENT_ID}"
        f"&redirect_uri={settings.YOUTUBE_REDIRECT_URI}"
        f"&scope={YOUTUBE_SCOPES.replace(' ', '%20')}"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.post("/youtube/connect")
async def youtube_connect_post(user: User = Depends(get_current_user)):
    return await youtube_connect(user)


@router.get("/youtube/callback")
async def youtube_callback(
    request: Request,
    code: str,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    user_id = get_session_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            YOUTUBE_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.YOUTUBE_REDIRECT_URI,
                "client_id": settings.YOUTUBE_CLIENT_ID,
                "client_secret": settings.YOUTUBE_CLIENT_SECRET,
            },
        )
        resp.raise_for_status()
        token_data = resp.json()
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

    yt_client = YouTubeClient()
    channel_id = await yt_client.get_channel_id(access_token)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    account = PlatformAccount(
        user_id=user_id,
        platform="youtube",
        account_name=channel_id or "YouTube Channel",
        account_id_on_platform=channel_id,
        access_token_encrypted=encrypt(access_token),
        refresh_token_encrypted=encrypt(refresh_token) if refresh_token else None,
        token_expires_at=expires_at,
    )
    db.add(account)
    await db.commit()
    return RedirectResponse(url="/platforms")
