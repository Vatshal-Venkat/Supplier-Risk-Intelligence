from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Supplier
from app.schemas import SupplierCreate, SupplierResponse
from rapidfuzz import fuzz
from typing import List
from app.services.sanctions_service import check_sanctions
from app.services.section889_service import evaluate_section_889


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


@router.get("/search")
def search_suppliers(query: str, db: Session = Depends(get_db)):
    suppliers = db.query(Supplier).all()

    results = []

    for supplier in suppliers:
        name = supplier.name.lower()
        q = query.lower()

        score = max(
            fuzz.ratio(q, name),
            fuzz.token_sort_ratio(q, name),
            fuzz.token_set_ratio(q, name),
            fuzz.partial_ratio(q, name)
        )

        if score > 60:
            results.append({
                "id": supplier.id,
                "name": supplier.name,
                "country": supplier.country,
                "industry": supplier.industry,
                "match_score": score
            })

    results = sorted(results, key=lambda x: x["match_score"], reverse=True)

    return results



@router.get("/{supplier_id}/sanctions")
def supplier_sanctions_check(supplier_id: int, db: Session = Depends(get_db)):
    return check_sanctions(supplier_id, db)



@router.get("/{supplier_id}/section-889")
def section_889_check(supplier_id: int, db: Session = Depends(get_db)):
    return evaluate_section_889(supplier_id, db)