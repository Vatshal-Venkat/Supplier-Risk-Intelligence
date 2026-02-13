from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Supplier

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.post("/")
def create_supplier(name: str, country: str = None, industry: str = None, db: Session = Depends(get_db)):
    supplier = Supplier(name=name, country=country, industry=industry)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/")
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).all()
