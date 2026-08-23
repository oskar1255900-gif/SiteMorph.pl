import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UserSettings
from ..auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["Settings"])

DEFAULTS: Dict[str, Any] = {
    "display_name": "",
    "seller_name": "",
    "seller_address": "",
    "seller_nip": "",
    "seller_email": "",
    "paypal_link": "",
    "blik_phone": "",
    "iban": "",
    "invoice_footer": "",
    "theme": "light",
}


class SettingsBody(BaseModel):
    data: Dict[str, Any]


@router.get("")
def get_settings(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    row = db.query(UserSettings).filter(UserSettings.user_id == current_user["id"]).first()
    merged = dict(DEFAULTS)
    if row and row.data:
        merged.update(row.data)
    return {"settings": merged}


@router.put("")
def put_settings(body: SettingsBody, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    row = db.query(UserSettings).filter(UserSettings.user_id == current_user["id"]).first()
    if not row:
        row = UserSettings(user_id=current_user["id"], data={}, updated_at=time.time())
        db.add(row)
    merged = dict(row.data or {})
    for k, v in body.data.items():
        if k in DEFAULTS or k.startswith("x_"):
            merged[k] = v
    row.data = merged
    row.updated_at = time.time()
    db.commit()
    out = dict(DEFAULTS)
    out.update(merged)
    return {"settings": out}
