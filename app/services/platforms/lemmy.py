import json

import httpx

from app.models.platform_account import PlatformAccount
from app.models.post import Post
from app.services.crypto import decrypt, encrypt
from app.services.platforms.base import BasePlatformClient


class LemmyClient(BasePlatformClient):
    async def post(self, account: PlatformAccount, post: Post) -> str:
        instance = account.instance_url or "https://lemmy.world"
        token = await self._get_token(account, instance)

        # Extra data may contain community_id
        extra: dict = {}
        if account.extra_data_encrypted:
            extra = json.loads(decrypt(account.extra_data_encrypted))

        community_id = extra.get("community_id", 2)  # default to main community

        payload = {
            "name": post.video_title or post.content[:200],
            "body": post.content,
            "community_id": community_id,
            "nsfw": False,
            "auth": token,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{instance}/api/v3/post",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return str(data["post_view"]["post"]["id"])

    async def get_metrics(self, account: PlatformAccount, platform_post_id: str) -> dict:
        instance = account.instance_url or "https://lemmy.world"

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{instance}/api/v3/post",
                params={"id": platform_post_id},
            )
            resp.raise_for_status()
            data = resp.json()

        counts = data.get("post_view", {}).get("counts", {})
        return {
            "likes": counts.get("score", 0),
            "reposts": 0,
            "replies": counts.get("comments", 0),
            "views": counts.get("hot_rank", 0),
            "clicks": 0,
            "raw_data": json.dumps(counts),
        }

    async def _get_token(self, account: PlatformAccount, instance: str) -> str:
        # Lemmy uses short-lived JWTs; re-authenticate using stored credentials
        extra: dict = {}
        if account.extra_data_encrypted:
            extra = json.loads(decrypt(account.extra_data_encrypted))

        username = extra.get("username")
        password = extra.get("password")
        if not username or not password:
            return decrypt(account.access_token_encrypted)

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{instance}/api/v3/user/login",
                json={"username_or_email": username, "password": password},
            )
            resp.raise_for_status()
            data = resp.json()
            jwt = data["jwt"]

        # Update stored token
        account.access_token_encrypted = encrypt(jwt)
        return jwt

    @classmethod
    async def connect(cls, instance_url: str, username: str, password: str) -> tuple[str, str, dict]:
        """Returns (jwt, account_name, extra_data)."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{instance_url}/api/v3/user/login",
                json={"username_or_email": username, "password": password},
            )
            resp.raise_for_status()
            data = resp.json()
            jwt = data["jwt"]

        # Get user info
        async with httpx.AsyncClient() as client:
            me_resp = await client.get(
                f"{instance_url}/api/v3/site",
                headers={"Authorization": f"Bearer {jwt}"},
            )
            person = me_resp.json().get("my_user", {}).get("local_user_view", {}).get("person", {})
            account_name = person.get("name", username)
            account_id = str(person.get("id", ""))

        extra = {"username": username, "password": password, "account_id": account_id}
        return jwt, account_name, extra
