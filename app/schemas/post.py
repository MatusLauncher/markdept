from datetime import datetime

from pydantic import BaseModel


class PostCreate(BaseModel):
    platform_account_id: int
    platform: str
    content: str
    campaign_id: int | None = None
    media_urls: list[str] = []
    video_title: str | None = None
    video_tags: list[str] = []
    video_file_path: str | None = None


class PostUpdate(BaseModel):
    content: str | None = None
    media_urls: list[str] | None = None
    video_title: str | None = None
    video_tags: list[str] | None = None


class PostSchedule(BaseModel):
    scheduled_at: datetime


class PostGenerateRequest(BaseModel):
    platform: str
    topic: str
    campaign_id: int | None = None
    platform_account_id: int | None = None
    tone: str | None = None
    additional_context: str | None = None


class PostOut(BaseModel):
    id: int
    user_id: int
    campaign_id: int | None
    platform_account_id: int
    platform: str
    content: str
    media_urls: list[str]
    status: str
    scheduled_at: datetime | None
    published_at: datetime | None
    platform_post_id: str | None
    error_message: str | None
    video_title: str | None
    video_tags: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
