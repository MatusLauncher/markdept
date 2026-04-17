# Markdept

An automated marketing department powered by [Claude](https://claude.ai). Connect your social accounts, describe a campaign topic, and let Claude generate platform-appropriate content — then publish immediately or schedule it for later.

**Supported platforms:** Mastodon · LinkedIn · Lemmy · YouTube

---

## Features

- **Anthropic OAuth 2.0** — users sign in via Claude.ai; the app calls the Claude API on their behalf using their own access token
- **AI content generation** — platform-tuned prompts with prompt caching for Mastodon, LinkedIn, Lemmy, and YouTube
- **Campaign management** — multi-platform campaigns with goals, date ranges, and Claude-generated content calendars
- **Post scheduling** — queue posts for future publishing; jobs persist across restarts via APScheduler + SQLite
- **Analytics** — pull engagement metrics from all platforms and generate Claude-written performance reports
- **Secure by default** — all OAuth tokens are Fernet-encrypted at rest; sessions are signed httponly cookies

---

## Requirements

- Python 3.11+
- API credentials for each platform you want to use (see [Configuration](#configuration))

---

## Quick Start

```bash
# 1. Clone and enter the repo
git clone https://github.com/MatusLauncher/markdept.git
cd markdept

# 2. Create a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env — see Configuration section below

# 5. Run
uvicorn app.main:app --reload
```

Open <http://localhost:8000> in your browser.

---

## Configuration

Copy `.env.example` to `.env` and fill in the values:

```dotenv
# App — required
SECRET_KEY=<long random string>
FERNET_KEY=<base64 key, generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">

# Anthropic OAuth — required for login
# Register at https://console.anthropic.com → OAuth Applications
ANTHROPIC_CLIENT_ID=
ANTHROPIC_CLIENT_SECRET=
ANTHROPIC_REDIRECT_URI=http://localhost:8000/auth/callback
```

Each platform is optional — only configure the ones you want to use:

| Variable | Where to get it |
|---|---|
| `MASTODON_CLIENT_ID` / `MASTODON_CLIENT_SECRET` | Your instance → Settings → Applications |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | [LinkedIn Developer Portal](https://developer.linkedin.com) |
| `LEMMY_INSTANCE_URL` | The Lemmy instance you want to post to (no credentials needed here — entered in the UI) |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com) → APIs → YouTube Data API v3 |

---

## Architecture

```
markdept/
├── app/
│   ├── main.py                  # FastAPI app, lifespan, router registration
│   ├── config.py                # pydantic-settings — all env vars
│   ├── database.py              # async SQLAlchemy engine + session factory
│   ├── dependencies.py          # get_db, get_current_user (session cookie)
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── oauth_token.py       # Anthropic OAuth tokens (encrypted)
│   │   ├── platform_account.py  # Connected social accounts (tokens encrypted)
│   │   ├── campaign.py
│   │   ├── post.py
│   │   └── analytics.py
│   ├── schemas/                 # Pydantic request / response models
│   ├── routers/
│   │   ├── auth.py              # Anthropic PKCE OAuth flow
│   │   ├── campaigns.py         # Campaign CRUD + calendar generation
│   │   ├── posts.py             # Post CRUD + publish / schedule
│   │   ├── platforms.py         # Per-platform OAuth connect flows
│   │   ├── analytics.py         # Metrics fetch + report generation
│   │   └── pages.py             # Server-rendered HTML pages
│   └── services/
│       ├── anthropic_client.py  # Claude API via OAuth Bearer token
│       ├── content_generator.py # Platform-specific prompt templates
│       ├── scheduler.py         # APScheduler (AsyncIO, SQLAlchemy job store)
│       ├── crypto.py            # Fernet encrypt / decrypt
│       └── platforms/
│           ├── mastodon.py
│           ├── linkedin.py
│           ├── lemmy.py
│           └── youtube.py
├── static/                      # CSS + vanilla JS
├── app/templates/               # Jinja2 HTML templates
├── tests/                       # pytest test suite
├── .env.example
└── requirements.txt
```

### Key design decisions

**Per-user OAuth tokens for Claude** — every Claude API call uses the signed-in user's own Anthropic Bearer token, not a shared API key. Usage is attributed to each user's account.

**httpx over the Anthropic SDK** — the SDK expects a static `ANTHROPIC_API_KEY`. Because tokens are user-specific and need runtime refresh, direct `httpx` calls with `Authorization: Bearer` are used instead.

**Fernet encryption at rest** — every `access_token` and `refresh_token` column in SQLite is encrypted with a single `FERNET_KEY` from `.env`. In a multi-tenant production deployment, derive a key per user instead.

**APScheduler with SQLite job store** — scheduled jobs survive process restarts because they are persisted in the same SQLite database.

---

## API Reference

All JSON endpoints are under `/api/`.

### Authentication

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/login` | Start Anthropic OAuth PKCE flow |
| `GET` | `/auth/callback` | OAuth callback — creates session |
| `POST` | `/auth/logout` | Clear session |
| `GET` | `/auth/me` | Current user (JSON) |

### Campaigns

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/campaigns` | List campaigns |
| `POST` | `/api/campaigns` | Create campaign |
| `GET` | `/api/campaigns/{id}` | Get campaign |
| `PATCH` | `/api/campaigns/{id}` | Update campaign |
| `DELETE` | `/api/campaigns/{id}` | Delete campaign |
| `POST` | `/api/campaigns/{id}/generate-calendar` | Generate content calendar with Claude |

### Posts

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/posts` | List posts (filterable by `status`, `platform`, `campaign_id`) |
| `POST` | `/api/posts` | Create post |
| `POST` | `/api/posts/generate` | Generate content with Claude (returns draft) |
| `GET` | `/api/posts/{id}` | Get post |
| `PATCH` | `/api/posts/{id}` | Update post |
| `DELETE` | `/api/posts/{id}` | Delete post |
| `POST` | `/api/posts/{id}/publish` | Publish immediately |
| `POST` | `/api/posts/{id}/schedule` | Schedule for future |
| `POST` | `/api/posts/{id}/cancel-schedule` | Cancel scheduled post |

### Platforms

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/platforms` | List connected accounts |
| `POST` | `/api/platforms/mastodon/connect` | Start Mastodon OAuth |
| `GET` | `/api/platforms/mastodon/callback` | Mastodon OAuth callback |
| `GET` | `/api/platforms/linkedin/connect` | Start LinkedIn OAuth |
| `GET` | `/api/platforms/linkedin/callback` | LinkedIn OAuth callback |
| `POST` | `/api/platforms/lemmy/connect` | Connect Lemmy (username + password) |
| `GET` | `/api/platforms/youtube/connect` | Start YouTube OAuth |
| `GET` | `/api/platforms/youtube/callback` | YouTube OAuth callback |
| `DELETE` | `/api/platforms/{id}` | Disconnect account |

### Analytics

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/analytics/posts` | Get all post analytics |
| `GET` | `/api/analytics/posts/{post_id}` | Get analytics for one post |
| `POST` | `/api/analytics/fetch` | Pull fresh metrics from all platforms |
| `GET` | `/api/analytics/reports` | List reports |
| `POST` | `/api/analytics/reports/generate` | Generate Claude-written report |
| `GET` | `/api/analytics/reports/{id}` | Get report |

---

## Development

### Running tests

```bash
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

### Linting

```bash
pip install ruff
ruff check app/ tests/
```

### Generating a Fernet key

```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

---

## License

GNU General Public License v3 — see [LICENSE](LICENSE).
