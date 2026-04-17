from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlatformAccount(Base):
    __tablename__ = "platform_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(String(32))  # mastodon|linkedin|lemmy|youtube
    account_name: Mapped[str] = mapped_column(String(255))
    account_id_on_platform: Mapped[str | None] = mapped_column(String(255), nullable=True)
    instance_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    access_token_encrypted: Mapped[bytes] = mapped_column(LargeBinary)
    refresh_token_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    extra_data_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="platform_accounts")  # noqa: F821
    posts: Mapped[list["Post"]] = relationship(  # noqa: F821
        back_populates="platform_account"
    )
