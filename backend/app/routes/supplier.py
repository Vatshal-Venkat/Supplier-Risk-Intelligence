from fastapi import APIRouter, Depends, WebSocket
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Supplier, AssessmentHistory
from app.schemas import SupplierCreate, SupplierResponse
from rapidfuzz import fuzz
from typing import List
from app.services.sanctions_service import check_sanctions
from app.services.section889_service import evaluate_section_889
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
    return db.query(AssessmentHistory)\
        .filter(AssessmentHistory.supplier_id == supplier_id)\
        .order_by(AssessmentHistory.created_at.asc())\
        .all()


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
