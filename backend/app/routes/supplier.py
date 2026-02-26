from fastapi import APIRouter, Depends, WebSocket, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio
from sqlalchemy import desc, func, text, case
from sqlalchemy.exc import IntegrityError

from app.database import get_db, SessionLocal
from app.models import (
    Supplier,
    AssessmentHistory,
    User,
    SupplierEntityLink,
    GlobalEntity,
    SanctionedEntity,
)
from app.schemas import SupplierCreate, SupplierResponse
from app.services.assessment_service import run_assessment
from app.services.audit_service import log_action
from app.core.security import get_current_user
from app.graph.supplier_graph_service import create_supplier_node
from app.graph.graph_client import get_session
from app.services.entity_resolution_service import normalize

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


# =====================================================
# SUPPLIER SEARCH (TRIGRAM + BOOSTED RANKING)
# =====================================================
@router.get("/search", response_model=List[SupplierResponse])
def search_suppliers(
    query: str = Query(..., min_length=2),
    country: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    normalized_query = normalize(query)

    similarity_score = func.similarity(
        Supplier.normalized_name,
        normalized_query
    )

    base_query = (
        db.query(
            Supplier,
            similarity_score.label("score")
        )
        .filter(
            Supplier.organization_id == current_user.organization_id
        )
    )

    if country:
        base_query = base_query.filter(Supplier.country == country)

    base_query = base_query.filter(
        similarity_score > 0.2
    )

    results = (
        base_query
        .order_by(
            desc(
                similarity_score
                + case(
                    (Supplier.normalized_name == normalized_query, 1.0),
                    else_=0.0
                )
                + case(
                    (Supplier.normalized_name.like(f"{normalized_query}%"), 0.5),
                    else_=0.0
                )
            )
        )
        .limit(limit)
        .offset(offset)
        .all()
    )

    suppliers = [row[0] for row in results]

    return suppliers

# =====================================================
# CREATE SUPPLIER
# =====================================================
@router.post("/", response_model=SupplierResponse)
def create_supplier(
    supplier: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.entity_resolution_service import resolve_supplier_entity

    normalized = normalize(supplier.name)

    existing = (
        db.query(Supplier)
        .filter(
            Supplier.organization_id == current_user.organization_id,
            Supplier.normalized_name == normalized,
            Supplier.country == supplier.country,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Supplier with same name and country already exists."
        )

    db_supplier = Supplier(
        name=supplier.name,
        normalized_name=normalized,
        country=supplier.country,
        industry=supplier.industry,
        organization_id=current_user.organization_id,
    )

    try:
        db.add(db_supplier)
        db.commit()
        db.refresh(db_supplier)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Duplicate supplier detected at database level."
        )

    resolve_supplier_entity(db_supplier, db)

    try:
        create_supplier_node(db_supplier.name)
    except Exception as e:
        print(f"⚠️ Graph node creation failed: {e}")

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
# LIST SUPPLIERS (BASIC)
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
# LIST SUPPLIERS WITH LATEST STATUS
# =====================================================
@router.get("/with-status")
def list_suppliers_with_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    suppliers = (
        db.query(Supplier)
        .filter(Supplier.organization_id == current_user.organization_id)
        .all()
    )

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


# =====================================================
# IDENTITY RESOLUTION (TENANT SAFE)
# =====================================================
@router.post("/resolve")
def resolve_supplier_identity(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = payload.get("name", "").strip()

    if len(name) < 3:
        return {"matches": []}

    # 🔒 Only search within same organization
    existing_suppliers = (
        db.query(Supplier)
        .filter(Supplier.organization_id == current_user.organization_id)
        .all()
    )

    matches = []

    for supplier in existing_suppliers:
        if name.lower() in supplier.name.lower():
            matches.append({
                "canonical_name": supplier.name,
                "confidence": 85,
                "country": supplier.country,
            })

    return {"matches": matches}


# =====================================================
# SUPPLIER PROFILE (AGGREGATED VIEW)
# =====================================================
@router.get("/{supplier_id:int}")
def get_supplier_profile(
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
        raise HTTPException(status_code=404, detail="Supplier not found")

    latest_assessment = (
        db.query(AssessmentHistory)
        .filter(AssessmentHistory.supplier_id == supplier.id)
        .order_by(desc(AssessmentHistory.created_at))
        .first()
    )

    history = (
        db.query(AssessmentHistory)
        .filter(AssessmentHistory.supplier_id == supplier.id)
        .order_by(desc(AssessmentHistory.created_at))
        .all()
    )

    linked_entities = (
        db.query(SupplierEntityLink, GlobalEntity)
        .join(GlobalEntity, SupplierEntityLink.entity_id == GlobalEntity.id)
        .filter(SupplierEntityLink.supplier_id == supplier.id)
        .all()
    )

    entity_data = []
    sanction_hits = []

    for link, entity in linked_entities:

        sanctions = (
            db.query(SanctionedEntity)
            .filter(SanctionedEntity.entity_id == entity.id)
            .all()
        )

        entity_info = {
            "canonical_name": entity.canonical_name,
            "entity_type": entity.entity_type,
            "country": entity.country,
            "confidence_score": link.confidence_score,
            "sanctions": [
                {
                    "source": s.source,
                    "program": s.program,
                }
                for s in sanctions
            ],
        }

        if sanctions:
            sanction_hits.append(entity.canonical_name)

        entity_data.append(entity_info)

    graph_summary = {"node_count": 0, "relationship_count": 0}

    try:
        with get_session() as session:
            result = session.run(
                """
                MATCH (n {name: $name})-[r*1..2]-(m)
                RETURN COUNT(DISTINCT m) as nodes,
                       COUNT(DISTINCT r) as rels
                """,
                name=supplier.name,
            ).single()

            if result:
                graph_summary["node_count"] = result["nodes"]
                graph_summary["relationship_count"] = result["rels"]

    except Exception as e:
        print(f"Graph summary failed: {e}")

    return {
        "supplier": {
            "id": supplier.id,
            "name": supplier.name,
            "country": supplier.country,
            "industry": supplier.industry,
            "created_at": supplier.created_at,
        },
        "latest_assessment": {
            "risk_score": latest_assessment.risk_score if latest_assessment else None,
            "overall_status": latest_assessment.overall_status if latest_assessment else None,
            "created_at": latest_assessment.created_at if latest_assessment else None,
        },
        "history": [
            {
                "id": h.id,
                "risk_score": h.risk_score,
                "overall_status": h.overall_status,
                "created_at": h.created_at,
            }
            for h in history
        ],
        "linked_entities": entity_data,
        "sanctioned_entities": sanction_hits,
        "graph_summary": graph_summary,
    }


# =====================================================
# SUPPLIER ASSESSMENT
# =====================================================
@router.get("/{supplier_id:int}/assessment")
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
        raise HTTPException(status_code=404, detail="Supplier not found")

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
# SUPPLIER HISTORY
# =====================================================
@router.get("/{supplier_id:int}/history")
def supplier_history(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = (
        db.query(AssessmentHistory)
        .join(Supplier)
        .filter(
            Supplier.id == supplier_id,
            Supplier.organization_id == current_user.organization_id,
        )
        .order_by(AssessmentHistory.created_at.asc())
        .all()
    )

    return history


# =====================================================
# LIVE STREAM
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
