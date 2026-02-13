from fastapi import FastAPI
from app.routes import health
from app.database import engine
from app import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Supplier Risk PoC")

app.include_router(health.router)

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
