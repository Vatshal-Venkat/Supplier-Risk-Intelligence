from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import health, supplier
from app.database import engine, SessionLocal
from app import models
from app.services.sanctions_loader import load_sanctions
from app.services.covered_loader import load_covered_entities

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Supplier Risk Intelligence Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(supplier.router)


@app.get("/")
def root():
    return {"message": "Supplier Risk Backend Running"}


@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    load_sanctions(db, "data/sanctions.csv")
    load_covered_entities(db, "data/covered_entities.csv")
    db.close()
