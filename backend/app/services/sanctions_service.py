from sqlalchemy.orm import Session
from rapidfuzz import fuzz
from app.models import Supplier, SanctionedEntity


def check_sanctions(supplier_id: int, db: Session):
    supplier = db.query(Supplier).filter_by(id=supplier_id).first()

    if not supplier:
        return {"error": "Supplier not found"}

    matches = []
    sanctions = db.query(SanctionedEntity).all()

    highest_score = 0

    for entity in sanctions:
        score = max(
            fuzz.token_set_ratio(supplier.name.lower(), entity.name.lower()),
            fuzz.partial_ratio(supplier.name.lower(), entity.name.lower())
        )

        if score > 75:
            matches.append({
                "sanctioned_name": entity.name,
                "source": entity.source,
                "match_score": score
            })

            if score > highest_score:
                highest_score = score

    if matches:
        return {
            "supplier": supplier.name,
            "overall_status": "FAIL",
            "risk_score": 100,
            "reason": "Supplier matched sanctions list",
            "matches": matches
        }

    return {
        "supplier": supplier.name,
        "overall_status": "PASS",
        "risk_score": 10,
        "reason": "No sanctions match found",
        "matches": []
    }
