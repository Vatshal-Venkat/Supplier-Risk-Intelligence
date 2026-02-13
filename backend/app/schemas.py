from pydantic import BaseModel
from typing import Optional

class SupplierCreate(BaseModel):
    name: str
    country: Optional[str] = None
    industry: Optional[str] = None


class SupplierResponse(BaseModel):
    id: int
    name: str
    country: Optional[str]
    industry: Optional[str]

    class Config:
        from_attributes = True
