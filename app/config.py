from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    SECRET_KEY: str = "change-me-in-production"
    FERNET_KEY: str = ""
    DATABASE_URL: str = "sqlite+aiosqlite:///./markdept.db"

    # Anthropic OAuth
    ANTHROPIC_CLIENT_ID: str = ""
    ANTHROPIC_CLIENT_SECRET: str = ""
    ANTHROPIC_REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    ANTHROPIC_AUTH_URL: str = "https://claude.ai/oauth/authorize"
    ANTHROPIC_TOKEN_URL: str = "https://api.anthropic.com/oauth/token"
    ANTHROPIC_SCOPE: str = "org:read_claude"

    # Mastodon
    MASTODON_INSTANCE_URL: str = "https://mastodon.social"
    MASTODON_CLIENT_ID: str = ""
    MASTODON_CLIENT_SECRET: str = ""

    # LinkedIn
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""

    # Lemmy
    LEMMY_INSTANCE_URL: str = "https://lemmy.world"

    # YouTube
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    YOUTUBE_REDIRECT_URI: str = "http://localhost:8000/api/platforms/youtube/callback"

    # Scheduler
    SCHEDULER_TIMEZONE: str = "UTC"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
