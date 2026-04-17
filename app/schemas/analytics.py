from datetime import datetime

from pydantic import BaseModel


class PostAnalyticsOut(BaseModel):
    id: int
    post_id: int
    platform: str
    fetched_at: datetime
    likes: int
    reposts: int
    replies: int
    views: int
    clicks: int

    model_config = {"from_attributes": True}


class ReportGenerateRequest(BaseModel):
    campaign_id: int | None = None
    date_range_start: datetime
    date_range_end: datetime
    title: str


class AnalyticsReportOut(BaseModel):
    id: int
    user_id: int
    campaign_id: int | None
    title: str
    report_text: str
    date_range_start: datetime
    date_range_end: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
