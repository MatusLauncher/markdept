import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.analytics import AnalyticsReport, PostAnalytics
from app.models.campaign import Campaign
from app.models.platform_account import PlatformAccount
from app.models.post import Post
from app.models.user import User
from app.schemas.analytics import AnalyticsReportOut, ReportGenerateRequest
from app.services import content_generator
from app.services.platforms.lemmy import LemmyClient
from app.services.platforms.linkedin import LinkedInClient
from app.services.platforms.mastodon import MastodonClient
from app.services.platforms.youtube import YouTubeClient

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

PLATFORM_CLIENTS = {
    "mastodon": MastodonClient(),
    "linkedin": LinkedInClient(),
    "lemmy": LemmyClient(),
    "youtube": YouTubeClient(),
}


@router.get("/posts")
async def get_posts_analytics(
    campaign_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(PostAnalytics)
        .join(Post, PostAnalytics.post_id == Post.id)
        .where(Post.user_id == user.id)
    )
    if campaign_id:
        q = q.where(Post.campaign_id == campaign_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/posts/{post_id}")
async def get_post_analytics(
    post_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post_result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == user.id)
    )
    if not post_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Post not found")

    result = await db.execute(
        select(PostAnalytics)
        .where(PostAnalytics.post_id == post_id)
        .order_by(PostAnalytics.fetched_at.desc())
    )
    return result.scalars().all()


@router.post("/fetch")
async def fetch_metrics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    published_result = await db.execute(
        select(Post).where(Post.user_id == user.id, Post.status == "published")
    )
    posts = published_result.scalars().all()

    fetched = 0
    errors = []
    for post in posts:
        if not post.platform_post_id:
            continue
        account_result = await db.execute(
            select(PlatformAccount).where(PlatformAccount.id == post.platform_account_id)
        )
        account = account_result.scalar_one_or_none()
        if not account:
            continue

        client = PLATFORM_CLIENTS.get(post.platform)
        if not client:
            continue

        try:
            metrics = await client.get_metrics(account, post.platform_post_id)
            raw = metrics.pop("raw_data", None)
            pa = PostAnalytics(
                post_id=post.id,
                platform=post.platform,
                raw_data=raw,
                **metrics,
            )
            db.add(pa)
            fetched += 1
        except Exception as e:
            errors.append({"post_id": post.id, "error": str(e)})

    await db.commit()
    return {"fetched": fetched, "errors": errors}


@router.get("/reports", response_model=list[AnalyticsReportOut])
async def list_reports(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalyticsReport)
        .where(AnalyticsReport.user_id == user.id)
        .order_by(AnalyticsReport.created_at.desc())
    )
    return result.scalars().all()


@router.post("/reports/generate", status_code=status.HTTP_201_CREATED)
async def generate_report(
    body: ReportGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Collect analytics data in the date range
    q = (
        select(PostAnalytics, Post)
        .join(Post, PostAnalytics.post_id == Post.id)
        .where(
            Post.user_id == user.id,
            PostAnalytics.fetched_at >= body.date_range_start,
            PostAnalytics.fetched_at <= body.date_range_end,
        )
    )
    if body.campaign_id:
        q = q.where(Post.campaign_id == body.campaign_id)
    result = await db.execute(q)
    rows = result.all()

    # Aggregate by platform
    by_platform: dict = {}
    for pa, post in rows:
        p = post.platform
        if p not in by_platform:
            by_platform[p] = {"posts": 0, "likes": 0, "reposts": 0, "replies": 0, "views": 0}
        by_platform[p]["posts"] += 1
        by_platform[p]["likes"] += pa.likes
        by_platform[p]["reposts"] += pa.reposts
        by_platform[p]["replies"] += pa.replies
        by_platform[p]["views"] += pa.views

    campaign_name = None
    if body.campaign_id:
        c_result = await db.execute(
            select(Campaign).where(Campaign.id == body.campaign_id, Campaign.user_id == user.id)
        )
        campaign = c_result.scalar_one_or_none()
        if campaign:
            campaign_name = campaign.name

    date_range_str = f"{body.date_range_start.date()} to {body.date_range_end.date()}"
    report_text = await content_generator.generate_analytics_report(
        user_id=user.id,
        analytics_data=by_platform,
        date_range=date_range_str,
        campaign_name=campaign_name,
    )

    report = AnalyticsReport(
        user_id=user.id,
        campaign_id=body.campaign_id,
        title=body.title,
        report_text=report_text,
        date_range_start=body.date_range_start,
        date_range_end=body.date_range_end,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/reports/{report_id}", response_model=AnalyticsReportOut)
async def get_report(
    report_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalyticsReport).where(
            AnalyticsReport.id == report_id, AnalyticsReport.user_id == user.id
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
