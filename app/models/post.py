from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    campaign_id: Mapped[int | None] = mapped_column(
        ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True
    )
    platform_account_id: Mapped[int] = mapped_column(
        ForeignKey("platform_accounts.id", ondelete="CASCADE")
    )
    platform: Mapped[str] = mapped_column(String(32))
    content: Mapped[str] = mapped_column(Text)
    media_urls: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    status: Mapped[str] = mapped_column(String(32), default="draft")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    platform_post_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    # YouTube-specific fields
    video_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    video_tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    video_file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="posts")  # noqa: F821
    campaign: Mapped["Campaign | None"] = relationship(back_populates="posts")  # noqa: F821
    platform_account: Mapped["PlatformAccount"] = relationship(  # noqa: F821
        back_populates="posts"
    )
    analytics: Mapped[list["PostAnalytics"]] = relationship(  # noqa: F821
        back_populates="post", cascade="all, delete-orphan"
    )
