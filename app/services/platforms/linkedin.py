import json

import httpx

from app.models.platform_account import PlatformAccount
from app.models.post import Post
from app.services.crypto import decrypt
from app.services.platforms.base import BasePlatformClient

LINKEDIN_API = "https://api.linkedin.com/v2"


class LinkedInClient(BasePlatformClient):
    async def post(self, account: PlatformAccount, post: Post) -> str:
        token = decrypt(account.access_token_encrypted)
        author_urn = account.account_id_on_platform  # e.g. "urn:li:person:xxx"

        payload = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": post.content},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LINKEDIN_API}/ugcPosts",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
                json=payload,
            )
            resp.raise_for_status()
            post_id = resp.headers.get("x-restli-id", resp.json().get("id", ""))
            return post_id

    async def get_metrics(self, account: PlatformAccount, platform_post_id: str) -> dict:
        token = decrypt(account.access_token_encrypted)
        author_urn = account.account_id_on_platform

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{LINKEDIN_API}/socialActions/{platform_post_id}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
            )
            if resp.status_code != 200:
                return {"likes": 0, "reposts": 0, "replies": 0, "views": 0, "clicks": 0}
            data = resp.json()

        # Also fetch share statistics if org-level
        stats = {
            "likes": data.get("likesSummary", {}).get("totalLikes", 0),
            "reposts": 0,
            "replies": data.get("commentsSummary", {}).get("totalFirstLevelComments", 0),
            "views": 0,
            "clicks": 0,
            "raw_data": json.dumps(data),
        }
        return stats

    async def get_profile_urn(self, token: str) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{LINKEDIN_API}/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            return f"urn:li:person:{data['id']}"
