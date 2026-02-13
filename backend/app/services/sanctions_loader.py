import csv
from sqlalchemy.orm import Session
from app.models import SanctionedEntity


def load_sanctions(db: Session, filepath: str):
    with open(filepath, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            existing = db.query(SanctionedEntity).filter_by(name=row["name"]).first()
            if not existing:
                entity = SanctionedEntity(
                    name=row["name"],
                    source=row["source"]
                )
                db.add(entity)

        db.commit()
