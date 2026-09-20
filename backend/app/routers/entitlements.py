"""Odczyt uprawnień konta dla interfejsu.

Frontend potrzebuje wiedzieć, czy konto ma pakiet z Lead Finderem, ZANIM
pokaże wyszukiwarkę. Endpoint jest tylko do odczytu — nie da się nim nic
sobie przyznać. Egzekwowanie i tak odbywa się na endpointach Lead Findera.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..entitlements import entitlement

router = APIRouter(prefix="/api/entitlements", tags=["Entitlements"])


@router.get("")
def get_entitlements(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    return entitlement(db, current_user["id"])
