from fastapi import FastAPI
from app.routes import health, supplier
from app.database import engine
from app import models
from app.database import SessionLocal
from app.services.sanctions_loader import load_sanctions
from app.services.covered_loader import load_covered_entities

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Supplier Risk PoC")


app.include_router(health.router)
app.include_router(supplier.router)

@app.get("/")
def root():
    return {"message": "Supplier Risk Backend Running"}
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = SessionLocal()
load_sanctions(db, "data/sanctions.csv")
db.close()

db = SessionLocal()
load_sanctions(db, "data/sanctions.csv")
load_covered_entities(db, "data/covered_entities.csv")
db.close()
