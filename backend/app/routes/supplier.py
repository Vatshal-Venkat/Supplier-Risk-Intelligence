from fastapi import APIRouter, Depends, WebSocket
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Supplier, AssessmentHistory
from app.schemas import SupplierCreate, SupplierResponse
from typing import List
from app.services.assessment_service import run_assessment
import asyncio

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.post("/", response_model=SupplierResponse)
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db)):
    db_supplier = Supplier(**supplier.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier


@router.get("/", response_model=List[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).all()


# ✅ NEW OPTIMIZED ENDPOINT
@router.get("/with-status")
def list_suppliers_with_status(db: Session = Depends(get_db)):
    suppliers = db.query(Supplier).all()
    result = []

    for supplier in suppliers:
        latest = (
            db.query(AssessmentHistory)
            .filter(AssessmentHistory.supplier_id == supplier.id)
            .order_by(AssessmentHistory.created_at.desc())
            .first()
        )

        result.append({
            "id": supplier.id,
            "name": supplier.name,
            "country": supplier.country,
            "industry": supplier.industry,
            "risk": latest.overall_status if latest else None,
        })

    return result


@router.get("/{supplier_id}/assessment")
def supplier_assessment(supplier_id: int, db: Session = Depends(get_db)):
    return run_assessment(supplier_id, db)


@router.post("/compare")
def compare_suppliers(supplier_ids: List[int], db: Session = Depends(get_db)):
    results = []
    for sid in supplier_ids:
        results.append(run_assessment(sid, db))
    return results


@router.get("/{supplier_id}/history")
def supplier_history(supplier_id: int, db: Session = Depends(get_db)):
    return (
        db.query(AssessmentHistory)
        .filter(AssessmentHistory.supplier_id == supplier_id)
        .order_by(AssessmentHistory.created_at.asc())
        .all()
    )


@router.websocket("/stream/{supplier_id}")
async def stream_supplier(websocket: WebSocket, supplier_id: int):
    await websocket.accept()
    from app.database import SessionLocal

    while True:
        db = SessionLocal()
        result = run_assessment(supplier_id, db)
        db.close()
        await websocket.send_json(result)
        await asyncio.sleep(5)
