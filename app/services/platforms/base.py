from abc import ABC, abstractmethod

from app.models.platform_account import PlatformAccount
from app.models.post import Post


class BasePlatformClient(ABC):
    @abstractmethod
    async def post(self, account: PlatformAccount, post: Post) -> str:
        """Publish the post. Returns the platform-assigned post ID."""

    @abstractmethod
    async def get_metrics(self, account: PlatformAccount, platform_post_id: str) -> dict:
        """Fetch engagement metrics. Returns dict with likes, reposts, replies, views, clicks."""
