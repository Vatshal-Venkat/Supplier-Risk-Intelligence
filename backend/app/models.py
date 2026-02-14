from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    country = Column(String, nullable=True)
    industry = Column(String, nullable=True)


class SanctionedEntity(Base):
    __tablename__ = "sanctioned_entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    source = Column(String, nullable=False)


class CoveredEntity(Base):
    __tablename__ = "covered_entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)


class AssessmentHistory(Base):
    __tablename__ = "assessment_history"

    id = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, index=True)
    risk_score = Column(Integer)
    overall_status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
