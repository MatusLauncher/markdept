# Markdept

An automated marketing department powered by Claude AI. Create campaigns, generate AI content, schedule posts, and analyze performance across Mastodon, LinkedIn, Lemmy, and YouTube.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun 1.x |
| Backend | Hono 4.x (TypeScript) |
| ORM | Drizzle ORM |
| Database | Neon Postgres |
| Encryption | AES-256-GCM (Web Crypto) |
| Sessions | HMAC-SHA256 signed cookies (Web Crypto) |
| Frontend | React 18 + TanStack Query + React Router |
| Build | Vite 5 |
| Tests | bun:test |

## Prerequisites

- [Bun](https://bun.sh) 1.x
- A [Neon](https://neon.tech) Postgres database
- An [Anthropic](https://console.anthropic.com) OAuth app (for Claude login)

## Setup

```bash
git clone https://github.com/matuslauncher/markdept
cd markdept
bun install
cp .env.example .env
# Fill in DATABASE_URL, ENCRYPTION_KEY, SECRET_KEY, ANTHROPIC_CLIENT_ID, ANTHROPIC_CLIENT_SECRET
bun run db:push
```

Generate `ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Development

```bash
bun run dev        # starts Hono on :8000 + Vite on :5173 concurrently
```

Open `http://localhost:5173`.

## Production

```bash
bun run build      # bundles React into dist/
bun src/index.ts   # serves everything on :8000
```

## Platform Setup

### Mastodon
Register an app at `https://your.instance/settings/applications` with `read write` scope.
Set `MASTODON_CLIENT_ID`, `MASTODON_CLIENT_SECRET`, `MASTODON_INSTANCE_URL` in `.env`.

### LinkedIn
Create an app at [developer.linkedin.com](https://developer.linkedin.com) with scopes: `openid profile email w_member_social`.
Set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.

### Lemmy
No OAuth needed — enter your Lemmy username, password, and community ID in the Platforms page.
Set `LEMMY_INSTANCE_URL`.

### YouTube
Create a project in [Google Cloud Console](https://console.cloud.google.com), enable the YouTube Data API v3, create OAuth 2.0 credentials.
Set `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`.

## API Reference

All endpoints require an authenticated session cookie (set via `GET /auth/login` OAuth flow).

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/login` | Start Anthropic PKCE OAuth |
| `GET` | `/auth/callback` | OAuth callback |
| `POST` | `/auth/logout` | Clear session |
| `GET` | `/auth/me` | Current user info |
| `GET` | `/api/campaigns` | List campaigns |
| `POST` | `/api/campaigns` | Create campaign |
| `GET` | `/api/campaigns/:id` | Get campaign |
| `PUT` | `/api/campaigns/:id` | Update campaign |
| `DELETE` | `/api/campaigns/:id` | Delete campaign |
| `POST` | `/api/campaigns/:id/generate-calendar` | AI content calendar |
| `GET` | `/api/posts` | List posts (optional `?status=`) |
| `POST` | `/api/posts` | Create post |
| `PUT` | `/api/posts/:id` | Update post |
| `DELETE` | `/api/posts/:id` | Delete post |
| `POST` | `/api/posts/:id/generate` | AI-generate content for post |
| `GET` | `/api/platforms` | List connected platforms |
| `DELETE` | `/api/platforms/:id` | Disconnect platform |
| `GET` | `/api/platforms/mastodon/connect` | Start Mastodon OAuth |
| `GET` | `/api/platforms/linkedin/connect` | Start LinkedIn OAuth |
| `POST` | `/api/platforms/lemmy/connect` | Connect Lemmy account |
| `GET` | `/api/platforms/youtube/connect` | Start YouTube OAuth |
| `GET` | `/api/analytics` | List analytics entries |
| `POST` | `/api/analytics/fetch/:postId` | Fetch metrics from platform |
| `POST` | `/api/analytics/report` | Generate AI analytics report |

## Tests

```bash
bun test
```

Tests run without a real database (Neon's HTTP driver is lazy).

## License

MIT
