import logging
from datetime import datetime, timezone

from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.config import settings

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def init_scheduler() -> None:
    global _scheduler

    # Use sync SQLite URL for APScheduler job store (it doesn't support async)
    sync_db_url = settings.DATABASE_URL.replace("sqlite+aiosqlite", "sqlite")

    _scheduler = AsyncIOScheduler(
        jobstores={"default": SQLAlchemyJobStore(url=sync_db_url)},
        executors={"default": AsyncIOExecutor()},
        job_defaults={"coalesce": True, "max_instances": 1},
        timezone=settings.SCHEDULER_TIMEZONE,
    )
    _scheduler.start()
    logger.info("Scheduler started")


async def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def schedule_post(post_id: int, scheduled_at: datetime) -> None:
    if _scheduler is None:
        raise RuntimeError("Scheduler not initialized")
    _scheduler.add_job(
        _execute_post,
        "date",
        run_date=scheduled_at,
        args=[post_id],
        id=f"post_{post_id}",
        replace_existing=True,
    )
    logger.info("Scheduled post %d at %s", post_id, scheduled_at)


def cancel_post(post_id: int) -> None:
    if _scheduler is None:
        return
    try:
        _scheduler.remove_job(f"post_{post_id}")
        logger.info("Cancelled post %d", post_id)
    except Exception:
        pass


async def _execute_post(post_id: int) -> None:
    from app.database import AsyncSessionLocal
    from app.models.post import Post
    from app.models.platform_account import PlatformAccount
    from app.services.platforms.mastodon import MastodonClient
    from app.services.platforms.linkedin import LinkedInClient
    from app.services.platforms.lemmy import LemmyClient
    from app.services.platforms.youtube import YouTubeClient

    clients = {
        "mastodon": MastodonClient(),
        "linkedin": LinkedInClient(),
        "lemmy": LemmyClient(),
        "youtube": YouTubeClient(),
    }

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Post).where(Post.id == post_id))
        post = result.scalar_one_or_none()
        if not post or post.status not in ("scheduled", "draft"):
            return

        account_result = await db.execute(
            select(PlatformAccount).where(PlatformAccount.id == post.platform_account_id)
        )
        account = account_result.scalar_one_or_none()
        if not account:
            post.status = "failed"
            post.error_message = "Platform account not found"
            await db.commit()
            return

        client = clients.get(post.platform)
        if not client:
            post.status = "failed"
            post.error_message = f"Unknown platform: {post.platform}"
            await db.commit()
            return

        try:
            platform_post_id = await client.post(account, post)
            post.status = "published"
            post.published_at = datetime.now(timezone.utc)
            post.platform_post_id = platform_post_id
            logger.info("Published post %d → %s", post_id, platform_post_id)
        except Exception as e:
            post.status = "failed"
            post.error_message = str(e)
            logger.error("Failed to publish post %d: %s", post_id, e)

        await db.commit()
