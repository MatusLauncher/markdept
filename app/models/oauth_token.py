from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OAuthToken(Base):
    __tablename__ = "oauth_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    provider: Mapped[str] = mapped_column(String(64), default="anthropic")
    access_token_encrypted: Mapped[bytes] = mapped_column(LargeBinary)
    refresh_token_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    token_type: Mapped[str] = mapped_column(String(32), default="bearer")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scope: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="oauth_tokens")  # noqa: F821
