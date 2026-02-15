from sqlalchemy.orm import Session
from app.models import AssessmentHistory, ScoringConfig
from app.services.sanctions_service import check_sanctions
from app.services.section889_service import evaluate_section_889
from app.services.external_intelligence_service import news_risk_signal


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


def run_assessment(supplier_id: int, db: Session):

    config = get_active_scoring_config(db)

    sanctions_result = check_sanctions(supplier_id, db)
    section889_result = evaluate_section_889(supplier_id, db)

    risk_score = 0
    reasons = []

    # Sanctions
    if sanctions_result.get("overall_status") == "FAIL":
        risk_score += config.sanctions_weight
        reasons.append("Sanctions exposure detected")

    # Section 889
    section_status = section889_result.get("section_889_status")

    if section_status == "FAIL":
        risk_score += config.section889_fail_weight
        reasons.append(section889_result.get("reason"))

    elif section_status == "CONDITIONAL":
        risk_score += config.section889_conditional_weight
        reasons.append(section889_result.get("reason"))

    # News signal
    supplier_name = sanctions_result.get("supplier")
    news_score = news_risk_signal(supplier_name)

    if news_score > 0:
        risk_score += news_score
        reasons.append("Negative media signal detected")

    risk_score = min(risk_score, 100)

    overall_status = calculate_overall_status(risk_score)

    executive_brief = generate_executive_brief(overall_status)

    history = AssessmentHistory(
        supplier_id=supplier_id,
        risk_score=risk_score,
        overall_status=overall_status,
        scoring_version=config.version,
    )

    db.add(history)
    db.commit()

    return {
        "supplier": supplier_name,
        "overall_status": overall_status,
        "risk_score": risk_score,
        "sanctions": sanctions_result,
        "section_889": section889_result,
        "news_signal_score": news_score,
        "explanations": reasons,
        "executive_brief": executive_brief,
    }
