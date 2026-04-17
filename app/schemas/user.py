from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    anthropic_user_id: str
    email: str | None
    display_name: str | None
    is_active: bool

    model_config = {"from_attributes": True}
