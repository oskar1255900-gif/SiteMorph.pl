import os
import re
import socket
import time

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Optional, List

from ..database import get_db
from ..models import PublishedPage
from ..auth import get_current_user

router = APIRouter(prefix="/api/domains", tags=["Domains"])

# Gdzie ma wskazywać DNS klienta:
# - CUSTOM_DOMAIN_TARGET_CNAME — rekord CNAME (np. www): domena -> ten host
# - CUSTOM_DOMAIN_TARGET_IP    — rekord A (apex @):  domena -> ten adres IP serwera
TARGET_CNAME = os.getenv("CUSTOM_DOMAIN_TARGET_CNAME", "sites.sitemorph.pl")
TARGET_IP = (os.getenv("CUSTOM_DOMAIN_TARGET_IP") or "").strip()

DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*\.[a-z]{2,24}$"
)

# Własne domeny dostępne tylko w pakietach 100+ zł/mies (Pro, Business, Agencja)
DOMAIN_PLANS = {"pro", "business", "agencja", "premium"}
PLAN_UPGRADE_MSG = (
    "Własne domeny są dostępne w pakietach od 100 zł/mies (Pro, Business, Agencja). "
    "Ulepsz plan w zakładce Cennik & Plany."
)


def _require_domain_plan(x_user_plan: Optional[str]):
    plan = (x_user_plan or "").strip().lower()
    if plan not in DOMAIN_PLANS:
        raise HTTPException(status_code=403, detail=PLAN_UPGRADE_MSG)


def _normalize_domain(raw: str) -> str:
    d = (raw or "").strip().lower()
    d = re.sub(r"^https?://", "", d)
    d = re.sub(r"/.*$", "", d)
    d = d.split(":")[0].strip(".")
    if not DOMAIN_RE.match(d):
        raise HTTPException(status_code=400, detail=f"Nieprawidłowa domena: {raw!r}")
    return d


def dns_instructions(domain: str) -> dict:
    records = []
    if TARGET_IP:
        records.append({
            "type": "A",
            "name": "@",
            "value": TARGET_IP,
            "desc": "Rekord A dla domeny głównej (np. twojafirma.pl)",
        })
    if TARGET_CNAME:
        records.append({
            "type": "CNAME",
            "name": "www",
            "value": TARGET_CNAME,
            "desc": f"Rekord CNAME dla subdomeny www (www.{domain} -> {TARGET_CNAME})",
        })
    return {
        "target_cname": TARGET_CNAME,
        "target_ip": TARGET_IP,
        "records": records,
        "note": "Wpisz te rekordy w panelu swojego rejestratora domeny (gdzie kupiłeś domenę). "
                "Propagacja DNS może potrwać od kilku minut do 24 godzin.",
    }


def _resolve_ips(host: str) -> set:
    try:
        infos = socket.getaddrinfo(host.strip("."), None, family=socket.AF_INET)
        return {i[4][0] for i in infos}
    except Exception:
        return set()


def check_dns(domain: str) -> tuple:
    """Zwraca (zweryfikowana, znalezione_ipy). Domena jest zweryfikowana,
    gdy rozwiązuje się do IP naszego hostingu docelowego."""
    allowed: set = set()
    if TARGET_CNAME:
        allowed |= _resolve_ips(TARGET_CNAME)
    if TARGET_IP:
        allowed.add(TARGET_IP)
    got = _resolve_ips(domain)
    return bool(allowed & got), sorted(got)


def _get_owned_page(db: Session, page_id: str, user_id: str) -> PublishedPage:
    page = db.query(PublishedPage).filter(PublishedPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Nie znaleziono strony")
    if str(page.owner_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Brak dostępu — to nie Twoja strona")
    return page


class DomainAttach(BaseModel):
    page_id: str
    domain: str


@router.get("/mine")
def my_pages(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Lista opublikowanych stron użytkownika ze stanem podpięcia domeny."""
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    pages = (
        db.query(PublishedPage)
        .filter(PublishedPage.owner_id == current_user["id"])
        .order_by(PublishedPage.created_at.desc())
        .all()
    )
    out: List[dict] = []
    for p in pages:
        out.append({
            "id": p.id,
            "title": p.title or "(bez tytułu)",
            "url": f"/p/{p.id}",
            "custom_domain": p.custom_domain,
            "domain_verified": bool(p.domain_verified),
        })
    return {"pages": out}


@router.post("")
def attach_domain(body: DomainAttach, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user), x_user_plan: Optional[str] = Header(None)):
    """Podpięcie własnej domeny pod opublikowaną stronę. Zwraca instrukcje DNS."""
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    _require_domain_plan(x_user_plan)
    page = _get_owned_page(db, body.page_id, current_user["id"])
    domain = _normalize_domain(body.domain)
    conflict = (
        db.query(PublishedPage)
        .filter(PublishedPage.custom_domain == domain, PublishedPage.id != page.id)
        .first()
    )
    if conflict:
        raise HTTPException(status_code=409, detail="Ta domena jest już podpięta pod inną stronę")
    page.custom_domain = domain
    page.domain_verified = 0
    page.domain_verified_at = None
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ta domena jest już podpięta pod inną stronę")
    return {
        "status": "attached",
        "domain": domain,
        "page_id": page.id,
        "verified": False,
        "dns": dns_instructions(domain),
    }


@router.post("/{page_id}/verify")
def verify_domain(page_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Sprawdza DNS i oznacza domenę jako zweryfikowaną, gdy wskazuje na nasz hosting."""
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    page = _get_owned_page(db, page_id, current_user["id"])
    if not page.custom_domain:
        raise HTTPException(status_code=400, detail="Do tej strony nie podpięto żadnej domeny")
    ok, ips = check_dns(page.custom_domain)
    if ok:
        page.domain_verified = 1
        page.domain_verified_at = time.time()
        db.commit()
    return {
        "domain": page.custom_domain,
        "verified": ok,
        "resolved_ips": ips,
        "message": (
            "Domena zweryfikowana — strona działa pod Twoją domeną"
            if ok
            else "DNS jeszcze nie wskazuje na SiteMorph. Sprawdź rekordy i spróbuj ponownie później."
        ),
    }


@router.delete("/{page_id}")
def detach_domain(page_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Odpięcie domeny od strony."""
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    page = _get_owned_page(db, page_id, current_user["id"])
    page.custom_domain = None
    page.domain_verified = 0
    page.domain_verified_at = None
    db.commit()
    return {"status": "detached"}
