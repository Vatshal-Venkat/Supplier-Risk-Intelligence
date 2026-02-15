from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean,
    JSON,
    UniqueConstraint,
    Float,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


# =====================================================
# ORGANIZATION (TENANT)
# =====================================================
class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    suppliers = relationship("Supplier", back_populates="organization", cascade="all, delete-orphan")


# =====================================================
# USER
# =====================================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="VIEWER")

    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")


# =====================================================
# GLOBAL CANONICAL ENTITY
# =====================================================
class GlobalEntity(Base):
    __tablename__ = "global_entities"

    id = Column(Integer, primary_key=True)
    canonical_name = Column(String, index=True, nullable=False)
    normalized_name = Column(String, index=True, nullable=False)
    entity_type = Column(String, default="COMPANY")  # COMPANY | INDIVIDUAL | UNKNOWN
    country = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    aliases = relationship("GlobalEntityAlias", back_populates="entity", cascade="all, delete-orphan")
    sanctions = relationship("SanctionedEntity", back_populates="entity")
    supplier_links = relationship("SupplierEntityLink", back_populates="entity")


class GlobalEntityAlias(Base):
    __tablename__ = "global_entity_aliases"

    id = Column(Integer, primary_key=True)
    entity_id = Column(Integer, ForeignKey("global_entities.id"), nullable=False)

    alias = Column(String, nullable=False)
    normalized_alias = Column(String, index=True, nullable=False)

    entity = relationship("GlobalEntity", back_populates="aliases")


# =====================================================
# SUPPLIER (TENANT SCOPED)
# =====================================================
class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = (
        UniqueConstraint("organization_id", "normalized_name", name="uq_supplier_org_normalized"),
    )

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    normalized_name = Column(String, index=True, nullable=False)

    country = Column(String, nullable=True)
    industry = Column(String, nullable=True)

    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="suppliers")
    assessments = relationship("AssessmentHistory", back_populates="supplier", cascade="all, delete-orphan")
    entity_links = relationship("SupplierEntityLink", back_populates="supplier")


class SupplierEntityLink(Base):
    __tablename__ = "supplier_entity_links"

    id = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    entity_id = Column(Integer, ForeignKey("global_entities.id"), nullable=False)

    confidence_score = Column(Float, nullable=False)
    resolution_method = Column(String, default="AUTO")  # AUTO | MANUAL

    supplier = relationship("Supplier", back_populates="entity_links")
    entity = relationship("GlobalEntity", back_populates="supplier_links")


# =====================================================
# SANCTIONED ENTITY (LINKED TO GLOBAL ENTITY)
# =====================================================
class SanctionedEntity(Base):
    __tablename__ = "sanctioned_entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    source = Column(String, nullable=False)

    entity_id = Column(Integer, ForeignKey("global_entities.id"), nullable=True)

    entity = relationship("GlobalEntity", back_populates="sanctions")


# =====================================================
# ASSESSMENT HISTORY
# =====================================================
class AssessmentHistory(Base):
    __tablename__ = "assessment_history"

    id = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)

    risk_score = Column(Integer)
    overall_status = Column(String)

    scoring_version = Column(String, default="v1")
    created_at = Column(DateTime, default=datetime.utcnow)

    supplier = relationship("Supplier", back_populates="assessments")


# =====================================================
# SCORING CONFIG
# =====================================================
class ScoringConfig(Base):
    __tablename__ = "scoring_config"

    id = Column(Integer, primary_key=True)

    sanctions_weight = Column(Integer, default=70)
    section889_fail_weight = Column(Integer, default=30)
    section889_conditional_weight = Column(Integer, default=15)

    version = Column(String, default="v1")
    active = Column(Boolean, default=True)


# =====================================================
# AUDIT LOG
# =====================================================
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(Integer, nullable=True)

    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")

# =====================================================
# INGESTION RUN TRACKING (FEED MONITORING)
# =====================================================
class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id = Column(Integer, primary_key=True)

    feed_name = Column(String, nullable=False)
    status = Column(String, nullable=False)  # SUCCESS | FAILED
    record_count = Column(Integer, default=0)

    error_message = Column(String, nullable=True)

    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
