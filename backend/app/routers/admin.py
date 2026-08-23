import hmac
import os

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Lead, Project

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# SHA-256 hash hasła administratora — WYŁĄCZNIE ze zmiennej środowiskowej.
# Brak konfiguracji = endpointy admina są zablokowane (brak domyślnego hasła).
ADMIN_HASH = (os.getenv("ADMIN_HASH") or "").strip().lower()


def _hash_ok(candidate: str) -> bool:
    if not ADMIN_HASH:
        return False
    return hmac.compare_digest((candidate or "").strip().lower(), ADMIN_HASH)


class VerifyPayload(BaseModel):
    hash: str


@router.post("/verify")
def verify(payload: VerifyPayload):
    if not ADMIN_HASH:
        return {"ok": False, "message": "Panel administracyjny nie jest skonfigurowany (brak ADMIN_HASH po stronie serwera)"}
    ok = _hash_ok(payload.hash)
    return {"ok": ok, "message": "OK" if ok else "Nieprawidłowe hasło"}


@router.get("/stats")
def stats(db: Session = Depends(get_db), x_admin_hash: str = Header(None)):
    # Statystyki dostępne tylko po podaniu poprawnego hasha admina w nagłówku X-Admin-Hash
    if not _hash_ok(x_admin_hash):
        raise HTTPException(status_code=403, detail="Brak dostępu")
    try:
        leads_count = db.query(Lead).count()
    except Exception:
        leads_count = 0
    try:
        projects_count = db.query(Project).count()
    except Exception:
        projects_count = 0
    # Użytkowników liczymy na razie jako 0 (brak tabeli users)
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
