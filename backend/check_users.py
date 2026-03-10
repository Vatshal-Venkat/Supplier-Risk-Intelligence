from app.database import SessionLocal
from app.models import User

db = SessionLocal()
users = db.query(User).all()

print(f"Total users: {len(users)}")
for user in users:
    print(f"ID: {user.id}, Username: {user.username}, Role: {user.role}, Org ID: {user.organization_id}")

db.close()
