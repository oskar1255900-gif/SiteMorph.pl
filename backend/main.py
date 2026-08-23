from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from app.database import engine, Base
from app.routers import leads, builder, projects, admin, geocode
from sqlalchemy import text, inspect

# Migration: ensure leads table has new columns (sqlite - add if missing)
try:
    insp = inspect(engine)
    if insp.has_table("leads"):
        cols = {c["name"] for c in insp.get_columns("leads")}
        needed = {"address","city","country","phone","latitude","longitude","osm_id","osm_type","lead_score","industry"}
        missing = needed - cols
        if missing:
            with engine.begin() as conn:
                for col in missing:
                    coltype = "TEXT"
                    if col in ("latitude","longitude"): coltype = "FLOAT"
                    elif col in ("lead_score",): coltype = "INTEGER"
                    try:
                        conn.execute(text(f'ALTER TABLE leads ADD COLUMN {col} {coltype}'))
                    except Exception:
                        pass
    Base.metadata.create_all(bind=engine)
except Exception:
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="SiteMorph API", version="1.0.0")

# Kompresja gzip odpowiedzi — mniejszy transfer (lista miast itp.) na mobile
app.add_middleware(GZipMiddleware, minimum_size=1024)

# CORS: konkretna lista originów (env CORS_ORIGINS, rozdzielone przecinkami).
# W produkcji frontend idzie przez rewrite same-origin, więc domyślnie wystarczy dev.
import os as _os
_origins = [o.strip() for o in _os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Rate limiting: 60 req/min per IP (prosty in-memory, w produkcji Redis)
from app.middleware.rate_limit import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)

app.include_router(leads.router)
app.include_router(builder.router)
app.include_router(projects.router)
app.include_router(admin.router)
app.include_router(geocode.router)

@app.get("/")
def read_root():
    return {"message": "Witaj w SiteMorph SaaS API! System działa poprawnie."}

# ---------------------------------------------------------------------------
# PUBLIKACJA STRON â€” /p/<token> serwuje wygenerowany index.html jako prawdziwy,
# dziaĹ‚ajÄ…cy link demo (klient moĹĽe otworzyÄ‡ na telefonie).
# ---------------------------------------------------------------------------
import secrets as _secrets
import time as _time

def _make_pid():
    pid = _secrets.token_urlsafe(8).replace("-", "x").replace("_", "y")[:10]
    if not pid.isalnum():
        pid = "p" + _secrets.token_hex(4)
    return pid
from app.database import get_db as _get_db
from sqlalchemy.orm import Session as _Session
from app.models import PublishedPage as _PublishedPage
from app.auth import get_current_user as _get_current_user
from typing import Optional as _Optional

class _PublishBody(BaseModel):
    html: str
    title: _Optional[str] = None

@app.post("/api/publish")
def publish_page(body: _PublishBody, current_user: dict = Depends(_get_current_user), db: _Session = Depends(_get_db)):
    if not body.html or len(body.html) < 50:
        return JSONResponse(status_code=400, content={"detail": "Brak HTML do publikacji"})
    pid = _make_pid()
    page = _PublishedPage(
        id=pid,
        owner_id=current_user.get("id", "anon"),
        title=(body.title or "Strona SiteMorph")[:200],
        html=body.html,
        created_at=_time.time(),
    )
    db.add(page)
    try:
        db.commit()
    except Exception:
        db.rollback()
        return JSONResponse(status_code=500, content={"detail": "Nie udało się zapisać strony"})
    return {"id": pid, "url": f"/p/{pid}"}

@app.get("/p/{page_id}", response_class=HTMLResponse)
def get_published_page(page_id: str, request: Request, db: _Session = Depends(_get_db)):
    page = db.query(_PublishedPage).filter(_PublishedPage.id == page_id).first()
    if not page:
        return HTMLResponse("<h1 style='font-family:sans-serif;padding:40px'>404 — ta strona nie istnieje lub wygasła.</h1>", status_code=404)
    html = page.html or ""
    # Wstrzyknij pasek podgladu SiteMorph na gorze strony
    banner = (
        "<div style=\"position:fixed;top:0;left:0;right:0;z-index:2147483647;"
        "background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;font-size:12px;font-weight:600;"
        "padding:8px 14px;display:flex;align-items:center;gap:8px;\">"
        "<span style=\"width:8px;height:8px;border-radius:99px;background:#34d399;display:inline-block\"></span>"
        "Podgląd strony z SiteMorph"
        "<span style='flex:1'></span>"
        "<span style='opacity:.6'>" + (page.title or "") + "</span>"
        "</div><div style=\"height:33px\"></div>"
    )
    if "<body" in html.lower():
        idx = html.lower().index("<body")
        gt = html.index(">", idx) + 1
        html = html[:gt] + banner + html[gt:]
    else:
        html = banner + html
    return HTMLResponse(html)
