import requests
from sqlalchemy.orm import Session
from datetime import datetime
from rapidfuzz import fuzz

from app.models import GlobalEntity, SanctionedEntity, CoveredEntity


OFAC_SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv"
BIS_ENTITY_LIST_URL = "https://www.bis.doc.gov/index.php/documents/consolidated-entity-list/1072-el-entity-list-csv/file"


MATCH_THRESHOLD = 88


def normalize(text: str) -> str:
    return text.lower().replace(",", "").replace(".", "").strip()


# =====================================================
# OFAC LIVE INGESTION
# =====================================================
def refresh_ofac_data(db: Session):
    response = requests.get(OFAC_SDN_URL, timeout=30)
    response.raise_for_status()

    lines = response.text.splitlines()
    headers = lines[0].split(",")

    added_count = 0

    for line in lines[1:]:
        cols = line.split(",")
        name = cols[1] if len(cols) > 1 else None

        if not name:
            continue

        normalized = normalize(name)

        entity = db.query(GlobalEntity).filter_by(normalized_name=normalized).first()

        if not entity:
            entity = GlobalEntity(
                canonical_name=name,
                normalized_name=normalized,
                entity_type="COMPANY",
            )
            db.add(entity)
            db.commit()
            db.refresh(entity)

        existing = db.query(SanctionedEntity).filter_by(name=name).first()

        if not existing:
            sanction = SanctionedEntity(
                name=name,
                source="OFAC",
                entity_id=entity.id,
            )
            db.add(sanction)
            added_count += 1

    db.commit()
    return added_count



# =====================================================
# BIS ENTITY LIST INGESTION
# =====================================================
def refresh_bis_entity_list(db: Session):
    response = requests.get(BIS_ENTITY_LIST_URL, timeout=30)
    response.raise_for_status()

    lines = response.text.splitlines()
    headers = lines[0].split(",")

    for line in lines[1:]:
        cols = line.split(",")
        name = cols[0] if len(cols) > 0 else None

        if not name:
            continue

        normalized = normalize(name)

        entity = db.query(GlobalEntity).filter_by(normalized_name=normalized).first()

        if not entity:
            entity = GlobalEntity(
                canonical_name=name,
                normalized_name=normalized,
                entity_type="COMPANY",
            )
            db.add(entity)
            db.commit()
            db.refresh(entity)

        existing = db.query(CoveredEntity).filter_by(name=name).first()

        if not existing:
            covered = CoveredEntity(name=name)
            db.add(covered)

    db.commit()


# =====================================================
# NEWS RISK SIGNAL
# =====================================================
def news_risk_signal(supplier_name: str):
    try:
        response = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": supplier_name,
                "sortBy": "publishedAt",
                "pageSize": 5,
                "apiKey": "YOUR_NEWSAPI_KEY",
            },
            timeout=10,
        )

        data = response.json()

        risk_keywords = ["fraud", "sanction", "corruption", "bribery"]

        score = 0

        for article in data.get("articles", []):
            text = (article.get("title", "") + " " + article.get("description", "")).lower()

            for word in risk_keywords:
                if word in text:
                    score += 10

        return min(score, 30)

    except Exception:
        return 0
