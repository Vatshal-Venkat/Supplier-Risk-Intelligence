import sys
import os

sys.path.append(os.getcwd())

from app.database import SessionLocal
from app.models import Supplier, Organization, User
from app.services.sanctions_service import check_sanctions

db = SessionLocal()

# create org and user if not exists
org = db.query(Organization).first()
if not org:
    org = Organization(name="Test Org")
    db.add(org)
    db.commit()

user = db.query(User).first()
if not user:
    user = User(username="test", hashed_password="pw", organization_id=org.id)
    db.add(user)
    db.commit()

# create a sanctioned supplier
s = db.query(Supplier).filter_by(name="HUAWEI TECHNOLOGIES CO., LTD.").first()
if not s:
    from app.services.entity_resolution_service import normalize as norm
    s = Supplier(name="HUAWEI TECHNOLOGIES CO., LTD.", normalized_name=norm("HUAWEI TECHNOLOGIES CO., LTD."), organization_id=org.id, country="CN")
    db.add(s)
    db.commit()

print(f"Checking sanctions for {s.name} (ID: {s.id})")
result = check_sanctions(s.id, db)
print("Result:", result)
