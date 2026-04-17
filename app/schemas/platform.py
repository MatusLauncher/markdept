from datetime import datetime

from pydantic import BaseModel


class PlatformAccountOut(BaseModel):
    id: int
    user_id: int
    platform: str
    account_name: str
    account_id_on_platform: str | None
    instance_url: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LemmyConnectRequest(BaseModel):
    instance_url: str
    username: str
    password: str


class MastodonConnectRequest(BaseModel):
    instance_url: str
