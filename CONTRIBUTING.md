# Contributing to Markdept

Thank you for your interest in contributing!

## Setup

```bash
git clone https://github.com/MatusLauncher/markdept.git
cd markdept
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx ruff
cp .env.example .env   # fill in at minimum FERNET_KEY and SECRET_KEY
```

## Running the test suite

```bash
pytest tests/ -v
```

## Linting

```bash
ruff check app/ tests/
```

CI runs both on every push. Please ensure they pass before opening a PR.

## Branch naming

Use descriptive branch names prefixed by type:

- `feat/` — new feature
- `fix/` — bug fix
- `docs/` — documentation only
- `chore/` — tooling, CI, dependencies

## Pull request checklist

- [ ] Tests pass (`pytest tests/ -v`)
- [ ] Lint is clean (`ruff check app/ tests/`)
- [ ] New behaviour is covered by at least one test
- [ ] `.env.example` updated if new env vars were added
- [ ] No secrets or `.env` files committed

## Adding a new platform

1. Create `app/services/platforms/<platform>.py` implementing `BasePlatformClient` (`post` + `get_metrics`)
2. Add OAuth / auth connect endpoints to `app/routers/platforms.py`
3. Add a UI card to `app/templates/platforms/list.html`
4. Register the client in the `PLATFORM_CLIENTS` dicts in `app/routers/posts.py` and `app/routers/analytics.py`
5. Add a platform-specific system prompt to `app/services/content_generator.py`
6. Add any new env vars to `.env.example` and `app/config.py`
7. Add tests under `tests/`

## Code style

- Async throughout — use `httpx.AsyncClient` and `AsyncSession`
- No new comments unless the *why* is non-obvious
- No bare `except Exception` without re-raising or logging
- Keep each router focused; business logic belongs in `services/`
