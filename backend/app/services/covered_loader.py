import csv
from sqlalchemy.orm import Session
from app.models import CoveredEntity


def load_covered_entities(db: Session, filepath: str):
    with open(filepath, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            existing = db.query(CoveredEntity).filter_by(name=row["name"]).first()
            if not existing:
                entity = CoveredEntity(name=row["name"])
                db.add(entity)

        db.commit()
