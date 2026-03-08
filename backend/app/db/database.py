from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from app.core.config import settings

# Ensure we use an absolute path for the SQLite database
# This prevents issues when running from different directories
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite"):
    # Convert to absolute path
    # Removes 'sqlite:///' or 'sqlite:///./'
    clean_path = db_url.replace("sqlite:///", "").replace("./", "")
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    absolute_db_path = os.path.join(base_dir, clean_path)
    db_url = f"sqlite:///{absolute_db_path}"
    print(f"Database URL: {db_url}")

# SQLite requires check_same_thread: False for FastAPI
if db_url.startswith("sqlite"):
    engine = create_engine(
        db_url, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(db_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
