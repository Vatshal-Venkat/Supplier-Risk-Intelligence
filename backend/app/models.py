from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from sqlalchemy import JSON


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="VIEWER")  # viewer | admin
    created_at = Column(DateTime, default=datetime.utcnow)


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    country = Column(String, nullable=True)
    industry = Column(String, nullable=True)

    assessments = relationship(
        "AssessmentHistory",
        back_populates="supplier",
        cascade="all, delete-orphan"
    )


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
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    risk_score = Column(Integer)
    overall_status = Column(String)
    scoring_version = Column(String, default="v1")
    created_at = Column(DateTime, default=datetime.utcnow)

    supplier = relationship(
        "Supplier",
        back_populates="assessments"
    )


class ScoringConfig(Base):
    __tablename__ = "scoring_config"

    id = Column(Integer, primary_key=True)
    sanctions_weight = Column(Integer, default=70)
    section889_fail_weight = Column(Integer, default=30)
    section889_conditional_weight = Column(Integer, default=15)
    version = Column(String, default="v1")
    active = Column(Boolean, default=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(Integer, nullable=True)
    metadata = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)