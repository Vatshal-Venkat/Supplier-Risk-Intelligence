from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from typing import Optional, Dict, Any



class SupplierCreate(BaseModel):
    name: str
    country: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None
    naics_code: Optional[str] = None
    certifications: Optional[list[str]] = None


class SupplierResponse(BaseModel):
    id: int
    name: str
    country: Optional[str]
    industry: Optional[str]
    address: Optional[str] = None
    naics_code: Optional[str] = None
    certifications: Optional[list[str]] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "VIEWER"



class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource_type: str
    resource_id: Optional[int]
    details: Optional[Dict[str, Any]]
    timestamp: datetime

    class Config:
        from_attributes = True


class ScoringConfigUpdate(BaseModel):
    sanctions_weight: int
    section889_fail_weight: int
    section889_conditional_weight: int


class ScoringConfigResponse(BaseModel):
    id: int
    sanctions_weight: int
    section889_fail_weight: int
    section889_conditional_weight: int
    version: str
    active: bool

    class Config:
        from_attributes = True
