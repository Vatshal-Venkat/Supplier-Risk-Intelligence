from fastapi import APIRouter, Depends
from app.core.security import require_role

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_role("ADMIN"))],
)

@router.get("/dashboard")
def admin_dashboard():
    return {"admin": "secure"}
