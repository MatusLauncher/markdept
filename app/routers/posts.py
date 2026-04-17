import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.campaign import Campaign
from app.models.platform_account import PlatformAccount
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostGenerateRequest, PostSchedule, PostUpdate
from app.services import content_generator
from app.services.platforms.lemmy import LemmyClient
from app.services.platforms.linkedin import LinkedInClient
from app.services.platforms.mastodon import MastodonClient
from app.services.platforms.youtube import YouTubeClient
from app.services.scheduler import cancel_post, schedule_post

router = APIRouter(prefix="/api/posts", tags=["posts"])

PLATFORM_CLIENTS = {
    "mastodon": MastodonClient(),
    "linkedin": LinkedInClient(),
    "lemmy": LemmyClient(),
    "youtube": YouTubeClient(),
}


def _serialize(p: Post) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "campaign_id": p.campaign_id,
        "platform_account_id": p.platform_account_id,
        "platform": p.platform,
        "content": p.content,
        "media_urls": json.loads(p.media_urls or "[]"),
        "status": p.status,
        "scheduled_at": p.scheduled_at,
        "published_at": p.published_at,
        "platform_post_id": p.platform_post_id,
        "error_message": p.error_message,
        "video_title": p.video_title,
        "video_tags": json.loads(p.video_tags or "[]"),
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


@router.get("")
async def list_posts(
    status: str | None = None,
    platform: str | None = None,
    campaign_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Post).where(Post.user_id == user.id)
    if status:
        q = q.where(Post.status == status)
    if platform:
        q = q.where(Post.platform == platform)
    if campaign_id:
        q = q.where(Post.campaign_id == campaign_id)
    q = q.order_by(Post.created_at.desc())
    result = await db.execute(q)
    return [_serialize(p) for p in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_post(
    body: PostCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_owned(body.platform_account_id, user.id, db)
    post = Post(
        user_id=user.id,
        campaign_id=body.campaign_id,
        platform_account_id=body.platform_account_id,
        platform=body.platform,
        content=body.content,
        media_urls=json.dumps(body.media_urls),
        video_title=body.video_title,
        video_tags=json.dumps(body.video_tags),
        video_file_path=body.video_file_path,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return _serialize(post)


@router.post("/generate")
async def generate_post(
    body: PostGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign_context = None
    if body.campaign_id:
        result = await db.execute(
            select(Campaign).where(Campaign.id == body.campaign_id, Campaign.user_id == user.id)
        )
        campaign = result.scalar_one_or_none()
        if campaign:
            campaign_context = f"{campaign.name}: {campaign.topic}. Goals: {campaign.goals}"

    generated = await content_generator.generate_post(
        user_id=user.id,
        platform=body.platform,
        topic=body.topic,
        campaign_context=campaign_context,
        tone=body.tone,
        additional_context=body.additional_context,
    )
    return generated


@router.get("/{post_id}")
async def get_post(
    post_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_owned(post_id, user.id, db)
    return _serialize(post)


@router.patch("/{post_id}")
async def update_post(
    post_id: int,
    body: PostUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_owned(post_id, user.id, db)
    if body.content is not None:
        post.content = body.content
    if body.media_urls is not None:
        post.media_urls = json.dumps(body.media_urls)
    if body.video_title is not None:
        post.video_title = body.video_title
    if body.video_tags is not None:
        post.video_tags = json.dumps(body.video_tags)
    await db.commit()
    await db.refresh(post)
    return _serialize(post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_owned(post_id, user.id, db)
    if post.status == "scheduled":
        cancel_post(post.id)
    await db.delete(post)
    await db.commit()


@router.post("/{post_id}/publish")
async def publish_post(
    post_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_owned(post_id, user.id, db)
    account = await _get_account(post.platform_account_id, db)
    client = PLATFORM_CLIENTS.get(post.platform)
    if not client:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {post.platform}")

    try:
        platform_post_id = await client.post(account, post)
        post.status = "published"
        post.published_at = datetime.now(timezone.utc)
        post.platform_post_id = platform_post_id
    except Exception as e:
        post.status = "failed"
        post.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=502, detail=f"Publish failed: {e}")

    await db.commit()
    await db.refresh(post)
    return _serialize(post)


@router.post("/{post_id}/schedule")
async def schedule_post_endpoint(
    post_id: int,
    body: PostSchedule,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_owned(post_id, user.id, db)
    if post.status == "published":
        raise HTTPException(status_code=400, detail="Post already published")

    post.scheduled_at = body.scheduled_at
    post.status = "scheduled"
    await db.commit()

    schedule_post(post.id, body.scheduled_at)
    await db.refresh(post)
    return _serialize(post)


@router.post("/{post_id}/cancel-schedule")
async def cancel_schedule_endpoint(
    post_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_owned(post_id, user.id, db)
    if post.status != "scheduled":
        raise HTTPException(status_code=400, detail="Post is not scheduled")
    cancel_post(post.id)
    post.status = "draft"
    post.scheduled_at = None
    await db.commit()
    await db.refresh(post)
    return _serialize(post)


async def _get_owned(post_id: int, user_id: int, db: AsyncSession) -> Post:
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == user_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def _get_account(account_id: int, db: AsyncSession) -> PlatformAccount:
    result = await db.execute(
        select(PlatformAccount).where(PlatformAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Platform account not found")
    return account


async def _assert_account_owned(account_id: int, user_id: int, db: AsyncSession) -> None:
    result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.id == account_id, PlatformAccount.user_id == user_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Platform account not found")
