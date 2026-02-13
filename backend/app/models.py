from sqlalchemy import Column, Integer, String
from app.database import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    country = Column(String, nullable=True)
    industry = Column(String, nullable=True)
