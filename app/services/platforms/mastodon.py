import json

import httpx

from app.models.platform_account import PlatformAccount
from app.models.post import Post
from app.services.crypto import decrypt
from app.services.platforms.base import BasePlatformClient

CHAR_LIMIT = 500


class MastodonClient(BasePlatformClient):
    async def post(self, account: PlatformAccount, post: Post) -> str:
        instance = account.instance_url or "https://mastodon.social"
        token = decrypt(account.access_token_encrypted)

        content = post.content[:CHAR_LIMIT]
        payload: dict = {"status": content}

        media_ids = []
        if post.media_urls:
            urls = json.loads(post.media_urls)
            for url in urls[:4]:
                mid = await self._upload_media(instance, token, url)
                if mid:
                    media_ids.append(mid)
        if media_ids:
            payload["media_ids[]"] = media_ids

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{instance}/api/v1/statuses",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["id"]

    async def get_metrics(self, account: PlatformAccount, platform_post_id: str) -> dict:
        instance = account.instance_url or "https://mastodon.social"
        token = decrypt(account.access_token_encrypted)

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{instance}/api/v1/statuses/{platform_post_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()

        return {
            "likes": data.get("favourites_count", 0),
            "reposts": data.get("reblogs_count", 0),
            "replies": data.get("replies_count", 0),
            "views": 0,
            "clicks": 0,
            "raw_data": json.dumps(data),
        }

    async def _upload_media(self, instance: str, token: str, url: str) -> str | None:
        try:
            async with httpx.AsyncClient() as client:
                # Download media
                dl = await client.get(url)
                dl.raise_for_status()
                content_type = dl.headers.get("content-type", "image/jpeg")
                resp = await client.post(
                    f"{instance}/api/v2/media",
                    headers={"Authorization": f"Bearer {token}"},
                    files={"file": ("media", dl.content, content_type)},
                )
                resp.raise_for_status()
                return resp.json().get("id")
        except Exception:
            return None
