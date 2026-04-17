import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.campaign import Campaign
from app.models.user import User
from app.schemas.campaign import CampaignCreate, CampaignOut, CampaignUpdate
from app.services import content_generator

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


def _serialize(c: Campaign) -> dict:
    return {
        "id": c.id,
        "user_id": c.user_id,
        "name": c.name,
        "description": c.description,
        "topic": c.topic,
        "goals": c.goals,
        "target_platforms": json.loads(c.target_platforms or "[]"),
        "status": c.status,
        "start_date": c.start_date,
        "end_date": c.end_date,
        "content_calendar": json.loads(c.content_calendar) if c.content_calendar else None,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


@router.get("")
async def list_campaigns(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.user_id == user.id).order_by(Campaign.created_at.desc())
    )
    return [_serialize(c) for c in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CampaignCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = Campaign(
        user_id=user.id,
        name=body.name,
        description=body.description,
        topic=body.topic,
        goals=body.goals,
        target_platforms=json.dumps(body.target_platforms),
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return _serialize(campaign)


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_owned(campaign_id, user.id, db)
    return _serialize(campaign)


@router.patch("/{campaign_id}")
async def update_campaign(
    campaign_id: int,
    body: CampaignUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_owned(campaign_id, user.id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        if field == "target_platforms":
            campaign.target_platforms = json.dumps(value)
        else:
            setattr(campaign, field, value)
    await db.commit()
    await db.refresh(campaign)
    return _serialize(campaign)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_owned(campaign_id, user.id, db)
    await db.delete(campaign)
    await db.commit()


@router.post("/{campaign_id}/generate-calendar")
async def generate_calendar(
    campaign_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_owned(campaign_id, user.id, db)
    platforms = json.loads(campaign.target_platforms or "[]")
    if not platforms:
        raise HTTPException(status_code=400, detail="Campaign has no target platforms")

    calendar = await content_generator.generate_content_calendar(
        user_id=user.id,
        campaign_name=campaign.name,
        topic=campaign.topic,
        goals=campaign.goals,
        platforms=platforms,
    )
    campaign.content_calendar = json.dumps(calendar)
    await db.commit()
    return {"content_calendar": calendar}


async def _get_owned(campaign_id: int, user_id: int, db: AsyncSession) -> Campaign:
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign
