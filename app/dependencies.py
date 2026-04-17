from typing import AsyncGenerator

from fastapi import HTTPException, Request, status
from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.user import User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


def _get_serializer() -> URLSafeSerializer:
    return URLSafeSerializer(settings.SECRET_KEY, salt="session")


def set_session(response_or_request, user_id: int) -> str:
    s = _get_serializer()
    return s.dumps({"user_id": user_id})


def get_session_user_id(request: Request) -> int | None:
    token = request.cookies.get("session")
    if not token:
        return None
    try:
        data = _get_serializer().loads(token)
        return data.get("user_id")
    except BadSignature:
        return None


async def get_current_user(request: Request) -> User:
    async with AsyncSessionLocal() as db:
        return await _load_user(request, db)


async def _load_user(request: Request, db: AsyncSession) -> User:
    user_id = get_session_user_id(request)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


async def get_optional_user(request: Request) -> User | None:
    user_id = get_session_user_id(request)
    if not user_id:
        return None
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
