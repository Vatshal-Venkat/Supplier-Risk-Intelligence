from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models import (
    Supplier,
    AssessmentHistory,
    SupplierEntityLink,
    GlobalEntity,
    SanctionedEntity,
    CoveredEntity,
)

from app.graph.graph_client import get_session


SECTION_RANK = {
    "PASS": 0,
    "CONDITIONAL": 1,
    "FAIL": 2
}


def get_latest_assessment(supplier_id: int, db: Session):
    return (
        db.query(AssessmentHistory)
        .filter(AssessmentHistory.supplier_id == supplier_id)
        .order_by(desc(AssessmentHistory.created_at))
        .first()
    )


def get_sanctions_count(supplier_id: int, db: Session) -> int:
    return (
        db.query(SanctionedEntity)
        .join(GlobalEntity, SanctionedEntity.entity_id == GlobalEntity.id)
        .join(SupplierEntityLink, SupplierEntityLink.entity_id == GlobalEntity.id)
        .filter(SupplierEntityLink.supplier_id == supplier_id)
        .distinct()
        .count()
    )


def get_section_889_status(supplier_id: int, db: Session) -> str:
    covered = (
        db.query(CoveredEntity)
        .join(GlobalEntity, CoveredEntity.entity_id == GlobalEntity.id)
        .join(SupplierEntityLink, SupplierEntityLink.entity_id == GlobalEntity.id)
        .filter(SupplierEntityLink.supplier_id == supplier_id)
        .first()
    )

    if covered:
        return "FAIL"

    return "PASS"


def get_graph_exposure(supplier_name: str):
    try:
        with get_session() as session:
            result = session.run(
                """
                MATCH (n {name: $name})-[r*1..2]-(m)
                RETURN COUNT(DISTINCT m) as nodes,
                       COUNT(DISTINCT r) as rels
                """,
                name=supplier_name,
            ).single()

            if result:
                return result["nodes"] + result["rels"]

    except Exception:
        pass

    return 0


def normalize_metric(value, max_value=100):
    if value is None:
        return 0
    return min(value / max_value, 1.0)


def compute_weighted_score(metrics: dict):
    """
    Composite decision scoring model.
    Lower score = better supplier.
    """

    weights = {
        "risk_score": 0.40,
        "sanctions_count": 0.25,
        "section_rank": 0.20,
        "graph_exposure": 0.10,
        "news_signal": 0.05,
    }

    score = (
        normalize_metric(metrics["risk_score"], 100) * weights["risk_score"]
        + normalize_metric(metrics["sanctions_count"], 10) * weights["sanctions_count"]
        + normalize_metric(metrics["section_rank"], 2) * weights["section_rank"]
        + normalize_metric(metrics["graph_exposure"], 50) * weights["graph_exposure"]
        + normalize_metric(metrics["news_signal"], 30) * weights["news_signal"]
    )

    return round(score * 100, 2)


def compare_suppliers(
    supplier_a_id: int,
    supplier_b_id: int,
    db: Session,
    organization_id: int
):
    # ------------------------------------------------------------------
    # Tenant Isolation
    # ------------------------------------------------------------------
    supplier_a = (
        db.query(Supplier)
        .filter(
            Supplier.id == supplier_a_id,
            Supplier.organization_id == organization_id
        )
        .first()
    )

    supplier_b = (
        db.query(Supplier)
        .filter(
            Supplier.id == supplier_b_id,
            Supplier.organization_id == organization_id
        )
        .first()
    )

    if not supplier_a or not supplier_b:
        return {"error": "One or both suppliers not found in your organization"}

    # ------------------------------------------------------------------
    # Latest Assessment Snapshot
    # ------------------------------------------------------------------
    assessment_a = get_latest_assessment(supplier_a_id, db)
    assessment_b = get_latest_assessment(supplier_b_id, db)

    if not assessment_a or not assessment_b:
        return {"error": "Both suppliers must have at least one assessment"}

    # ------------------------------------------------------------------
    # Structured Metrics Extraction
    # ------------------------------------------------------------------
    metrics_a = {
        "risk_score": assessment_a.risk_score,
        "sanctions_count": get_sanctions_count(supplier_a_id, db),
        "section_rank": SECTION_RANK.get(get_section_889_status(supplier_a_id, db), 0),
        "graph_exposure": get_graph_exposure(supplier_a.name),
        "news_signal": 0  # Snapshot model — news not stored historically
    }

    metrics_b = {
        "risk_score": assessment_b.risk_score,
        "sanctions_count": get_sanctions_count(supplier_b_id, db),
        "section_rank": SECTION_RANK.get(get_section_889_status(supplier_b_id, db), 0),
        "graph_exposure": get_graph_exposure(supplier_b.name),
        "news_signal": 0
    }

    # ------------------------------------------------------------------
    # Composite Decision Score
    # ------------------------------------------------------------------
    decision_score_a = compute_weighted_score(metrics_a)
    decision_score_b = compute_weighted_score(metrics_b)

    # Lower score is better
    if decision_score_a < decision_score_b:
        winner = supplier_a.name
    elif decision_score_b < decision_score_a:
        winner = supplier_b.name
    else:
        winner = "Tie"

    delta = round(abs(decision_score_a - decision_score_b), 2)

    confidence = min(100, round(delta * 1.2, 2))

    return {
        "supplier_a": {
            "id": supplier_a.id,
            "name": supplier_a.name,
            "metrics": metrics_a,
            "decision_score": decision_score_a,
        },
        "supplier_b": {
            "id": supplier_b.id,
            "name": supplier_b.name,
            "metrics": metrics_b,
            "decision_score": decision_score_b,
        },
        "comparison": {
            "winner": winner,
            "score_difference": delta,
            "confidence_percent": confidence,
            "interpretation": (
                "Lower decision score indicates lower compliance exposure."
            ),
        },
    }