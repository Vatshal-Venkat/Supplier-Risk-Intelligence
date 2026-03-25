from sqlalchemy import desc
from sqlalchemy.orm import Session
from app.models import AssessmentHistory, Supplier
from app.services.sanctions_service import check_sanctions
from app.services.section889_service import evaluate_section_889
from app.services.external_intelligence_service import news_risk_signal
from app.graph.risk_propagation import propagate_risk
from app.services.scoring_engine import ScoringEngine


def generate_executive_brief(overall_status: str):
    if overall_status == "FAIL":
        return "Severe compliance exposure detected. Immediate mitigation recommended."
    if overall_status == "CONDITIONAL":
        return "Moderate compliance risk identified. Enhanced due diligence advised."
    return "No material compliance risk detected based on current screening data."


def run_assessment(supplier_id: int, db: Session, user_id: int | None = None):
    # ------------------------------------------------------------------
    # Fetch Supplier
    # ------------------------------------------------------------------
    supplier = db.query(Supplier).filter_by(id=supplier_id).first()

    if not supplier:
        return {"error": "Supplier not found"}

    supplier_name = supplier.name

    # ------------------------------------------------------------------
    # Run Individual Risk Modules
    # ------------------------------------------------------------------
    sanctions_result = check_sanctions(supplier_id, db)
    section889_result = evaluate_section_889(supplier_id, db)
    
    news_score = news_risk_signal(supplier_name)
    graph_risk = propagate_risk(supplier_name)

    # ------------------------------------------------------------------
    # Build Context for Scoring Engine
    # ------------------------------------------------------------------
    context = {
        "sanctions_hit": sanctions_result and sanctions_result.get("overall_status") == "FAIL",
        "section_889_status": section889_result.get("section_889_status") if section889_result else "PASS",
        "section_889_reason": section889_result.get("reason") if section889_result else None,
        "country": supplier.country,
        "industry": supplier.industry,
        "address": supplier.address,
        "unknown_sub_tiers": supplier.tier_level is None, # simple heuristic for unknown sub tiers
        "news_signal_score": news_score or 0,
        "graph_risk_score": graph_risk or 0,
    }

    # ------------------------------------------------------------------
    # Calculate Risk using Configurable Engine
    # ------------------------------------------------------------------
    risk_score, overall_status, breakdown_factors, config_version = ScoringEngine.calculate_risk_score(context)

    executive_brief = generate_executive_brief(overall_status)
    
    reasons = [f.get("reason") for f in breakdown_factors if f.get("triggered")]

    # ------------------------------------------------------------------
    # Data Trend & Timeline (FR-1.3.3 / FR-1.3.4)
    # ------------------------------------------------------------------
    history_records = (
        db.query(AssessmentHistory)
        .filter(AssessmentHistory.supplier_id == supplier_id)
        .order_by(desc(AssessmentHistory.created_at))
        .limit(10)
        .all()
    )

    # Risk history (chronological for chart)
    risk_history = [h.risk_score for h in reversed(history_records)]

    # Timeline events
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

    # --------------------------------------------------
    # Persist Assessment History (FULL SNAPSHOT)
    # --------------------------------------------------
    history = AssessmentHistory(
        supplier_id=supplier_id,
        initiated_by_user_id=user_id,
        risk_score=risk_score,
        overall_status=overall_status,
        sanctions_flag=context["sanctions_hit"],
        section889_status=context["section_889_status"],
        news_signal_score=context["news_signal_score"],
        graph_risk_score=context["graph_risk_score"],
        scoring_version=config_version,
        snapshot={
            "sanctions": sanctions_result,
            "section_889": section889_result,
            "news_signal_score": context["news_signal_score"],
            "graph_risk_score": context["graph_risk_score"],
            "reasons": reasons,
            "config_version": config_version,
            "factors": breakdown_factors,
            "context_used": context
        }
    )

    db.add(history)
    db.commit()

    # ------------------------------------------------------------------
    # Response Payload
    # ------------------------------------------------------------------
    return {
        "supplier": supplier_name,
        "overall_status": overall_status,
        "risk_score": risk_score,
        "sanctions": sanctions_result,
        "section_889": section889_result,
        "news_signal_score": context["news_signal_score"],
        "graph_risk_score": context["graph_risk_score"],
        "explanations": reasons,
        "executive_brief": executive_brief,
        "risk_history": risk_history,
        "timeline": timeline,
        "breakdown": {
            "factors": breakdown_factors,
            "total_scored": risk_score,
            "total_possible": 100,
            "scoring_version": config_version,
        },
    }