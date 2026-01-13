import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import RegisterRequest, RegisterResponse, LoginRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token

router = APIRouter(tags=["auth"])

ALLOWED_ROLES = {"CUSTOMER", "BARISTA", "MANAGER", "PROCUREMENT_MANAGER"}


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    role = req.role.upper()
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = db.scalar(select(User).where(User.username == req.username))
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()

    return RegisterResponse(user_id=str(user.user_id), username=user.username, role=user.role)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == req.username))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token(subject=str(user.user_id), role=user.role, expires_minutes=60)
    return TokenResponse(access_token=token)
