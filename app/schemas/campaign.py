from datetime import datetime

from pydantic import BaseModel


class CampaignCreate(BaseModel):
    name: str
    description: str | None = None
    topic: str
    goals: str
    target_platforms: list[str] = []
    start_date: datetime | None = None
    end_date: datetime | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    topic: str | None = None
    goals: str | None = None
    target_platforms: list[str] | None = None
    status: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class CampaignOut(BaseModel):
    id: int
    user_id: int
    name: str
    description: str | None
    topic: str
    goals: str
    target_platforms: list[str]
    status: str
    start_date: datetime | None
    end_date: datetime | None
    content_calendar: list[dict] | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
