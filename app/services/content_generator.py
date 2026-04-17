import json

from app.services import anthropic_client

PLATFORM_SYSTEM_PROMPTS = {
    "mastodon": (
        "You are a social media expert writing for Mastodon, a federated microblogging platform. "
        "Write engaging, conversational posts under 500 characters. "
        "Include 2-4 relevant hashtags at the end. "
        "Use plain language and invite discussion. "
        "Return ONLY a JSON object with keys: body (str), hashtags (list[str])."
    ),
    "linkedin": (
        "You are a professional content writer for LinkedIn. "
        "Write B2B-focused posts up to 3000 characters. "
        "Use a professional but approachable tone. "
        "Include a clear value proposition and call to action. "
        "Use at most 3 hashtags. "
        "Return ONLY a JSON object with keys: body (str), hashtags (list[str])."
    ),
    "lemmy": (
        "You are writing a post for Lemmy, a federated Reddit-like platform. "
        "Write a community-focused post under 1000 characters that invites discussion. "
        "Include a compelling title and body. "
        "Be authentic and community-minded. "
        "Return ONLY a JSON object with keys: title (str), body (str)."
    ),
    "youtube": (
        "You are a YouTube content strategist. "
        "Write SEO-optimized metadata for a YouTube video. "
        "The title should be 60-70 characters and compelling. "
        "The description should be 200-400 characters and keyword-rich. "
        "Include 10-15 relevant tags. "
        "Return ONLY a JSON object with keys: title (str), body (str, the description), tags (list[str])."
    ),
}

PLATFORM_LIMITS = {
    "mastodon": 500,
    "linkedin": 3000,
    "lemmy": 1000,
    "youtube": 400,
}


async def generate_post(
    user_id: int,
    platform: str,
    topic: str,
    campaign_context: str | None = None,
    tone: str | None = None,
    additional_context: str | None = None,
) -> dict:
    system = PLATFORM_SYSTEM_PROMPTS.get(platform, PLATFORM_SYSTEM_PROMPTS["mastodon"])

    user_parts = [f"Topic: {topic}"]
    if campaign_context:
        user_parts.append(f"Campaign context: {campaign_context}")
    if tone:
        user_parts.append(f"Tone: {tone}")
    if additional_context:
        user_parts.append(f"Additional context: {additional_context}")

    user_message = "\n".join(user_parts)

    text = await anthropic_client.generate(
        user_id=user_id,
        system=system,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=1024,
    )

    # Parse JSON from Claude's response
    try:
        # Strip markdown code blocks if present
        clean = text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(clean)
    except (json.JSONDecodeError, IndexError):
        # Fallback: return as plain body
        return {"body": text, "hashtags": [], "title": topic}


async def generate_content_calendar(
    user_id: int,
    campaign_name: str,
    topic: str,
    goals: str,
    platforms: list[str],
    num_posts: int = 10,
) -> list[dict]:
    system = (
        "You are a marketing strategist creating a content calendar. "
        "Return ONLY a valid JSON array of post ideas. "
        "Each item must have: platform (str), topic (str), content_type (str), timing_suggestion (str). "
        "Do not include any explanation outside the JSON array."
    )
    user_msg = (
        f"Campaign: {campaign_name}\n"
        f"Topic: {topic}\n"
        f"Goals: {goals}\n"
        f"Platforms: {', '.join(platforms)}\n"
        f"Generate {num_posts} diverse post ideas spread across these platforms."
    )

    text = await anthropic_client.generate(
        user_id=user_id,
        system=system,
        messages=[{"role": "user", "content": user_msg}],
        max_tokens=2048,
    )

    try:
        clean = text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(clean)
    except (json.JSONDecodeError, IndexError):
        return []


async def generate_analytics_report(
    user_id: int,
    analytics_data: dict,
    date_range: str,
    campaign_name: str | None = None,
) -> str:
    system = (
        "You are a marketing analyst generating a performance report. "
        "Write a concise, insightful report in Markdown format. "
        "Include: executive summary, per-platform performance, key insights, and recommendations. "
        "Be specific about the numbers provided."
    )
    context = f"Date range: {date_range}\n"
    if campaign_name:
        context += f"Campaign: {campaign_name}\n"
    context += f"Analytics data:\n{json.dumps(analytics_data, indent=2)}"

    return await anthropic_client.generate(
        user_id=user_id,
        system=system,
        messages=[{"role": "user", "content": context}],
        max_tokens=2048,
    )
