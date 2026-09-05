import hashlib
import hmac
import os
import time

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Lead, Project, UserSettings

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# ----------------------------------------------------------------------------
# BRAMKA "STRONA W BUDOWIE" — hasło weryfikowane WYŁĄCZNIE na backendzie.
# Konfiguracja (wystarczy JEDNA opcja, w tej kolejności):
#   1. PANEL_PASSWORD  - hasło WPROST (najprościej, np. PANEL_PASSWORD=pacek5589)
#   2. GATE_HASH       - sha256(hasła)
#   3. ADMIN_HASH      - fallback: hash hasła admina
# Frontend wysyła sha256(hasła); backend porównuje. Sesja = httpOnly cookie.
# ----------------------------------------------------------------------------
PANEL_PASSWORD = (os.getenv("PANEL_PASSWORD") or "").strip()
GATE_HASH = (os.getenv("GATE_HASH") or "").strip().lower() or (os.getenv("ADMIN_HASH") or "").strip().lower()
GATE_COOKIE = "sm_gate"
# Deterministyczna z sekretu - cookie przezywa restarty serwera
GATE_COOKIE_VALUE = hashlib.sha256(("sm_gate_v1:" + (PANEL_PASSWORD or GATE_HASH)).encode()).hexdigest()[:32]


def _gate_ok(candidate_hash: str) -> bool:
    """candidate_hash = sha256(hasla) z frontendu; pasuje PANEL_PASSWORD lub GATE_HASH."""
    c = (candidate_hash or "").strip().lower()
    if not c:
        return False
    if PANEL_PASSWORD:
        expected = hashlib.sha256(PANEL_PASSWORD.encode()).hexdigest()
        if hmac.compare_digest(c, expected):
            return True
    if GATE_HASH:
        if hmac.compare_digest(c, GATE_HASH):
            return True
    return False


class GatePayload(BaseModel):
    hash: str


@router.post("/gate/verify")
def gate_verify(payload: GatePayload, response: Response):
    if not PANEL_PASSWORD and not GATE_HASH:
        raise HTTPException(status_code=503, detail="Bramka nie jest skonfigurowana (ustaw PANEL_PASSWORD w environment)")
    if not _gate_ok(payload.hash):
        raise HTTPException(status_code=403, detail="Nieprawidłowe hasło")
    resp = JSONResponse({"ok": True})
    resp.set_cookie(
        GATE_COOKIE,
        GATE_COOKIE_VALUE,
        max_age=60 * 60 * 24 * 30,
        httponly=True,
        samesite="lax",
        secure=bool(os.getenv("VERCEL") or os.getenv("ENV") == "production"),
        path="/",
    )
    return resp


@router.get("/gate/check")
def gate_check(sm_gate: str = Cookie(None)):
    configured = bool(PANEL_PASSWORD or GATE_HASH)
    return {"unlocked": configured and bool(sm_gate) and hmac.compare_digest(sm_gate, GATE_COOKIE_VALUE)}

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
    try:
        users_count = db.query(UserSettings).count()
    except Exception:
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


# Package management
PLANS = {
    "starter": {"name": "Starter", "credits": 10, "price": 49, "monthly_credits": 10, "lead_limit": 10, "features": ["Builder podstawowy", "Lead Finder 10/mies", "3 projekty"]},
    "pro": {"name": "Pro", "credits": 50, "price": 99, "monthly_credits": 50, "lead_limit": 30, "features": ["Builder zaawansowany", "Lead Finder 30/mies", "10 projektów", "Galeria", "Animacje"]},
    "business": {"name": "Business", "credits": 200, "price": 199, "monthly_credits": 200, "lead_limit": 100, "features": ["Builder pełny", "Lead Finder 100/mies", "Nieograniczone projekty", "Team", "FAQ", "Analytics"]},
    "agencja": {"name": "Agencja", "credits": 500, "price": 499, "monthly_credits": 500, "lead_limit": 500, "features": ["Wszystko z Business", "CMS-ready", "Multi-language", "Custom domain", "Priority support"]},
}

class PlanUpdate(BaseModel):
    user_id: str
    plan: str  # starter, pro, business, agencja

@router.post("/user/plan")
def set_user_plan(body: PlanUpdate, db: Session = Depends(get_db), x_admin_hash: str = Header(None)):
    if not _hash_ok(x_admin_hash):
        raise HTTPException(status_code=403, detail="Brak dostępu")
    plan_key = body.plan.lower()
    if plan_key not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan}")
    plan = PLANS[plan_key]
    settings = db.query(UserSettings).filter(UserSettings.user_id == body.user_id).first()
    if not settings:
        settings = UserSettings(user_id=body.user_id, data={}, credits=plan["credits"])
        db.add(settings)
    else:
        settings.credits = plan["credits"]
        if not settings.data:
            settings.data = {}
        settings.data["plan"] = plan_key
        settings.data["plan_updated_at"] = time.time()
    db.commit()
    return {"status": "ok", "user_id": body.user_id, "plan": plan_key, "credits": plan["credits"]}

@router.get("/plans")
def get_plans(x_admin_hash: str = Header(None)):
    if not _hash_ok(x_admin_hash):
        raise HTTPException(status_code=403, detail="Brak dostępu")
    return {"plans": PLANS}

@router.get("/users")
def list_users(db: Session = Depends(get_db), x_admin_hash: str = Header(None), limit: int = 100, offset: int = 0):
    if not _hash_ok(x_admin_hash):
        raise HTTPException(status_code=403, detail="Brak dostępu")
    users = db.query(UserSettings).offset(offset).limit(limit).all()
    return {
        "users": [
            {
                "user_id": u.user_id,
                "plan": (u.data or {}).get("plan", "starter"),
                "credits": u.credits,
                "pages": 0,  # would need to query projects
                "spent": "0 zł",
                "joined": time.strftime("%d.%m.%Y", time.localtime(u.updated_at)) if u.updated_at else "—",
            }
            for u in users
        ]
    }
