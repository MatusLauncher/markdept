from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.database import init_db
from app.routers import auth, campaigns, posts, platforms, analytics, pages
from app.services.scheduler import init_scheduler, shutdown_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_scheduler()
    yield
    await shutdown_scheduler()


app = FastAPI(title="Markdept", lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="app/templates")

app.include_router(auth.router)
app.include_router(campaigns.router)
app.include_router(posts.router)
app.include_router(platforms.router)
app.include_router(analytics.router)
app.include_router(pages.router)
