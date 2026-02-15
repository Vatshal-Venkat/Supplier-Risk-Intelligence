from fastapi import APIRouter, Response, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User

from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
    require_admin,
    hash_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ------------------------
# LOGIN
# ------------------------
@router.post("/login")
def login(data: dict, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data["username"]).first()

    if not user or user.password != data["password"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access = create_access_token(
        {"sub": user.username, "role": user.role}
    )

    refresh = create_refresh_token(
        {"sub": user.username, "role": user.role}
    )

    response.set_cookie(
        key="access_token",
        value=access,
        httponly=True,
        samesite="lax",
        secure=False,  # True in production
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        samesite="lax",
        secure=False,
    )

    return {"message": "Logged in"}


# ------------------------
# GET CURRENT USER
# ------------------------
@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
    }


# ------------------------
# REFRESH TOKEN
# ------------------------
@router.post("/refresh")
def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = verify_token(refresh_token, "refresh")

    access = create_access_token(
        {"sub": payload["sub"], "role": payload.get("role")}
    )

    response.set_cookie(
        key="access_token",
        value=access,
        httponly=True,
        samesite="lax",
        secure=False,
    )

    return {"message": "Token refreshed"}


# ------------------------
# LOGOUT
# ------------------------
@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


# ------------------------
# ADMIN LOCKED ROUTE
# ------------------------
@router.get("/config")
def get_config(user: User = Depends(require_admin)):
    return {"secure": True}


@router.post("/register")
def register(data: dict, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == data["username"]).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Create organization
    org = Organization(name=data["organization"])
    db.add(org)
    db.flush()

    user = User(
        username=data["username"],
        password=hash_password(data["password"]),
        role="ADMIN",
        organization_id=org.id,
    )

    db.add(user)
    db.commit()

    return {"message": "User registered"}
