from fastapi import APIRouter, Response, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Organization
from app.schemas import UserCreate, UserLogin

from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# =====================================================
# REGISTER (Create Organization + Admin User)
# =====================================================
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):

    existing_user = db.query(User).filter(
        User.username == data.username
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    org = Organization(name=f"{data.username}_org")
    db.add(org)
    db.flush()

    user = User(
        username=data.username,
        hashed_password=hash_password(data.password),
        role="ADMIN",
        organization_id=org.id,
    )

    db.add(user)
    db.commit()

    return {"message": "User registered successfully"}


# =====================================================
# LOGIN (COOKIE-BASED AUTH)
# =====================================================
@router.post("/login")
def login(
    data: UserLogin,
    response: Response,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.username == data.username
    ).first()

    if not user or not verify_password(
        data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    access_token = create_access_token(
        {"sub": user.username, "role": user.role}
    )

    refresh_token = create_refresh_token(
        {"sub": user.username, "role": user.role}
    )

    # Access Token Cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False,  # True in production (HTTPS)
        max_age=60 * 60,  # 1 hour
    )

    # Refresh Token Cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 24 * 7,  # 7 days
    )

    return {"message": "Logged in successfully"}


# =====================================================
# GET CURRENT USER (READ FROM COOKIE)
# =====================================================
@router.get("/me")
def get_me(
    request: Request,
    db: Session = Depends(get_db)
):

    access_token = request.cookies.get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    payload = verify_token(access_token, "access")

    username = payload.get("sub")

    user = db.query(User).filter(
        User.username == username
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "organization_id": user.organization_id,
    }


# =====================================================
# REFRESH ACCESS TOKEN
# =====================================================
@router.post("/refresh")
def refresh(
    request: Request,
    response: Response,
):

    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=401,
            detail="No refresh token"
        )

    payload = verify_token(refresh_token, "refresh")

    new_access_token = create_access_token(
        {
            "sub": payload["sub"],
            "role": payload.get("role"),
        }
    )

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60,
    )

    return {"message": "Token refreshed"}


# =====================================================
# LOGOUT
# =====================================================
@router.post("/logout")
def logout(response: Response):

    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")

    return {"message": "Logged out successfully"}


# =====================================================
# ADMIN PROTECTED ROUTE
# =====================================================
@router.get("/config")
def get_config(
    request: Request,
    db: Session = Depends(get_db)
):

    access_token = request.cookies.get("access_token")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = verify_token(access_token, "access")

    if payload.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    return {"secure": True}
