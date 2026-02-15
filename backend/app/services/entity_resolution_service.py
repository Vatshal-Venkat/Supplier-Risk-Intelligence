from rapidfuzz import fuzz
from sqlalchemy.orm import Session
from app.models import (
    GlobalEntity,
    GlobalEntityAlias,
    Supplier,
    SupplierEntityLink,
)

MATCH_THRESHOLD_HIGH = 90
MATCH_THRESHOLD_MEDIUM = 80


def normalize(text: str) -> str:
    return text.lower().replace(",", "").replace(".", "").strip()


def resolve_supplier_entity(supplier: Supplier, db: Session):
    normalized = normalize(supplier.name)

    supplier.normalized_name = normalized

    entities = db.query(GlobalEntity).all()

    best_match = None
    highest_score = 0

    for entity in entities:
        score = fuzz.token_set_ratio(
            normalized,
            entity.normalized_name
        )

        if score > highest_score:
            highest_score = score
            best_match = entity

    if best_match and highest_score >= MATCH_THRESHOLD_MEDIUM:
        link = SupplierEntityLink(
            supplier_id=supplier.id,
            entity_id=best_match.id,
            confidence_score=highest_score,
            resolution_method="AUTO",
        )
        db.add(link)
        db.commit()

        return {
            "resolved": True,
            "entity": best_match.canonical_name,
            "confidence": highest_score,
        }

    return {
        "resolved": False,
        "confidence": highest_score,
    }
