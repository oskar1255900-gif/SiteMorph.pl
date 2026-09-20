"""Uprawnienia konta SiteMorph.

Jedno źródło prawdy dla pakietów: `UserSettings.data["plan"]` w bazie.
Plan ustawia WYŁĄCZNIE administrator (`POST /api/admin/user/plan`), więc
kontrola dostępu nie może być oparta na localStorage, nagłówku ani treści
requestu — klient nie jest w stanie przyznać sobie pakietu.

Ten moduł czyta istniejący model pakietów, nie tworzy drugiego systemu
uprawnień. Pakiety i ich limity odpowiadają `PLANS` w `routers/admin.py`.
"""

from typing import Any, Dict, Optional

import time

from sqlalchemy.orm import Session

from .models import UserSettings
# Pakiety, które faktycznie zawierają Lead Finder (wszystkie płatne plany).
PLAN_LEAD_LIMITS: Dict[str, int] = {
    "starter": 10,
    "pro": 30,
    "business": 100,
    "agencja": 500,
}

LEAD_FINDER_REQUIRED_DETAIL = (
    "Lead Finder wymaga aktywnego pakietu. Wybierz pakiet z dostępem do Lead Findera."
)


def stored_plan(db: Session, user_id: Optional[str]) -> str:
    """Plan zapisany dla użytkownika albo pusty string (konto bez pakietu)."""
    if not user_id or user_id == "anon":
        return ""
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    data = (row.data or {}) if row else {}
    return str(data.get("plan") or "").strip().lower()


def stored_plan_expiry(db: Session, user_id: Optional[str]) -> Optional[float]:
    """Opcjonalny termin ważności pakietu (unix seconds) albo None."""
    if not user_id or user_id == "anon":
        return None
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    data = (row.data or {}) if row else {}
    raw = data.get("plan_expires_at")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def entitlement(db: Session, user_id: Optional[str], now: Optional[float] = None) -> Dict[str, Any]:
    """Uprawnienia użytkownika. `lead_finder` jest prawdą wyłącznie dla
    aktywnego pakietu — samo posiadanie kredytów nie wystarcza.

    Termin ważności: jeśli administrator zapisał `plan_expires_at`, pakiet
    przestaje działać po tej dacie. Brak daty oznacza pakiet bezterminowy
    (tak działają wszystkie plany przypisane dotąd w panelu).
    """
    plan = stored_plan(db, user_id)
    limit = PLAN_LEAD_LIMITS.get(plan)
    expires_at = stored_plan_expiry(db, user_id)
    expired = bool(expires_at and expires_at <= (time.time() if now is None else now))
    active = limit is not None and not expired
    return {
        "plan": plan or None,
        "lead_finder": active,
        "lead_limit": limit if active else 0,
        "expires_at": expires_at,
        "expired": bool(expires_at) and expired,
    }
