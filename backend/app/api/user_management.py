from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import User
from app.schemas import UserResponse
from app.core.security import require_admin, get_current_user

router = APIRouter(prefix="/admin/users", tags=["Admin User Management"])

@router.get("/", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """List all users in the organization."""
    return db.query(User).filter(User.organization_id == admin_user.organization_id).all()

@router.put("/{user_id}", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Update a user's role."""
    if role not in ["ADMIN", "VIEWER"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    user = db.query(User).filter(
        User.id == user_id, 
        User.organization_id == admin_user.organization_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.role = role
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Delete a user."""
    user = db.query(User).filter(
        User.id == user_id, 
        User.organization_id == admin_user.organization_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}
