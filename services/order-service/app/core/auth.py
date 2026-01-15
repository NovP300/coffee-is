from dataclasses import dataclass
from uuid import UUID

from jose import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError, ExpiredSignatureError


from app.core.settings import settings

security = HTTPBearer(auto_error=True)


@dataclass
class CurrentUser:
    user_id: UUID
    username: str
    role: str


def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    token = cred.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


    sub = payload.get("sub")
    username = payload.get("username")
    role = payload.get("role")

    if not sub or not username or not role:
        raise HTTPException(status_code=401, detail="Invalid token claims")

    try:
        user_id = UUID(str(sub))
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid sub claim")

    return CurrentUser(user_id=user_id, username=str(username), role=str(role))
