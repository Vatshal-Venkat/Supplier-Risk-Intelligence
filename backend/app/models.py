from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean,
    JSON,
    UniqueConstraint,
    BigInteger,
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
# GLOBAL CANONICAL ENTITY (MASTER ENTITY TABLE)
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
    covered_designations = relationship("CoveredEntity", back_populates="entity")


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
        UniqueConstraint(
            "organization_id",
            "normalized_name",
            "country",
            name="uq_supplier_org_normalized",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Core identity
    name = Column(String, nullable=False)
    normalized_name = Column(String, index=True, nullable=False)

    country = Column(String, nullable=True)
    industry = Column(String, nullable=True)

    # Dataset enrichment fields
    address = Column(String, nullable=True)
    naics_code = Column(String, nullable=True)
    certifications = Column(JSON, nullable=True)
    annual_revenue = Column(BigInteger, nullable=True)
    ownership_type = Column(String, nullable=True)
    parent_company = Column(String, nullable=True)
    tier_level = Column(Integer, nullable=True)

    # Multi-tenant + Global separation
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=True,   # 🔥 must allow NULL for global suppliers
    )

    is_global = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="suppliers")
    assessments = relationship(
        "AssessmentHistory",
        back_populates="supplier",
        cascade="all, delete-orphan",
    )
    entity_links = relationship(
        "SupplierEntityLink",
        back_populates="supplier",
    )


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
# SANCTIONED ENTITY (OFAC / BIS / etc.)
# =====================================================
class SanctionedEntity(Base):
    __tablename__ = "sanctioned_entities"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, nullable=False)  # OFAC | BIS | UN | EU | etc.
    program = Column(String, nullable=True)

    entity_id = Column(Integer, ForeignKey("global_entities.id"), nullable=False)

    entity = relationship("GlobalEntity", back_populates="sanctions")


# =====================================================
# SECTION 889 COVERED ENTITY
# =====================================================
class CoveredEntity(Base):
    __tablename__ = "covered_entities"

    id = Column(Integer, primary_key=True, index=True)

    designation = Column(String, nullable=False)  # e.g., "Section 889(a)(1)(B)"
    source = Column(String, default="Section 889")

    entity_id = Column(Integer, ForeignKey("global_entities.id"), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    entity = relationship("GlobalEntity", back_populates="covered_designations")


# =====================================================
# ASSESSMENT HISTORY (FULL SNAPSHOT)
# =====================================================
class AssessmentHistory(Base):
    __tablename__ = "assessment_history"

    id = Column(Integer, primary_key=True)

    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    initiated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Core Results
    risk_score = Column(Integer)
    overall_status = Column(String)

    # Component Scores (for delta comparison)
    sanctions_flag = Column(Boolean, default=False)
    section889_status = Column(String, nullable=True)
    news_signal_score = Column(Integer, default=0)
    graph_risk_score = Column(Integer, default=0)

    # Versioning
    scoring_version = Column(String, default="v1")

    # Full Raw Snapshot (future-proofing)
    snapshot = Column(JSON, nullable=True)

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


# =====================================================
# TRUST MODEL CONFIG (VERSIONED)
# =====================================================

class TrustModelConfig(Base):
    __tablename__ = "trust_model_config"

    id = Column(Integer, primary_key=True)

    model_name = Column(String, nullable=False)  # e.g. "OFAC_MODE", "DEFENSE_MODE"
    version = Column(String, nullable=False)

    relationship_weights = Column(JSON, nullable=False)
    sanction_boost = Column(Float, default=1.5)
    depth_limit = Column(Integer, default=4)
    decay_factor = Column(Float, default=1.0)

    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# =====================================================
# TRUST SCORE HISTORY
# =====================================================

class TrustScoreHistory(Base):
    __tablename__ = "trust_score_history"

    id = Column(Integer, primary_key=True)

    entity_id = Column(Integer, ForeignKey("global_entities.id"))
    model_version = Column(String)
    scenario = Column(String)

    score = Column(Float)
    breakdown = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)

