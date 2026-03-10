from app.database import SessionLocal
from app.models import User, Organization
from app.core.security import hash_password

db = SessionLocal()
username = "testuser_verif"
password = "password123"

existing = db.query(User).filter(User.username == username).first()
if existing:
    db.delete(existing)
    db.commit()

org = Organization(name=f"{username}_org")
db.add(org)
db.flush()

user = User(
    username=username,
    hashed_password=hash_password(password),
    role="ADMIN",
    organization_id=org.id,
)
db.add(user)
db.commit()

print(f"Created user: {username} with password: {password}")
db.close()
