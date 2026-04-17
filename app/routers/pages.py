from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_optional_user
from app.models.campaign import Campaign
from app.models.platform_account import PlatformAccount
from app.models.post import Post
from app.models.user import User

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory="app/templates")


def _r(request: Request, template: str, ctx: dict):
    """Wrapper that uses the new Starlette TemplateResponse(request, name, ctx) API."""
    return templates.TemplateResponse(request, template, ctx)


@router.get("/", response_class=HTMLResponse)
async def index(request: Request, user: User | None = Depends(get_optional_user)):
    if user:
        return RedirectResponse(url="/dashboard")
    return _r(request, "login.html", {"user": None})


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")

    campaign_count = await db.scalar(
        select(func.count(Campaign.id)).where(Campaign.user_id == user.id)
    )
    scheduled_count = await db.scalar(
        select(func.count(Post.id)).where(
            Post.user_id == user.id, Post.status == "scheduled"
        )
    )
    published_count = await db.scalar(
        select(func.count(Post.id)).where(
            Post.user_id == user.id, Post.status == "published"
        )
    )
    platform_count = await db.scalar(
        select(func.count(PlatformAccount.id)).where(
            PlatformAccount.user_id == user.id, PlatformAccount.is_active == True  # noqa: E712
        )
    )

    platforms_result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.user_id == user.id, PlatformAccount.is_active == True  # noqa: E712
        )
    )
    platforms = platforms_result.scalars().all()

    upcoming_result = await db.execute(
        select(Post)
        .where(
            Post.user_id == user.id,
            Post.status == "scheduled",
            Post.scheduled_at >= datetime.now(timezone.utc),
        )
        .order_by(Post.scheduled_at)
        .limit(5)
    )
    upcoming_posts = upcoming_result.scalars().all()

    return _r(request, "dashboard.html", {
        "user": user,
        "campaign_count": campaign_count or 0,
        "scheduled_count": scheduled_count or 0,
        "published_count": published_count or 0,
        "platform_count": platform_count or 0,
        "platforms": platforms,
        "upcoming_posts": upcoming_posts,
    })


@router.get("/campaigns", response_class=HTMLResponse)
async def campaigns_page(
    request: Request, user: User | None = Depends(get_optional_user)
):
    if not user:
        return RedirectResponse(url="/")
    return _r(request, "campaigns/list.html", {"user": user})


@router.get("/campaigns/new", response_class=HTMLResponse)
async def campaigns_new_page(
    request: Request, user: User | None = Depends(get_optional_user)
):
    if not user:
        return RedirectResponse(url="/")
    return _r(request, "campaigns/create.html", {"user": user})


@router.get("/campaigns/{campaign_id}", response_class=HTMLResponse)
async def campaign_detail_page(
    campaign_id: int,
    request: Request,
    user: User | None = Depends(get_optional_user),
):
    if not user:
        return RedirectResponse(url="/")
    return _r(request, "campaigns/detail.html", {"user": user, "campaign_id": campaign_id})


@router.get("/posts", response_class=HTMLResponse)
async def posts_page(
    request: Request, user: User | None = Depends(get_optional_user)
):
    if not user:
        return RedirectResponse(url="/")
    return _r(request, "posts/list.html", {"user": user})


@router.get("/posts/new", response_class=HTMLResponse)
async def posts_new_page(
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        return RedirectResponse(url="/")
    platforms_result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.user_id == user.id, PlatformAccount.is_active == True  # noqa: E712
        )
    )
    platforms = platforms_result.scalars().all()
    campaigns_result = await db.execute(
        select(Campaign).where(Campaign.user_id == user.id)
    )
    campaigns = campaigns_result.scalars().all()
    return _r(request, "posts/create.html", {
        "user": user, "platforms": platforms, "campaigns": campaigns
    })


@router.get("/platforms", response_class=HTMLResponse)
async def platforms_page(
    request: Request, user: User | None = Depends(get_optional_user)
):
    if not user:
        return RedirectResponse(url="/")
    return _r(request, "platforms/list.html", {"user": user})


@router.get("/analytics", response_class=HTMLResponse)
async def analytics_page(
    request: Request, user: User | None = Depends(get_optional_user)
):
    if not user:
        return RedirectResponse(url="/")
    return _r(request, "analytics/dashboard.html", {"user": user})
