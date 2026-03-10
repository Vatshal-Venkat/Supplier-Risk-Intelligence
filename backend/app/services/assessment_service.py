from sqlalchemy.orm import Session
from app.models import AssessmentHistory, ScoringConfig, Supplier
from app.services.sanctions_service import check_sanctions
from app.services.section889_service import evaluate_section_889
from app.services.external_intelligence_service import news_risk_signal
from app.graph.risk_propagation import propagate_risk


def generate_executive_brief(overall_status: str):
    if overall_status == "FAIL":
        return "Severe compliance exposure detected. Immediate mitigation recommended."
    if overall_status == "CONDITIONAL":
        return "Moderate compliance risk identified. Enhanced due diligence advised."
    return "No material compliance risk detected based on current screening data."


def get_active_scoring_config(db: Session):
    config = db.query(ScoringConfig).filter_by(active=True).first()

    if not config:
        config = ScoringConfig(
            sanctions_weight=70,
            section889_fail_weight=30,
            section889_conditional_weight=15,
            version="v2",
            active=True,
        )
        db.add(config)
        db.commit()
        db.refresh(config)

    return config


def calculate_overall_status(risk_score: int):
    if risk_score >= 75:
        return "FAIL"
    elif risk_score >= 40:
        return "CONDITIONAL"
    else:
        return "PASS"


def run_assessment(supplier_id: int, db: Session, user_id: int | None = None):

    # ------------------------------------------------------------------
    # Fetch Supplier
    # ------------------------------------------------------------------
    supplier = db.query(Supplier).filter_by(id=supplier_id).first()

    if not supplier:
        return {"error": "Supplier not found"}

    supplier_name = supplier.name

    # ------------------------------------------------------------------
    # Load Scoring Configuration
    # ------------------------------------------------------------------
    config = get_active_scoring_config(db)

    # ------------------------------------------------------------------
    # Run Individual Risk Modules
    # ------------------------------------------------------------------
    sanctions_result = check_sanctions(supplier_id, db)
    section889_result = evaluate_section_889(supplier_id, db)

    # ------------------------------------------------------------------
    # Risk Aggregation
    # ------------------------------------------------------------------
    risk_score = 0
    reasons = []

    # ------------------ Sanctions ------------------
    if sanctions_result and sanctions_result.get("overall_status") == "FAIL":
        risk_score += config.sanctions_weight
        reasons.append("Sanctions exposure detected")

    # ------------------ Section 889 ------------------
    section_status = section889_result.get("section_889_status")

    if section_status == "FAIL":
        risk_score += config.section889_fail_weight
        reasons.append(section889_result.get("reason"))

    elif section_status == "CONDITIONAL":
        risk_score += config.section889_conditional_weight
        reasons.append(section889_result.get("reason"))

    # ------------------ External Intelligence (News) ------------------
    news_score = news_risk_signal(supplier_name)

    if news_score and news_score > 0:
        risk_score += news_score
        reasons.append("Negative media signal detected")

    # ------------------ Graph Propagation Risk ------------------
    graph_risk = propagate_risk(supplier_name)

    if graph_risk and graph_risk > 0:
        risk_score += graph_risk
        reasons.append("Graph-based relationship risk detected")

    # ------------------------------------------------------------------
    # Normalize Risk Score
    # ------------------------------------------------------------------
    risk_score = min(int(risk_score), 100)

    overall_status = calculate_overall_status(risk_score)

    executive_brief = generate_executive_brief(overall_status)

# ------------------------------------------------------------------
# Persist Assessment History (FULL SNAPSHOT)
# ------------------------------------------------------------------
    history = AssessmentHistory(
        supplier_id=supplier_id,
        initiated_by_user_id=user_id,
        risk_score=risk_score,
        overall_status=overall_status,
        sanctions_flag=(
            sanctions_result.get("overall_status") == "FAIL"
            if sanctions_result else False
        ),
        section889_status=section_status,
        news_signal_score=news_score or 0,
        graph_risk_score=graph_risk or 0,
        scoring_version=config.version,
        snapshot={
            "sanctions": sanctions_result,
            "section_889": section889_result,
            "news_signal_score": news_score,
            "graph_risk_score": graph_risk,
            "reasons": reasons,
            "config_version": config.version,
        }
    )

    db.add(history)
    db.commit()

    # ------------------------------------------------------------------
    # Build Structured Breakdown Factors
    # ------------------------------------------------------------------
    sanctions_triggered = bool(
        sanctions_result and sanctions_result.get("overall_status") == "FAIL"
    )
    sanctions_points = config.sanctions_weight if sanctions_triggered else 0

    s889_points = (
        config.section889_fail_weight if section_status == "FAIL"
        else (config.section889_conditional_weight if section_status == "CONDITIONAL" else 0)
    )
    s889_triggered = section_status in ("FAIL", "CONDITIONAL")

    news_points = news_score or 0
    news_triggered = news_points > 0

    graph_points = graph_risk or 0
    graph_triggered = graph_points > 0

    breakdown_factors = [
        {
            "key": "sanctions",
            "label": "Sanctions & Watchlists",
            "weight": config.sanctions_weight,
            "max_points": config.sanctions_weight,
            "points": sanctions_points,
            "triggered": sanctions_triggered,
            "reason": (
                "Active sanctions match detected on one or more watchlists"
                if sanctions_triggered
                else "No sanctions or watchlist matches found"
            ),
        },
        {
            "key": "section_889",
            "label": "Section 889 Compliance",
            "weight": config.section889_fail_weight,
            "max_points": config.section889_fail_weight,
            "points": s889_points,
            "triggered": s889_triggered,
            "status": section_status or "PASS",
            "reason": (
                section889_result.get("reason", "Section 889 compliance issue detected")
                if s889_triggered
                else "No Section 889 compliance issues found"
            ),
        },
        {
            "key": "news",
            "label": "Negative Media Signal",
            "weight": 50,
            "max_points": 50,
            "points": news_points,
            "triggered": news_triggered,
            "reason": (
                f"Negative media signal detected (score: {news_points})"
                if news_triggered
                else "No negative media signals detected"
            ),
        },
        {
            "key": "graph",
            "label": "Network & Graph Risk",
            "weight": 50,
            "max_points": 50,
            "points": graph_points,
            "triggered": graph_triggered,
            "reason": (
                f"Graph-based relationship risk detected ({graph_points} pts from connected entities)"
                if graph_triggered
                else "No elevated risk from entity network relationships"
            ),
        },
    ]

    # ------------------------------------------------------------------
    # Response Payload
    # ------------------------------------------------------------------
    return {
        "supplier": supplier_name,
        "overall_status": overall_status,
        "risk_score": risk_score,
        "sanctions": sanctions_result,
        "section_889": section889_result,
        "news_signal_score": news_score,
        "graph_risk_score": graph_risk,
        "explanations": reasons,
        "executive_brief": executive_brief,
        "breakdown": {
            "factors": breakdown_factors,
            "total_scored": risk_score,
            "total_possible": 100,
            "scoring_version": config.version,
        },
    }