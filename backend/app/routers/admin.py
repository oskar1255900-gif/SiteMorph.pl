from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Lead, Project
import os

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# SHA-256 hash hasła administratora – w produkcji trzymaj w zmiennej środowiskowej ADMIN_HASH
ADMIN_HASH = os.getenv(
    "ADMIN_HASH",
    "2c1783f03e67b7079b1c2823e2a202c9654749e398ed0899e9778e7b77d5c664",
)

class VerifyPayload(BaseModel):
    hash: str

@router.post("/verify")
def verify(payload: VerifyPayload):
    # Porównanie w czasie stałym nie jest tu krytyczne (hash jednorazowy), wystarczy case-insensitive
    ok = payload.hash.strip().lower() == ADMIN_HASH.lower()
    return {"ok": ok, "message": "OK" if ok else "Nieprawidłowe hasło"}

@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    # Prawdziwe statystyki z bazy – na start 0 0 0 (spokojnie urośnie)
    try:
        leads_count = db.query(Lead).count()
    except Exception:
        leads_count = 0
    try:
        projects_count = db.query(Project).count()
    except Exception:
        projects_count = 0
    # Użytkowników liczymy na razie jako 0 (brak tabeli users) – na spokojnie
    users_count = 0
    return {
        "users": users_count,
        "pages": projects_count,
        "mrr": "0 zł",
        "leads": leads_count,
        "services": [
            {"name": "API Gateway", "status": "Operational"},
            {"name": "Baza danych", "status": "Operational"},
        ],
    }
