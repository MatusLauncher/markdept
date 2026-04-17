"""Smoke tests: unauthenticated requests to public pages."""
import pytest


@pytest.mark.asyncio
async def test_root_redirects(client):
    resp = await client.get("/", follow_redirects=False)
    # Unauthenticated root → login page (200) or redirect
    assert resp.status_code in (200, 302, 307)


@pytest.mark.asyncio
async def test_dashboard_redirects_unauthenticated(client):
    resp = await client.get("/dashboard", follow_redirects=False)
    assert resp.status_code in (302, 307)


@pytest.mark.asyncio
async def test_campaigns_page_redirects_unauthenticated(client):
    resp = await client.get("/campaigns", follow_redirects=False)
    assert resp.status_code in (302, 307)


@pytest.mark.asyncio
async def test_posts_page_redirects_unauthenticated(client):
    resp = await client.get("/posts", follow_redirects=False)
    assert resp.status_code in (302, 307)


@pytest.mark.asyncio
async def test_platforms_page_redirects_unauthenticated(client):
    resp = await client.get("/platforms", follow_redirects=False)
    assert resp.status_code in (302, 307)


@pytest.mark.asyncio
async def test_analytics_page_redirects_unauthenticated(client):
    resp = await client.get("/analytics", follow_redirects=False)
    assert resp.status_code in (302, 307)
