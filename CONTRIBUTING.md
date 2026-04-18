# Contributing to Markdept

## Development Setup

```bash
bun install
cp .env.example .env   # fill required vars
bun run db:push        # create tables in Neon
bun run dev            # Hono :8000 + Vite :5173
```

## Project Structure

```
src/                   # Hono backend
  config.ts            # Zod-validated env vars
  index.ts             # App entry, routes wired, scheduler started
  db/
    schema.ts          # Drizzle table definitions
    index.ts           # Neon + Drizzle singleton
  auth/
    session.ts         # HMAC-SHA256 signed cookies
    middleware.ts      # requireAuth / optionalAuth
  services/
    crypto.ts          # AES-256-GCM encrypt/decrypt
    anthropic.ts       # Claude API + token refresh
    contentGenerator.ts# AI prompts per platform
    scheduler.ts       # setTimeout-based post scheduler
    platforms/         # Per-platform API clients
  routes/              # Hono routers

client/src/            # React frontend
  api/                 # API wrapper functions
  hooks/               # useAuth
  components/          # Shared UI components
  pages/               # Route pages

tests/                 # bun:test unit tests
```

## Running Tests

```bash
bun test
```

## Adding a New Platform

1. Create `src/services/platforms/<name>.ts` implementing `PlatformClient` (`post`, `getMetrics`).
2. Add platform prompts and limits to `src/services/contentGenerator.ts`.
3. Add OAuth/connect routes to `src/routes/platforms.ts`.
4. Add analytics metrics fetching to `src/routes/analytics.ts`.
5. Add the connect button/flow to `client/src/pages/platforms/PlatformList.tsx`.
6. Add platform colour to `client/src/components/PlatformBadge.tsx`.

## PR Checklist

- [ ] `bun test` passes
- [ ] `bun tsc --noEmit` passes (backend)
- [ ] `cd client && bun tsc --noEmit` passes (frontend)
- [ ] `bun run build` succeeds
- [ ] No secrets committed
