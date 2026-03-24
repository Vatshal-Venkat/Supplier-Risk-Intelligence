from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ScoringConfig, User
from app.schemas import ScoringConfigUpdate, ScoringConfigResponse
from app.core.security import require_admin

router = APIRouter(prefix="/admin/scoring-config", tags=["Admin Scoring Config"])

@router.get("/", response_model=ScoringConfigResponse)
def get_scoring_config(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Fetch the active scoring configuration."""
    config = db.query(ScoringConfig).filter(ScoringConfig.active == True).first()
    if not config:
        raise HTTPException(status_code=404, detail="Active scoring config not found")
    return config

@router.post("/", response_model=ScoringConfigResponse)
def update_scoring_config(
    data: ScoringConfigUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Update weights by creating a new version and making it active."""
    # Deactivate existing active config
    db.query(ScoringConfig).filter(ScoringConfig.active == True).update({"active": False})
    
    # Create new config
    import uuid
    new_version = f"v-{str(uuid.uuid4())[:8]}"
    
    new_config = ScoringConfig(
        sanctions_weight=data.sanctions_weight,
        section889_fail_weight=data.section889_fail_weight,
        section889_conditional_weight=data.section889_conditional_weight,
        version=new_version,
        active=True
    )
    
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    return new_config
