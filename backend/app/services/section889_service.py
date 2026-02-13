from sqlalchemy.orm import Session
from rapidfuzz import fuzz
from app.models import Supplier, CoveredEntity


HIGH_RISK_COUNTRIES = ["China", "Russia", "Iran", "North Korea"]


def evaluate_section_889(supplier_id: int, db: Session):
    supplier = db.query(Supplier).filter_by(id=supplier_id).first()

    if not supplier:
        return {"error": "Supplier not found"}

    # Rule 1: Covered Entity Match
    covered_entities = db.query(CoveredEntity).all()

    for entity in covered_entities:
        score = fuzz.token_set_ratio(
            supplier.name.lower(),
            entity.name.lower()
        )

        if score > 80:
            return {
                "supplier": supplier.name,
                "section_889_status": "FAIL",
                "reason": f"Matches covered entity: {entity.name}"
            }

    # Rule 2: High Risk Country
    if supplier.country in HIGH_RISK_COUNTRIES:
        return {
            "supplier": supplier.name,
            "section_889_status": "CONDITIONAL",
            "reason": f"Supplier located in high-risk country: {supplier.country}"
        }

    return {
        "supplier": supplier.name,
        "section_889_status": "PASS",
        "reason": "No Section 889 risk indicators found"
    }
