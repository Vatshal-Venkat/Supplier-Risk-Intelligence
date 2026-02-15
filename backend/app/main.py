from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import health, supplier, audit
from app.api import auth, admin

from app.database import engine, SessionLocal
from app.models import Base
from app import models

from app.services.sanctions_loader import load_sanctions
from app.services.covered_loader import load_covered_entities


app = FastAPI(title="Supplier Risk Intelligence Platform")


# =====================================================
# CORS CONFIGURATION
# =====================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# ROUTERS
# =====================================================
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(health.router)
app.include_router(supplier.router)
app.include_router(audit.router)


# =====================================================
# ROOT
# =====================================================
@app.get("/")
def root():
    return {"message": "Supplier Risk Backend Running"}


# =====================================================
# STARTUP
# =====================================================
@app.on_event("startup")
def startup_event():

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    existing_config = db.query(models.ScoringConfig).filter(
        models.ScoringConfig.active == True
    ).first()

    if not existing_config:
        default_config = models.ScoringConfig(
            sanctions_weight=70,
            section889_fail_weight=30,
            section889_conditional_weight=15,
            version="v3",
            active=True,
        )
        db.add(default_config)
        db.commit()

    db.close()

    # START BACKGROUND SCHEDULER
    from app.services.scheduler_service import start_scheduler
    start_scheduler()
