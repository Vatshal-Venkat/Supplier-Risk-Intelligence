from fastapi import APIRouter, Depends, WebSocket
from sqlalchemy.orm import Session
from typing import List
import asyncio
from sqlalchemy import desc
from app.database import get_db, SessionLocal
from app.models import Supplier, AssessmentHistory, User
from app.schemas import SupplierCreate, SupplierResponse
from app.services.assessment_service import run_assessment
from app.services.audit_service import log_action
from app.core.security import get_current_user


router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


# =====================================================
# CREATE SUPPLIER (TENANT SAFE)
# =====================================================
@router.post("/", response_model=SupplierResponse)
def create_supplier(
    supplier: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.entity_resolution_service import normalize, resolve_supplier_entity

    normalized = normalize(supplier.name)

    existing = (
        db.query(Supplier)
        .filter(
            Supplier.organization_id == current_user.organization_id,
            Supplier.normalized_name == normalized,
        )
        .first()
    )

    if existing:
        return existing

    db_supplier = Supplier(
        name=supplier.name,
        normalized_name=normalized,
        country=supplier.country,
        industry=supplier.industry,
        organization_id=current_user.organization_id,
    )

    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)

    resolve_supplier_entity(db_supplier, db)

    log_action(
        db=db,
        user_id=current_user.id,
        action="CREATE_SUPPLIER",
        resource_type="Supplier",
        resource_id=db_supplier.id,
        details={"name": db_supplier.name},
    )

    return db_supplier



# =====================================================
# LIST SUPPLIERS (TENANT SAFE)
# =====================================================
@router.get("/", response_model=List[SupplierResponse])
def list_suppliers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Supplier)
        .filter(Supplier.organization_id == current_user.organization_id)
        .all()
    )


# =====================================================
# SUPPLIER ASSESSMENT
# =====================================================
@router.get("/{supplier_id}/assessment")
def supplier_assessment(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.id == supplier_id,
            Supplier.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not supplier:
        raise Exception("Supplier not found")

    result = run_assessment(supplier_id, db)

    log_action(
        db=db,
        user_id=current_user.id,
        action="RUN_ASSESSMENT",
        resource_type="Supplier",
        resource_id=supplier_id,
        details={"result": result.get("overall_status")},
    )

    return result


# =====================================================
# SUPPLIER HISTORY (TENANT SAFE)
# =====================================================
@router.get("/{supplier_id}/history")
def supplier_history(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(AssessmentHistory)
        .join(Supplier)
        .filter(
            Supplier.id == supplier_id,
            Supplier.organization_id == current_user.organization_id,
        )
        .order_by(AssessmentHistory.created_at.asc())
        .all()
    )


# =====================================================
# STREAM
# =====================================================
@router.websocket("/stream/{supplier_id}")
async def stream_supplier(websocket: WebSocket, supplier_id: int):
    await websocket.accept()

    while True:
        db = SessionLocal()
        result = run_assessment(supplier_id, db)
        db.close()
        await websocket.send_json(result)
        await asyncio.sleep(5)


@router.get("/with-status")
def list_suppliers_with_status(db: Session = Depends(get_db)):
    suppliers = db.query(Supplier).all()

    results = []

    for supplier in suppliers:
        latest_assessment = (
            db.query(AssessmentHistory)
            .filter(AssessmentHistory.supplier_id == supplier.id)
            .order_by(desc(AssessmentHistory.created_at))
            .first()
        )

        results.append({
            "id": supplier.id,
            "name": supplier.name,
            "country": supplier.country,
            "industry": supplier.industry,
            "latest_status": latest_assessment.overall_status if latest_assessment else None,
            "risk_score": latest_assessment.risk_score if latest_assessment else None,
        })

    return results


@router.post("/resolve")
def resolve_supplier_identity(payload: dict):
    name = payload.get("name")

    # placeholder logic
    return {
        "matches": [
            {
                "canonical_name": name,
                "confidence": 0.95,
                "country": "Unknown"
            }
        ]
    }
