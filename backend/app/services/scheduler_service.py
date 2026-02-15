from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import IngestionRun, Supplier
from app.services.external_intelligence_service import (
    refresh_ofac_data,
    refresh_bis_entity_list,
)
from app.services.assessment_service import run_assessment


scheduler = BackgroundScheduler()


# =====================================================
# FEED WRAPPER WITH LOGGING
# =====================================================
def run_feed_with_tracking(feed_name: str, feed_function):
    db: Session = SessionLocal()

    ingestion = IngestionRun(
        feed_name=feed_name,
        status="RUNNING",
        started_at=datetime.utcnow(),
    )

    db.add(ingestion)
    db.commit()
    db.refresh(ingestion)

    try:
        record_count = feed_function(db)

        ingestion.status = "SUCCESS"
        ingestion.record_count = record_count if record_count else 0
        ingestion.completed_at = datetime.utcnow()

    except Exception as e:
        ingestion.status = "FAILED"
        ingestion.error_message = str(e)
        ingestion.completed_at = datetime.utcnow()

    db.commit()
    db.close()


# =====================================================
# SUPPLIER RESCORING JOB
# =====================================================
def rescore_all_suppliers():
    db: Session = SessionLocal()

    suppliers = db.query(Supplier).all()

    for supplier in suppliers:
        run_assessment(supplier.id, db)

    db.close()


# =====================================================
# SCHEDULER SETUP
# =====================================================
def start_scheduler():

    # OFAC Daily Refresh
    scheduler.add_job(
        lambda: run_feed_with_tracking("OFAC", refresh_ofac_data),
        trigger="interval",
        hours=24,
        id="ofac_refresh",
        replace_existing=True,
    )

    # BIS Daily Refresh
    scheduler.add_job(
        lambda: run_feed_with_tracking("BIS", refresh_bis_entity_list),
        trigger="interval",
        hours=24,
        id="bis_refresh",
        replace_existing=True,
    )

    # Nightly Supplier Rescoring
    scheduler.add_job(
        rescore_all_suppliers,
        trigger="interval",
        hours=24,
        id="supplier_rescore",
        replace_existing=True,
    )

    scheduler.start()
