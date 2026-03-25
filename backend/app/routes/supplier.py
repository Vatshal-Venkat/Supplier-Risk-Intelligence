from fastapi import APIRouter, Depends, WebSocket, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio
from sqlalchemy import desc, func, case, or_, literal_column
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
    AuditLog,
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
    query: Optional[str] = Query(None),
    country: Optional[str] = None,
    industry: Optional[str] = None,
    city: Optional[str] = None,
    naics_code: Optional[str] = None,
    part_number: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if query:
        normalized_query = normalize(query)
        # Multi-field similarity scoring
        name_sim = func.similarity(Supplier.normalized_name, normalized_query)
        industry_sim = func.similarity(Supplier.industry, normalized_query)
        country_sim = func.similarity(Supplier.country, normalized_query)
        
        search_score = (
            (name_sim * 2.0) +
            (industry_sim * 1.5) +
            (country_sim * 1.0)
        ).label("search_score")
    else:
        # Default score if no query is provided
        search_score = literal_column("1.0").label("search_score")

    base_query = (
        db.query(Supplier, search_score)
        .filter(
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True
            )
        )
    )

    # Explicit filters
    if country:
        base_query = base_query.filter(Supplier.country.ilike(f"%{country}%"))
    
    if industry:
        base_query = base_query.filter(Supplier.industry.ilike(f"%{industry}%"))

    if city:
        base_query = base_query.filter(Supplier.address.ilike(f"%{city}%"))

    if naics_code:
        base_query = base_query.filter(Supplier.naics_code.ilike(f"%{naics_code}%"))

    # Relevancy threshold
    if query:
        search_pattern = f"%{query}%"
        base_query = base_query.filter(
            or_(
                func.similarity(Supplier.normalized_name, normalize(query)) > 0.15,
                func.similarity(Supplier.industry, query) > 0.3,
                func.similarity(Supplier.country, query) > 0.4,
                Supplier.address.ilike(search_pattern),
                Supplier.naics_code.ilike(search_pattern)
            )
        )

    # Order by score + boosts
    if query:
        normalized_query = normalize(query)
        order_expr = desc(
            search_score
            + case((Supplier.normalized_name == normalized_query, 2.0), else_=0.0)
            + case((Supplier.industry == query, 3.0), else_=0.0)
            + case((Supplier.country == query, 1.0), else_=0.0)
        )
    else:
        order_expr = desc(Supplier.id) # Default ordering if no query

    results = (
        base_query
        .order_by(order_expr)
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
        address=supplier.address,
        naics_code=supplier.naics_code,
        certifications=supplier.certifications,
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
            "address": supplier.address,
            "naics_code": supplier.naics_code,
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
                "supplier_id": supplier.id,
                "canonical_name": supplier.name,
                "confidence": 85,
                "country": supplier.country or "Unknown",
                "industry": supplier.industry or "Unknown",
                "address": supplier.address or None,
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
            "address": supplier.address,
            "naics_code": supplier.naics_code,
            "created_at": supplier.created_at,
        },
        "parent_entities": parent_entities,
        "subsidiaries": subsidiaries,
        "certifications": supplier.certifications or [],
        "latest_assessment": {
            "risk_score": latest_assessment.risk_score,
            "overall_status": latest_assessment.overall_status,
            "created_at": latest_assessment.created_at,
        } if latest_assessment else None,
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
import json
from fastapi.encoders import jsonable_encoder
from app.worker.celery_app import redis_client
from app.worker.tasks import run_assessment_task


def _get_supplier_audit_log(db: Session, supplier_id: int):
    """Fetch audit trail entries for a supplier, formatted for the frontend."""
    logs = (
        db.query(AuditLog)
        .outerjoin(User, AuditLog.user_id == User.id)
        .filter(
            AuditLog.resource_type == "Supplier",
            AuditLog.resource_id == supplier_id,
        )
        .order_by(AuditLog.timestamp.desc())
        .limit(50)
        .all()
    )

    result = []
    for log in logs:
        actor = "System"
        if log.user:
            actor = log.user.username
        result.append({
            "actor": actor,
            "action": log.action,
            "timestamp": log.timestamp.isoformat() if log.timestamp else "",
        })
    return result

def _attach_historical_data(db: Session, supplier_id: int, result: dict):
    """Fallback to ensure timeline and risk history are present even if cached/celery payload lacks it."""
    if "risk_history" in result and "timeline" in result:
        return result
        
    history_records = (
        db.query(AssessmentHistory)
        .filter(AssessmentHistory.supplier_id == supplier_id)
        .order_by(desc(AssessmentHistory.created_at))
        .limit(10)
        .all()
    )

    result["risk_history"] = [h.risk_score for h in reversed(history_records)]
    
    timeline = []
    for h in history_records:
        severity = "LOW"
        if h.overall_status == "FAIL":
            severity = "HIGH"
        elif h.overall_status == "CONDITIONAL":
            severity = "MEDIUM"
        timeline.append({
            "timestamp": h.created_at.strftime("%Y-%m-%d %H:%M"),
            "label": f"Risk Assessment Completed: {h.overall_status} ({h.risk_score}/100)",
            "severity": severity
        })
    result["timeline"] = timeline
    return result

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

    # [1] FAST CACHE SLA: Attempt to load from Redis cache in < 1 second.
    cache_key = f"assessment:cached:{supplier_id}"
    cached_data = redis_client.get(cache_key)
    
    if cached_data:
        try:
            cached_result = json.loads(cached_data)

            # Audit trail: log even when serving from cache
            log_action(
                db=db,
                user_id=current_user.id,
                action="VIEW_CACHED_ASSESSMENT",
                resource_type="Supplier",
                resource_id=supplier_id,
                details={"result": cached_result.get("overall_status"), "source": "cache"},
            )

            # Attach live audit trail to cached response
            cached_result["audit_log"] = _get_supplier_audit_log(db, supplier_id)
            
            # Ensure historical data is attached
            return _attach_historical_data(db, supplier_id, cached_result)
        except json.JSONDecodeError:
            pass # Fallback to re-running if cache corrupt

    # [2] FIRST TIME SLA: Delegate heavy compute to a Celery worker pool
    celery_task = run_assessment_task.delay(supplier_id, current_user.id)
    
    # Wait for the Celery task (SLA 2-3 mins bounded naturally)
    result = celery_task.get(timeout=240) 

    # Handle errors from the task natively
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    # Ensure JSON seriazibility
    result = jsonable_encoder(result)

    log_action(
        db=db,
        user_id=current_user.id,
        action="RUN_ASSESSMENT",
        resource_type="Supplier",
        resource_id=supplier_id,
        details={"result": result.get("overall_status")},
    )

    # Attach audit trail to fresh assessment response
    result["audit_log"] = _get_supplier_audit_log(db, supplier_id)

    # Ensure historical data is attached
    return _attach_historical_data(db, supplier_id, result)
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
    
    # ---------------------------------------------------------------
    # Deep Snapshot Comparison (FR-1.3.4 Enhancements)
    # ---------------------------------------------------------------
    snap_a = a.snapshot or {}
    snap_b = b.snapshot or {}

    # Sanctions Delta Details
    matches_a = { (m.get("source"), m.get("checked_name")): m for m in snap_a.get("sanctions", {}).get("matches", []) }
    matches_b = { (m.get("source"), m.get("checked_name")): m for m in snap_b.get("sanctions", {}).get("matches", []) }
    
    new_sanctions = [m for k, m in matches_b.items() if k not in matches_a]
    removed_sanctions = [m for k, m in matches_a.items() if k not in matches_b]

    # Factor Analysis
    factors_a = { f.get("key"): f for f in snap_a.get("factors", []) }
    factors_b = { f.get("key"): f for f in snap_b.get("factors", []) }
    
    factor_changes = []
    for key in set(factors_a.keys()) | set(factors_b.keys()):
        fa = factors_a.get(key, {})
        fb = factors_b.get(key, {})
        if fa.get("points") != fb.get("points") or fa.get("triggered") != fb.get("triggered"):
            factor_changes.append({
                "key": key,
                "label": fb.get("label") or fa.get("label"),
                "from_points": fa.get("points", 0),
                "to_points": fb.get("points", 0),
                "from_triggered": fa.get("triggered", False),
                "to_triggered": fb.get("triggered", False)
            })

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
        },
        "details": {
            "new_sanctions": new_sanctions,
            "removed_sanctions": removed_sanctions,
            "factor_changes": factor_changes,
            "new_reasons": [r for r in snap_b.get("reasons", []) if r not in snap_a.get("reasons", [])],
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


# =====================================================
# PUBLIC DATA AGGREGATION (FREE OSINT)
# =====================================================
from app.services.public_data_service import aggregate_public_data

@router.get("/{supplier_id:int}/public-data")
def get_supplier_public_data(
    supplier_id: int,
    news_months: int = Query(12, ge=1, le=36),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate publicly available data for a supplier:
    - Sanctions lists (OFAC SDN, BIS Denied Parties, EU sanctions)
    - Trade/import records (US Census)
    - Corporate filings (SEC EDGAR)
    - Recent news (GNews, configurable time window)

    Results are cached in Redis for 6 hours.
    """
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

    # ── Redis cache (6-hour TTL) ──
    cache_key = f"public_data:{supplier_id}"
    cached = redis_client.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except json.JSONDecodeError:
            pass

    # ── Fresh aggregation ──
    result = aggregate_public_data(
        name=supplier.name,
        country=supplier.country or "",
        news_months=news_months,
    )

    # Cache for 6 hours
    try:
        redis_client.setex(cache_key, 21600, json.dumps(result))
    except Exception as e:
        print(f"⚠️ Redis cache write failed: {e}")

    log_action(
        db=db,
        user_id=current_user.id,
        action="VIEW_PUBLIC_DATA",
        resource_type="Supplier",
        resource_id=supplier_id,
        details={"sanctions_flagged": result.get("sanctions", {}).get("flagged", False)},
    )

    return result

# =====================================================
# DOCUMENT EXTRACTION — PDF → ENTITIES (FR-1.2.3)
# =====================================================
from app.services.document_extraction_service import extract_entities_from_filing

class DocumentExtractRequest(BaseModel):
    pdf_url: str

@router.post("/{supplier_id:int}/document-extract")
def extract_filing_entities(
    supplier_id: int,
    payload: DocumentExtractRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Download a PDF filing URL provided by the user, extract its text,
    run NER and return structured entities with confidence scores (0-1).
    """
    supplier = (
        db.query(Supplier)
        .filter(
            Supplier.id == supplier_id,
            or_(
                Supplier.organization_id == current_user.organization_id,
                Supplier.is_global == True,
            ),
        )
        .first()
    )

    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    result = extract_entities_from_filing(
        pdf_url=payload.pdf_url,
        supplier_name=supplier.name,
    )

    log_action(
        db=db,
        user_id=current_user.id,
        action="EXTRACT_FILING_ENTITIES",
        resource_type="Supplier",
        resource_id=supplier_id,
        details={"pdf_url": payload.pdf_url, "entity_count": len(result.get("entities", []))},
    )

    return result

