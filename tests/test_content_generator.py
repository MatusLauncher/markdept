"""Unit tests for content_generator helpers (no network calls)."""
import json
import pytest

from app.services.content_generator import PLATFORM_SYSTEM_PROMPTS, PLATFORM_LIMITS


def test_all_platforms_have_prompts():
    for platform in ("mastodon", "linkedin", "lemmy", "youtube"):
        assert platform in PLATFORM_SYSTEM_PROMPTS
        assert len(PLATFORM_SYSTEM_PROMPTS[platform]) > 50


def test_all_platforms_have_limits():
    for platform in ("mastodon", "linkedin", "lemmy", "youtube"):
        assert platform in PLATFORM_LIMITS
        assert PLATFORM_LIMITS[platform] > 0


def test_mastodon_limit():
    assert PLATFORM_LIMITS["mastodon"] == 500


def test_linkedin_limit():
    assert PLATFORM_LIMITS["linkedin"] == 3000


def test_prompts_request_json_output():
    """Every system prompt should instruct Claude to return JSON."""
    for platform, prompt in PLATFORM_SYSTEM_PROMPTS.items():
        assert "JSON" in prompt, f"{platform} prompt does not mention JSON"
