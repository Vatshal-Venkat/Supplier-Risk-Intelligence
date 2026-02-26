from fastapi import APIRouter, Depends, WebSocket, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio
from sqlalchemy import desc, func, case, or_
from sqlalchemy.exc import IntegrityError
from app.services.supplier_comparison_service import compare_suppliers
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
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True  # 🔥 include seeded suppliers
            )
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
        is_global=False
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
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Supplier)
        .filter(
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True  # 🔥 include seeded suppliers
            )
        )
        .order_by(desc(Supplier.id))
        .limit(limit)
        .offset(offset)
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
        .filter(
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True
            )
        )
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

    existing_suppliers = (
        db.query(Supplier)
        .filter(
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True
            )
        )
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

    # =====================================================
    # Fetch Supplier (Tenant Safe)
    # =====================================================
    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.id == supplier_id,
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True
            ),
        )
        .first()
    )

    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # =====================================================
    # Ensure Entity Resolution (hard guarantee)
    # =====================================================
    from app.services.entity_resolution_service import resolve_supplier_entity
    entity = resolve_supplier_entity(supplier, db)

    # =====================================================
    # Latest Assessment + History
    # =====================================================
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

    # =====================================================
    # Linked Global Entities (SQL View)
    # =====================================================
    linked_entities = (
        db.query(SupplierEntityLink, GlobalEntity)
        .join(GlobalEntity, SupplierEntityLink.entity_id == GlobalEntity.id)
        .filter(SupplierEntityLink.supplier_id == supplier.id)
        .all()
    )

    entity_data = []
    sanction_hits = []

    for link, linked_entity in linked_entities:

        sanctions = (
            db.query(SanctionedEntity)
            .filter(SanctionedEntity.entity_id == linked_entity.id)
            .all()
        )

        entity_info = {
            "canonical_name": linked_entity.canonical_name,
            "entity_type": linked_entity.entity_type,
            "country": linked_entity.country,
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
            sanction_hits.append(linked_entity.canonical_name)

        entity_data.append(entity_info)

    # =====================================================
    # Graph-Based Enterprise Network (GlobalEntity Rooted)
    # =====================================================
    parent_entities = []
    subsidiaries = []
    graph_summary = {"node_count": 0, "relationship_count": 0}

    try:
        with get_session() as session:

            # ---- Parent Entities ----
            parent_result = session.run(
                """
                MATCH (e:GlobalEntity {canonical_name: $name})
                      -[:RELATION {type:'SUBSIDIARY_OF'}]->
                      (parent:GlobalEntity)
                RETURN parent.canonical_name AS name
                """,
                name=entity.canonical_name,
            )

            parent_entities = [r["name"] for r in parent_result]

            # ---- Subsidiaries ----
            child_result = session.run(
                """
                MATCH (child:GlobalEntity)
                      -[:RELATION {type:'SUBSIDIARY_OF'}]->
                      (e:GlobalEntity {canonical_name: $name})
                RETURN child.canonical_name AS name
                """,
                name=entity.canonical_name,
            )

            subsidiaries = [r["name"] for r in child_result]

            # ---- Graph Summary (2-hop enterprise view) ----
            summary_result = session.run(
                """
                MATCH (e:GlobalEntity {canonical_name: $name})-[r*1..2]-(m)
                RETURN COUNT(DISTINCT m) AS nodes,
                       COUNT(DISTINCT r) AS rels
                """,
                name=entity.canonical_name,
            ).single()

            if summary_result:
                graph_summary["node_count"] = summary_result["nodes"]
                graph_summary["relationship_count"] = summary_result["rels"]

    except Exception as e:
        print(f"Graph enterprise query failed: {e}")
    # =====================================================
    # Final Response
    # =====================================================
    return {
        "supplier": {
            "id": supplier.id,
            "legal_entity_name": entity.canonical_name,
            "registration_country": entity.country,
            "industry": supplier.industry,
            "created_at": supplier.created_at,
        },
        "parent_entities": parent_entities,
        "subsidiaries": subsidiaries,
        "certifications": [],  # reserved for future extension
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
                "sanctions_flag": h.sanctions_flag,
                "section889_status": h.section889_status,
                "news_signal_score": h.news_signal_score,
                "graph_risk_score": h.graph_risk_score,
                "scoring_version": h.scoring_version,
                "initiated_by_user_id": h.initiated_by_user_id,
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
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True
            ),
        )
        .first()
    )

    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    result = run_assessment(
        supplier_id=supplier_id, 
        db=db,
        user_id=current_user.id
    )

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
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True
            ),
        )
        .order_by(AssessmentHistory.created_at.asc())
        .all()
    )

    return [
    {
        "id": h.id,
        "risk_score": h.risk_score,
        "overall_status": h.overall_status,
        "sanctions_flag": h.sanctions_flag,
        "section889_status": h.section889_status,
        "news_signal_score": h.news_signal_score,
        "graph_risk_score": h.graph_risk_score,
        "scoring_version": h.scoring_version,
        "initiated_by_user_id": h.initiated_by_user_id,
        "created_at": h.created_at,
    }
    for h in history
]
# =====================================================
# ASSESSMENT DELTA COMPARISON
# =====================================================
@router.post("/{supplier_id:int}/compare-assessments")
def compare_assessments(
    supplier_id: int,
    assessment_a_id: int,
    assessment_b_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.id == supplier_id,
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True
            ),
        )
        .first()
    )

    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    a = db.query(AssessmentHistory).filter_by(
        id=assessment_a_id,
        supplier_id=supplier_id
    ).first()
    b = db.query(AssessmentHistory).filter_by(
        id=assessment_b_id,
        supplier_id=supplier_id
    ).first()
    if not a or not b:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {
        "risk_score_delta": b.risk_score - a.risk_score,
        "sanctions_flag_delta": int(b.sanctions_flag) - int(a.sanctions_flag),
        "news_signal_delta": b.news_signal_score - a.news_signal_score,
        "graph_risk_delta": b.graph_risk_score - a.graph_risk_score,
        "section889_change": {
            "from": a.section889_status,
            "to": b.section889_status
        },
        "version_change": {
            "from": a.scoring_version,
            "to": b.scoring_version
        }
    }
# =====================================================
# LIVE STREAM
# =====================================================
@router.websocket("/stream/{supplier_id}")
async def stream_supplier(websocket: WebSocket, supplier_id: int):
    await websocket.accept()

    while True:
        db = SessionLocal()
        result = run_assessment(
            supplier_id=supplier_id, 
            db=db,
            user_id=None 
        )
        db.close()

        await websocket.send_json(result)
        await asyncio.sleep(5)

# =====================================================
# SUPPLIER COMPARISON
# =====================================================
@router.get("/compare")
def compare_two_suppliers(
    supplier_a: int,
    supplier_b: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = compare_suppliers(
        supplier_a_id=supplier_a,
        supplier_b_id=supplier_b,
        db=db,
        organization_id=current_user.organization_id,
    )
    return result