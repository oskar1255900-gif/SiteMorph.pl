from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
import hmac
import os
from ..database import get_db
from ..models import UserSettings
from ..auth import get_current_user

router = APIRouter(prefix="/api/credits", tags=["Credits"])

# Dodawanie kredytów wymaga hasha admina (inaczej każdy user dodaje sobie kredyty za darmo!)
ADMIN_HASH = (os.getenv("ADMIN_HASH") or "").strip().lower()


class CreditsResponse(BaseModel):
    credits: int


class CreditsUpdate(BaseModel):
    credits: int


def _admin_ok(candidate: str | None) -> bool:
    return bool(ADMIN_HASH) and hmac.compare_digest((candidate or "").strip().lower(), ADMIN_HASH)


@router.get("", response_model=CreditsResponse)
def get_credits(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user["id"]).first()
    if not settings:
        settings = UserSettings(user_id=current_user["id"], credits=15, data={})
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return {"credits": settings.credits}


@router.post("/add", response_model=CreditsResponse)
def add_credits(body: CreditsUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db), x_admin_hash: str | None = Header(None)):
    # SECURITY: tylko admin (lub przyszły payment webhook) może dodawać kredyty
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    if not _admin_ok(x_admin_hash):
        raise HTTPException(status_code=403, detail="Dodawanie kredytów wymaga autoryzacji administratora")
    if body.credits <= 0 or body.credits > 10000:
        raise HTTPException(status_code=400, detail="Nieprawidłowa liczba kredytów")
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user["id"]).first()
    if not settings:
        settings = UserSettings(user_id=current_user["id"], credits=body.credits, data={})
        db.add(settings)
    else:
        settings.credits += body.credits
    db.commit()
    db.refresh(settings)
    return {"credits": settings.credits}


@router.post("/set", response_model=CreditsResponse)
def set_credits(body: CreditsUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db), x_admin_hash: str | None = Header(None)):
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    if not _admin_ok(x_admin_hash):
        raise HTTPException(status_code=403, detail="Ustawianie kredytów wymaga autoryzacji administratora")
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user["id"]).first()
    if not settings:
        settings = UserSettings(user_id=current_user["id"], credits=max(0, body.credits), data={})
        db.add(settings)
    else:
        settings.credits = max(0, body.credits)
    db.commit()
    db.refresh(settings)
    return {"credits": settings.credits}