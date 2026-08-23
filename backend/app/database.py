import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Supabase Postgres gdy ustawisz DATABASE_URL, inaczej lokalny SQLite (dev)
# Na Vercel filesystem jest read-only poza /tmp
if os.getenv("VERCEL"):
    _default_db = "sqlite:////tmp/sitemorph.db"
else:
    _default_db = "sqlite:///./sitemorph.db"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", _default_db)

# SQLite wymaga check_same_thread, Postgres nie
connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
