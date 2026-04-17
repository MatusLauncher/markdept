"""Tests for authentication-gated API endpoints."""
import pytest


@pytest.mark.asyncio
async def test_campaigns_api_requires_auth(client):
    resp = await client.get("/api/campaigns")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_posts_api_requires_auth(client):
    resp = await client.get("/api/posts")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_platforms_api_requires_auth(client):
    resp = await client.get("/api/platforms")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_analytics_api_requires_auth(client):
    resp = await client.get("/api/analytics/posts")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_generate_post_requires_auth(client):
    resp = await client.post("/api/posts/generate", json={"platform": "mastodon", "topic": "test"})
    assert resp.status_code == 401
