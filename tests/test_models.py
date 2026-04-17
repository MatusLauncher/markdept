"""Tests for ORM model creation and relationships."""
import pytest
from sqlalchemy import select

from app.models.user import User
from app.models.campaign import Campaign
from app.models.post import Post
from app.models.platform_account import PlatformAccount
from app.services.crypto import encrypt


@pytest.mark.asyncio
async def test_create_user(db):
    user = User(anthropic_user_id="test-uid-001", email="test@example.com", display_name="Test User")
    db.add(user)
    await db.commit()
    await db.refresh(user)

    assert user.id is not None
    assert user.is_active is True
    assert user.email == "test@example.com"


@pytest.mark.asyncio
async def test_create_campaign(db):
    import json

    user = User(anthropic_user_id="test-uid-002")
    db.add(user)
    await db.flush()

    campaign = Campaign(
        user_id=user.id,
        name="Test Campaign",
        topic="AI marketing",
        goals="Increase reach",
        target_platforms=json.dumps(["mastodon", "linkedin"]),
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    assert campaign.id is not None
    assert campaign.status == "draft"
    assert json.loads(campaign.target_platforms) == ["mastodon", "linkedin"]


@pytest.mark.asyncio
async def test_create_platform_account(db):
    user = User(anthropic_user_id="test-uid-003")
    db.add(user)
    await db.flush()

    account = PlatformAccount(
        user_id=user.id,
        platform="mastodon",
        account_name="@test@mastodon.social",
        instance_url="https://mastodon.social",
        access_token_encrypted=encrypt("fake-token"),
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    assert account.id is not None
    assert account.is_active is True
    assert account.platform == "mastodon"


@pytest.mark.asyncio
async def test_create_post(db):
    import json

    user = User(anthropic_user_id="test-uid-004")
    db.add(user)
    await db.flush()

    account = PlatformAccount(
        user_id=user.id,
        platform="mastodon",
        account_name="@test@mastodon.social",
        access_token_encrypted=encrypt("fake-token"),
    )
    db.add(account)
    await db.flush()

    post = Post(
        user_id=user.id,
        platform_account_id=account.id,
        platform="mastodon",
        content="Hello Mastodon! #test",
        media_urls=json.dumps([]),
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)

    assert post.id is not None
    assert post.status == "draft"
    assert post.published_at is None
