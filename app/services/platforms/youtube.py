import json

import httpx

from app.models.platform_account import PlatformAccount
from app.models.post import Post
from app.services.crypto import decrypt
from app.services.platforms.base import BasePlatformClient

YOUTUBE_API = "https://www.googleapis.com/youtube/v3"
YOUTUBE_UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos"
YOUTUBE_ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports"


class YouTubeClient(BasePlatformClient):
    async def post(self, account: PlatformAccount, post: Post) -> str:
        token = await self._get_valid_token(account)

        if post.video_file_path:
            return await self._upload_video(account, post, token)
        else:
            return await self._community_post(account, post, token)

    async def _upload_video(self, account: PlatformAccount, post: Post, token: str) -> str:
        tags = json.loads(post.video_tags or "[]")
        metadata = {
            "snippet": {
                "title": post.video_title or post.content[:100],
                "description": post.content,
                "tags": tags,
                "categoryId": "22",
            },
            "status": {"privacyStatus": "public"},
        }

        # Resumable upload
        async with httpx.AsyncClient(timeout=300.0) as client:
            # Initiate upload
            init_resp = await client.post(
                f"{YOUTUBE_UPLOAD}?uploadType=resumable&part=snippet,status",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-Upload-Content-Type": "video/*",
                },
                json=metadata,
            )
            init_resp.raise_for_status()
            upload_url = init_resp.headers["Location"]

            # Upload file content
            with open(post.video_file_path, "rb") as f:
                video_data = f.read()

            upload_resp = await client.put(
                upload_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "video/*",
                },
                content=video_data,
            )
            upload_resp.raise_for_status()
            data = upload_resp.json()
            return data["id"]

    async def _community_post(self, account: PlatformAccount, post: Post, token: str) -> str:
        channel_id = account.account_id_on_platform
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{YOUTUBE_API}/commentThreads?part=snippet",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "snippet": {
                        "channelId": channel_id,
                        "topLevelComment": {
                            "snippet": {"textOriginal": post.content}
                        },
                    }
                },
            )
            resp.raise_for_status()
            return resp.json()["id"]

    async def get_metrics(self, account: PlatformAccount, platform_post_id: str) -> dict:
        token = await self._get_valid_token(account)
        channel_id = account.account_id_on_platform

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{YOUTUBE_API}/videos",
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "part": "statistics",
                    "id": platform_post_id,
                },
            )
            if resp.status_code != 200:
                return {"likes": 0, "reposts": 0, "replies": 0, "views": 0, "clicks": 0}
            items = resp.json().get("items", [])
            if not items:
                return {"likes": 0, "reposts": 0, "replies": 0, "views": 0, "clicks": 0}

            stats = items[0].get("statistics", {})
            return {
                "likes": int(stats.get("likeCount", 0)),
                "reposts": 0,
                "replies": int(stats.get("commentCount", 0)),
                "views": int(stats.get("viewCount", 0)),
                "clicks": int(stats.get("favoriteCount", 0)),
                "raw_data": json.dumps(stats),
            }

    async def _get_valid_token(self, account: PlatformAccount) -> str:
        from datetime import datetime, timedelta, timezone

        from app.config import settings
        from app.services.crypto import encrypt

        token = decrypt(account.access_token_encrypted)
        if account.token_expires_at:
            now = datetime.now(timezone.utc)
            exp = account.token_expires_at.replace(tzinfo=timezone.utc)
            if exp < now:
                # Refresh
                if account.refresh_token_encrypted:
                    refresh_token = decrypt(account.refresh_token_encrypted)
                    async with httpx.AsyncClient() as client:
                        resp = await client.post(
                            "https://oauth2.googleapis.com/token",
                            data={
                                "grant_type": "refresh_token",
                                "refresh_token": refresh_token,
                                "client_id": settings.YOUTUBE_CLIENT_ID,
                                "client_secret": settings.YOUTUBE_CLIENT_SECRET,
                            },
                        )
                        resp.raise_for_status()
                        data = resp.json()
                        token = data["access_token"]
                        account.access_token_encrypted = encrypt(token)
                        account.token_expires_at = datetime.now(timezone.utc) + timedelta(
                            seconds=data.get("expires_in", 3600)
                        )
        return token

    async def get_channel_id(self, token: str) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{YOUTUBE_API}/channels?part=id&mine=true",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
            return items[0]["id"] if items else ""
