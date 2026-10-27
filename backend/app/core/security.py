from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import get_db


bearer_scheme = HTTPBearer(auto_error=False)


async def get_user_from_access_token(token: str, db):
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")

        if not user_id or not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token",
            )
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db["customers"].find_one({"_id": ObjectId(user_id)})
    if not user or user.get("active", True) is False:
        raise HTTPException(
            status_code=401,
            detail="User account not found or inactive",
        )
    return user


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db=Depends(get_db),
):
    if credentials is None:
        return None

    user = await get_user_from_access_token(credentials.credentials, db)
    if user.get("role", "customer") != "customer":
        raise HTTPException(
            status_code=403,
            detail="Customer access required",
        )

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db=Depends(get_db),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await get_user_from_access_token(credentials.credentials, db)


async def require_admin(
    user=Depends(get_current_user),
):
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Administrator access required",
        )

    return user


async def require_customer(
    user=Depends(get_current_user),
):
    if user.get("role", "customer") != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer access required",
        )

    return user