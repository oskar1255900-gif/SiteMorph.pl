import os
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invoice, UserSettings
from ..auth import get_current_user

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "sitemorph0@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "")  # hasło aplikacji Gmaila (nie hasło do konta!)

PAYMENT_METHODS = {"paypal", "blik", "przelew"}


class InvoiceItem(BaseModel):
    name: str
    qty: float = 1
    unit_price: float = 0.0  # netto
    vat: float = 23.0


class Party(BaseModel):
    name: str
    address: Optional[str] = None
    nip: Optional[str] = None
    email: Optional[str] = None


class InvoiceCreate(BaseModel):
    buyer: Party
    items: List[InvoiceItem] = Field(min_length=1)
    payment_method: str = "przelew"
    paypal_link: Optional[str] = None
    blik_phone: Optional[str] = None
    iban: Optional[str] = None
    notes: Optional[str] = None
    send: bool = False
    send_to: Optional[str] = None


def _totals(items: List[InvoiceItem]):
    net = sum(i.qty * i.unit_price for i in items)
    vat = sum(i.qty * i.unit_price * (i.vat or 0) / 100 for i in items)
    return round(net, 2), round(vat, 2), round(net + vat, 2)


def _next_number(db: Session, owner_id: str) -> str:
    y, m = time.strftime("%Y"), time.strftime("%m")
    prefix = f"FV/{y}/{m}/"
    count = db.query(Invoice).filter(Invoice.number.like(prefix + "%")).count()
    return f"{prefix}{count + 1:03d}"


def _esc(s) -> str:
    return str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_invoice_html(inv: Invoice) -> str:
    seller = inv.seller or {}
    buyer = inv.buyer or {}
    items = inv.items or []
    pd = inv.payment_details or {}
    net, vat, gross = _totals([InvoiceItem(**i) if isinstance(i, dict) else i for i in items])
    rows = ""
    for i, it in enumerate(items, 1):
        it_net = round(it["qty"] * it["unit_price"], 2)
        it_vat = round(it_net * (it.get("vat", 0) or 0) / 100, 2)
        rows += (
            f"<tr><td>{i}</td><td>{_esc(it['name'])}</td><td>{it['qty']}</td>"
            f"<td>{it['unit_price']:.2f} zł</td><td>{it.get('vat', 0)}%</td>"
            f"<td>{it_net:.2f} zł</td><td>{it_vat:.2f} zł</td><td>{it_net + it_vat:.2f} zł</td></tr>"
        )
    method = inv.payment_method or "przelew"
    pay = ""
    if method == "paypal":
        pay = f"<p><strong>Płatność PayPal:</strong> <a href=\"{_esc(pd.get('paypal_link'))}\">{_esc(pd.get('paypal_link'))}</a></p>"
    elif method == "blik":
        pay = f"<p><strong>BLIK na telefon:</strong> {_esc(pd.get('phone'))}</p>"
    else:
        pay = (
            f"<p><strong>Przelew na rachunek IBAN:</strong> <code>{_esc(pd.get('iban'))}</code></p>"
            "<p class=\"small\">Numer IBAN jest bezpieczny — służy wyłącznie do zrealizowania przelewu "
            "na konto wystawcy i nie umożliwia nikomu dostępu do rachunku.</p>"
        )
    return f"""<!doctype html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Faktura {_esc(inv.number)}</title>
<style>
  body {{ font-family: -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif; color:#131412; background:#fcfcf9; margin:0; padding:40px 16px; }}
  .wrap {{ max-width:760px; margin:0 auto; background:#fff; border:1px solid #e7e5e0; border-radius:12px; padding:40px; }}
  h1 {{ font-family:'Instrument Serif', Georgia, serif; font-weight:400; font-size:34px; margin:0 0 4px; letter-spacing:-.02em; }}
  .muted {{ color:#6b6b66; font-size:12px; }}
  .grid {{ display:flex; justify-content:space-between; gap:24px; margin:28px 0; }}
  .box {{ flex:1; }}
  .box h3 {{ font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#6b6b66; margin:0 0 6px; }}
  table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  th {{ text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:#6b6b66; padding:8px 6px; border-bottom:1px solid #e7e5e0; }}
  td {{ padding:9px 6px; border-bottom:1px solid #f0efe9; }}
  .totals {{ margin-top:16px; text-align:right; font-size:14px; }}
  .totals .gross {{ font-size:22px; font-weight:700; }}
  .pay {{ margin-top:24px; background:#f6f6f2; border:1px solid #e7e5e0; border-radius:10px; padding:16px; font-size:13px; }}
  .small {{ font-size:10px; color:#6b6b66; margin-top:4px; }}
  footer {{ margin-top:32px; font-size:10px; color:#9a9a94; }}
  code {{ background:#f6f6f2; border:1px solid #e7e5e0; border-radius:6px; padding:2px 6px; }}
</style></head>
<body><div class="wrap">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div><h1>Faktura {_esc(inv.number)}</h1><p class="muted">Data wystawienia: {time.strftime('%d.%m.%Y', time.localtime(inv.created_at or time.time()))}</p></div>
    <div class="muted" style="text-align:right">Wystawca:<br><strong>{_esc(seller.get('name'))}</strong><br>{_esc(seller.get('address'))}<br>{_esc(seller.get('nip') and 'NIP: ' + seller['nip'])}<br>{_esc(seller.get('email'))}</div>
  </div>
  <div class="grid">
    <div class="box"><h3>Nabywca</h3><strong>{_esc(buyer.get('name'))}</strong><br>{_esc(buyer.get('address'))}<br>{_esc(buyer.get('nip') and 'NIP: ' + buyer['nip'])}<br>{_esc(buyer.get('email'))}</div>
  </div>
  <table><thead><tr><th>#</th><th>Nazwa</th><th>Ilość</th><th>Cena netto</th><th>VAT</th><th>Netto</th><th>VAT zł</th><th>Brutto</th></tr></thead>
  <tbody>{rows}</tbody></table>
  <div class="totals">
    <div>Netto: <strong>{net:.2f} zł</strong></div>
    <div>VAT: <strong>{vat:.2f} zł</strong></div>
    <div class="gross">Do zapłaty: {gross:.2f} zł</div>
  </div>
  <div class="pay">{pay}{f'<p class="small">{_esc(inv.notes)}</p>' if inv.notes else ''}</div>
  <footer>Faktura wygenerowana w SiteMorph • Wystawca: {_esc(seller.get('email'))}</footer>
</div></body></html>"""


def _send_invoice_email(inv: Invoice, to_email: str, user_email: str) -> bool:
    if not SMTP_PASS:
        return False
    html = render_invoice_html(inv)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Faktura {inv.number} — {(inv.seller or {}).get('name') or 'SiteMorph'}"
    msg["From"] = f"SiteMorph <{SMTP_USER}>"
    msg["To"] = to_email
    # Odpowiedzi trafiają do wystawcy (zarejestrowany użytkownik), nie do skrzynki platformy
    msg["Reply-To"] = user_email or SMTP_USER
    body = (
        f"Dzień dobry,\n\nw załączeniu faktura {inv.number} wystawiona przez "
        f"{(inv.seller or {}).get('name') or user_email} ({user_email}).\n\n"
        f"Faktura została wysłana automatycznie przez SiteMorph w imieniu wystawcy — "
        f"odpowiedź na tego maila trafi bezpośrednio do wystawcy ({user_email}).\n\n"
        f"Do zapłaty: {inv.total:.2f} zł\n"
    )
    msg.attach(MIMEText(body, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    att = MIMEText(html, "html", "utf-8")
    att.add_header("Content-Disposition", "attachment", filename=f"{inv.number}.html")
    msg.attach(att)
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_USER, [to_email], msg.as_string())
        return True
    except Exception:
        return False


def _require_payment_fields(method: str, body: InvoiceCreate):
    if method == "paypal" and not (body.paypal_link or "").strip():
        raise HTTPException(status_code=400, detail="Dla metody PayPal podaj link do płatności PayPal")
    if method == "blik" and not (body.blik_phone or "").strip():
        raise HTTPException(status_code=400, detail="Dla metody BLIK podaj numer telefonu")
    if method == "przelew" and not (body.iban or "").strip():
        raise HTTPException(status_code=400, detail="Dla metody przelew podaj numer IBAN")


@router.post("")
def create_invoice(body: InvoiceCreate, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user)):
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    method = (body.payment_method or "").lower()
    if method not in PAYMENT_METHODS:
        raise HTTPException(status_code=400, detail="Dozwolone metody płatności: paypal, blik, przelew")
    _require_payment_fields(method, body)

    # Dane sprzedawcy: z ustawień użytkownika, a e-mail wystawcy = e-mail z konta
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user["id"]).first()
    data = (settings.data if settings and settings.data else {}) or {}
    user_email = current_user.get("email") or data.get("seller_email") or ""
    seller = {
        "name": data.get("seller_name") or (user_email.split("@")[0] if user_email else "Wystawca"),
        "address": data.get("seller_address"),
        "nip": data.get("seller_nip"),
        "email": user_email,
    }
    net, vat, gross = _totals(body.items)
    inv = Invoice(
        owner_id=current_user["id"],
        number=_next_number(db, current_user["id"]),
        created_at=time.time(),
        seller=seller,
        buyer=body.buyer.dict(),
        items=[i.dict() for i in body.items],
        payment_method=method,
        payment_details={"paypal_link": body.paypal_link, "phone": body.blik_phone, "iban": body.iban},
        total=gross,
        notes=body.notes,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    sent = False
    to_email = (body.send_to or body.buyer.email or "").strip()
    if body.send and to_email:
        sent = _send_invoice_email(inv, to_email, user_email)
        if sent:
            inv.sent_to = to_email
            inv.sent_at = time.time()
            db.commit()
    return {
        "status": "created",
        "invoice": {
            "id": inv.id, "number": inv.number, "total": gross,
            "payment_method": method, "sent_to": inv.sent_to,
        },
        "email_sent": sent,
        "email_note": (
            None if not body.send else (
                "Wysłano z " + SMTP_USER + " — odpowiedzi trafią do wystawcy (" + user_email + ")"
                if sent else "Wysyłka e-mail nie jest skonfigurowana (brak SMTP_PASS na serwerze)"
            )
        ),
    }


@router.get("")
def list_invoices(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    rows = (
        db.query(Invoice)
        .filter(Invoice.owner_id == current_user["id"])
        .order_by(Invoice.created_at.desc())
        .all()
    )
    return {
        "invoices": [
            {
                "id": r.id, "number": r.number, "buyer": (r.buyer or {}).get("name"),
                "total": r.total, "payment_method": r.payment_method,
                "sent_to": r.sent_to, "created_at": r.created_at,
            }
            for r in rows
        ]
    }


@router.get("/{invoice_id}/html", response_class=HTMLResponse)
def invoice_html(invoice_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Nie znaleziono faktury")
    if str(inv.owner_id) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Brak dostępu")
    return HTMLResponse(render_invoice_html(inv))
