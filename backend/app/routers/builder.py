from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel
from typing import Optional, List
import os
import json
import re
import time
import requests
import uuid
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import UploadedAsset

load_dotenv()

router = APIRouter(prefix="/api/builder", tags=["AI Builder"])

# ---------------------------------------------------------------------------
# KONFIGURACJA PROVIDERĂ“W
# Kolejnosc prĂłb: 1) Gemini 3.7 Flash (PRIMARY)  2) OpenRouter GLM-5.2 free (BACKUP)  3) fallback lokalny
# ---------------------------------------------------------------------------

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "z-ai/glm-5.2:free")
OPENROUTER_MAX_TOKENS = int(os.getenv("OPENROUTER_MAX_TOKENS", "16000"))
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "SiteMorph")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_MAX_TOKENS = int(os.getenv("GEMINI_MAX_TOKENS", "24000"))


def extract_json(text: str) -> dict:
    """Wyciaga obiekt JSON z odpowiedzi modelu, nawet jesli model owinal go
    w markdown code fence (```json ... ```) albo dodal tekst przed/po."""
    if not text:
        raise ValueError("Pusta odpowiedz modelu")
    cleaned = text.strip()
    # Usun code fence jesli jest
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    # Jesli nadal nie zaczyna sie od { — znajdz pierwszy { i ostatni }
    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start:end + 1]
    return json.loads(cleaned)


def gemini_generate(system_prompt: str, user_prompt: str, temperature: float = 0.85, max_tokens: int = 16000):
    """Zwroc (tekst, None) albo (None, opis_bledu).
    Jeden szybki call na Gemini 3.7 Flash, timeout dopasowany do limitu platformy hostingowej."""
    if not GEMINI_API_KEY:
        return None, "Brak GEMINI_API_KEY"
    per_try_timeout = 15 if os.getenv("VERCEL") else 90
    try:
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            params={"key": GEMINI_API_KEY},
            json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": min(max_tokens, 16000),
                    "responseMimeType": "application/json",
                },
            },
            timeout=per_try_timeout,
        )
        print(f"[SiteMorph][Gemini] {GEMINI_MODEL} -> HTTP {r.status_code}", flush=True)
        if r.status_code != 200:
            return None, f"{GEMINI_MODEL}: HTTP {r.status_code} - {r.text[:200]}"
        cands = r.json().get("candidates") or []
        if not cands:
            return None, f"{GEMINI_MODEL}: brak candidates"
        parts = cands[0].get("content", {}).get("parts", []) or []
        text = "".join(p.get("text", "") for p in parts)
        if not text.strip():
            return None, f"{GEMINI_MODEL}: pusta odpowiedz"
        return text, None
    except Exception as e:
        return None, f"{GEMINI_MODEL}: {str(e)[:150]}"


def openrouter_generate(system_prompt: str, user_prompt: str, temperature: float = 0.85, max_tokens: int = 16000):
    """Backup provider — OpenRouter, model GLM-5.2 free. Zwraca (tekst, None) albo (None, blad)."""
    if not OPENROUTER_API_KEY:
        return None, "Brak OPENROUTER_API_KEY"
    per_try_timeout = 8 if os.getenv("VERCEL") else 30
    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": OPENROUTER_SITE_URL,
                "X-Title": OPENROUTER_APP_NAME,
            },
            json={
                "model": OPENROUTER_MODEL,
                "temperature": temperature,
                "max_tokens": min(max_tokens, OPENROUTER_MAX_TOKENS),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            timeout=per_try_timeout,
        )
        print(f"[SiteMorph][OpenRouter] {OPENROUTER_MODEL} -> HTTP {r.status_code}", flush=True)
        if r.status_code != 200:
            return None, f"{OPENROUTER_MODEL}: HTTP {r.status_code} - {r.text[:200]}"
        data = r.json()
        choices = data.get("choices") or []
        if not choices:
            return None, f"{OPENROUTER_MODEL}: brak choices"
        text = choices[0].get("message", {}).get("content", "")
        if not text.strip():
            return None, f"{OPENROUTER_MODEL}: pusta odpowiedz"
        return text, None
    except Exception as e:
        return None, f"{OPENROUTER_MODEL}: {str(e)[:150]}"


class BuilderInput(BaseModel):
    business_name: str
    niche: str
    description: str
    style: Optional[str] = "nowoczesny, minimalistyczny"
    colors: Optional[str] = "#2563eb + bialy + czarny"
    sections: Optional[List[str]] = None
    extraPrompt: Optional[str] = ""
    package: Optional[str] = "starter"
    credits: Optional[int] = 10
    accent_color: Optional[str] = None
    layout: Optional[str] = None
    fonts: Optional[str] = None
    photo_style: Optional[str] = None
    image_urls: Optional[List[str]] = None


from app.routers.builder_fallback_modern import fallback_content

# ---------------------------------------------------------------------------
# SYSTEM PROMPT
# Jeden spĂłjny format wyjscia: standalone HTML w polu files["main/frontend/preview.html"].
# Nie ma tu juz sprzecznosci "jeden plik HTML" vs "projekt React" ktora byla w user_prompt.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """Jestes ekspertem web designu. Generujes KOMPLETNE, PRODUKCYJNE strony React dla lokalnych polskich biznesow. Kazda strona musi wygladac jak zrobiona przez topowa agencje designu - z animacjami, prawdziwymi zdjeciami, i dopracowanym detalem.

ZWROC WYLACZNIE poprawny JSON (bez markdown, bez tekstu przed/po):
{
  "files": {
    "main/frontend/index.html": "<!doctype html>...",
    "main/frontend/src/App.tsx": "pelny kod React...",
    "main/frontend/src/main.tsx": "import React...",
    "main/frontend/src/index.css": "style CSS...",
    "main/frontend/src/components/Hero.tsx": "komponent Hero...",
    "main/frontend/src/components/Menu.tsx": "komponent Menu...",
    "main/frontend/src/components/Contact.tsx": "komponent Kontakt...",
    "main/frontend/src/components/Footer.tsx": "komponent Stopka...",
    "main/frontend/package.json": "..."
  },
  "meta": {
    "title": "Nazwa Firmy",
    "headline": "Glowny naglowek",
    "subheadline": "Podtytul",
    "ctaText": "Tekst CTA"
  }
}

KRYTYCZNE ZASADY JSON:
- Uzywaj TYLKO cudzyslowow podwojnych " w atrybutach HTML/JSX
- Nowe linie jako \n w stringach JSON
- Nie uzywaj backtickow w stringach JSON
- Caly kazdy plik to JEDNA linia tekstu w JSON
- KAZDY PLIK musi byc pelny, kompletny - nie skracaj, nie dodawaj "..."
- Uzywaj polskich znakow: ą, ć, ę, ł, ń, ó, ś, ź, ż normalnie w tekstach

STACK TECHNICZNY (każdy plik):
- React 18 + TypeScript + Vite
- Tailwind CSS (CDN: <script src="https://cdn.tailwindcss.com"></script>)
- Google Fonts: Inter (400-900) + Instrument Serif
- Lucide React: <script src="https://unpkg.com/lucide@latest"></script> + lucide.createIcons()
- Animacje: Framer Motion lub CSS @keyframes (scroll-reveal, fade-in, slide-up)
- Zdjecia: <img src="https://source.unsplash.com/800x600/?FRAZA" /> z KONKRETNA fraza dla branzy

KAZDY KOMPONENT MUSI:
- Miec pelne, responsywne style (Tailwind sm/md/lg)
- Miec animacje wejścia (opacity 0→1, translateY 20→0, transition 0.5s)
- Uzywac prawdziwych zdjec z Unsplash (nie placeholder)
- Miec hover efekty na kartach i przyciskach
- Byc po polsku z poprawnymi polskimi znakami

SEKCJE STRONY (kazda jako osobny komponent):
1. HERO: duzy naglowek (48-72px bold), podtytul (16px/1.6), 2 CTA, zdjecie po prawej, asymetryczny layout
2. OFERTA/MENU: 3-6 kart z ikonami, opisami, cenami. Hover: translateY(-4px) + shadow
3. CENNIK: 3 karty z pakietami (Basic/Standard/Premium), przycisk "Wybieram"
4. OPINIE: 3-4 cytaty z gwiazdkami, imionami, rola klienta
5. KONTAKT: formularz (imie, email, telefon, textarea + "Wyslij") + mapa/adres
6. STOPKA: logo, linki, social media, copyright

DESIGN (stosuj WSZYSTKIE):
- Jeden kolor akcentu na cala strone (nie mieszaj)
- Tlo: jasne (#fafafa) lub ciemne (#0a0a0a) - NIE mieszaj motywow
- H1: 48-72px, font-weight 800, max 2 linie
- Karty: rounded-2xl, shadow-lg, hover:translateY(-4px) transition 0.3s
- Przyciski: rounded-full, font-semibold, hover:scale(1.02)
- Max-width 1240px, padding 80-120px miedzy sekcjami
- Sekcje maja sie RYZNICOWAC - nie 3x ten sam layout

TRESC:
- Wyciagnij WSZYSTKIE fakty z DESCRIPTION i uzyj ich
- NIGDY nie wymyslaj telefonu/adresu jesli klient nie podal
- Ceny: realistyczne dla branzy w Polsce
- Opinie: 3-4 z polskimi imionami, naturalne
- Pisz jak czlowiek, NIE jak agencja (zero "profesjonalny", "kompleksowy")
- Zero lorem ipsum, zero TODO, zero "..."

FORMULARZ KONTAKTOWY (w komponencie Contact.tsx):
- Imie (input text, required)
- Email (input email, required)
- Telefon (input tel)
- Wiadomosc (textarea, required)
- Przycisk "Wyslij" (submit)
- action="#" method="POST"
- Style: nowoczesny, rounded-xl, dark inputs na jasnym tle

ANIMACJE (w kazdym komponencie):
- scroll-reveal: IntersectionObserver + CSS transition
- Hero: tekst fade-in z opoznieniem, zdjecie slide-in z prawej
- Karty: staggered fade-in (0.1s delay miedzy kartami)
- Przyciski: scale(1.02) na hover
- Sekcje: opacity 0→1 translateY(20px)→0 przy scrollu"""


@router.post("/generate")
def generate_site(data: BuilderInput):
    try:
        sections_str = ", ".join(data.sections or [])

        package_map = {
            "starter": "STARTER",
            "pro": "PRO",
            "business": "BUSINESS",
            "agencja": "AGENCJA",
        }
        package_name = package_map.get((data.package or "starter").lower(), "STARTER")
        credits = data.credits or 10

        extra_style_bits = []
        if data.accent_color:
            extra_style_bits.append(f"ACCENT COLOR: {data.accent_color}")
        if data.layout:
            extra_style_bits.append(f"LAYOUT: {data.layout}")
        if data.fonts:
            extra_style_bits.append(f"FONTY: {data.fonts}")
        if data.photo_style:
            extra_style_bits.append(f"STYL ZDJEC: {data.photo_style}")
        extra_style_str = "\n".join(extra_style_bits)

        image_section = ""
        if data.image_urls:
            urls = ", ".join(data.image_urls[:8])
            image_section = f"\nZALACZONE ZDJECIA (uzyj jako src w <img> zamiast Unsplash): {urls}"

        user_prompt = f"""Dane firmy:
---
BUSINESS_NAME: {data.business_name}
NICHE: {data.niche}
DESCRIPTION: {data.description}
STYLE: {data.style}
COLORS: {data.colors}
SECTIONS: {sections_str}
EXTRA: {data.extraPrompt or ''}
{extra_style_str}
{image_section}
---

Wygeneruj kompletne strone HTML. Zwroc JSON z files["main/frontend/preview.html"]. Bez pytan."""

        warning = None
        provider = "fallback"
        parsed_files = None
        parsed_meta = None

        # 1) GEMINI = PRIMARY
        if GEMINI_API_KEY:
            text, err = gemini_generate(SYSTEM_PROMPT, user_prompt, max_tokens=GEMINI_MAX_TOKENS)
            if text:
                try:
                    parsed = extract_json(text)
                    pfiles = parsed.get("files") or {}
                    ph = pfiles.get("main/frontend/preview.html", "")
                    if ph and len(ph) >= 2000:
                        parsed_files = pfiles
                        parsed_meta = parsed.get("meta", {})
                        provider = "gemini"
                    else:
                        warning = f"Gemini zwrocil za krotka strone ({len(ph)} znakow) - probuje backup"
                except Exception as e:
                    warning = f"Gemini: nieparsowalna odpowiedz ({str(e)[:120]})"
            else:
                warning = f"Gemini niedostepny: {err}"

        # 2) OPENROUTER (GLM-5.2 free) = BACKUP, tylko jesli Gemini nie dal wyniku
        if parsed_files is None and OPENROUTER_API_KEY:
            text, err = openrouter_generate(SYSTEM_PROMPT, user_prompt, max_tokens=OPENROUTER_MAX_TOKENS)
            if text:
                try:
                    parsed = extract_json(text)
                    pfiles = parsed.get("files") or {}
                    ph = pfiles.get("main/frontend/preview.html", "")
                    if ph and len(ph) >= 2000:
                        parsed_files = pfiles
                        parsed_meta = parsed.get("meta", {})
                        provider = "openrouter"
                    else:
                        warning = (warning + " | " if warning else "") + f"OpenRouter zwrocil za krotka strone ({len(ph)} znakow)"
                except Exception as e:
                    warning = (warning + " | " if warning else "") + f"OpenRouter: nieparsowalna odpowiedz ({str(e)[:120]})"
            else:
                warning = (warning + " | " if warning else "") + f"OpenRouter niedostepny: {err}"

        # 3) Fallback lokalny — ostatnia deska ratunku
        fb = fallback_content(data)
        if parsed_files is None:
            parsed_files = fb["files"]
            parsed_meta = fb["meta"]
            provider = "fallback"
            if warning is None:
                warning = "Brak dostepnego dostawcy AI - pokazuje szablon awaryjny"

        meta = parsed_meta or fb["meta"]

        # Auto-generuj React pliki z preview.html jesli ich nie ma (wrapper przez iframe)
        if parsed_files and "main/frontend/preview.html" in parsed_files:
            ph = parsed_files["main/frontend/preview.html"]
            if "main/frontend/src/App.tsx" not in parsed_files:
                title = meta.get("title", data.business_name or "Strona")
                parsed_files["main/frontend/index.html"] = (
                    '<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"/>'
                    '<meta name="viewport" content="width=device-width,initial-scale=1"/>'
                    f"<title>{title}</title></head><body><div id=\"root\"></div>"
                    '<script type="module" src="/src/main.tsx"></script></body></html>'
                )
                parsed_files["main/frontend/src/main.tsx"] = (
                    "import React from 'react'\n"
                    "import ReactDOM from 'react-dom/client'\n"
                    "import App from './App'\n"
                    "import './index.css'\n"
                    "ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)"
                )
                parsed_files["main/frontend/src/index.css"] = (
                    "@tailwind base;\n@tailwind components;\n@tailwind utilities;"
                )
                parsed_files["main/frontend/package.json"] = (
                    '{"name":"firma-site","private":true,"type":"module",'
                    '"scripts":{"dev":"vite","build":"vite build","preview":"vite preview"},'
                    '"dependencies":{"react":"^18.2.0","react-dom":"^18.2.0","lucide-react":"^0.300.0"},'
                    '"devDependencies":{"@types/react":"^18.2.0","@vitejs/plugin-react":"^4.2.0",'
                    '"autoprefixer":"^10.4.0","postcss":"^8.4.0","tailwindcss":"^3.4.0",'
                    '"typescript":"^5.3.0","vite":"^5.0.0"}}'
                )
                parsed_files["main/frontend/src/App.tsx"] = (
                    "import { useEffect, useRef } from 'react'\n\n"
                    "export default function App() {\n"
                    "  const ref = useRef<HTMLIFrameElement>(null)\n"
                    "  useEffect(() => {\n"
                    "    fetch('/preview.html').then(r => r.text()).then(html => {\n"
                    "      if (ref.current) ref.current.srcdoc = html\n"
                    "    })\n"
                    "  }, [])\n"
                    "  return (\n"
                    "    <div style={{width:'100vw',height:'100vh'}}>\n"
                    "      <iframe ref={ref} style={{width:'100%',height:'100%',border:'none'}} title='Strona' />\n"
                    "    </div>\n"
                    "  )\n"
                    "}"
                )
                parsed_files["main/frontend/preview.html"] = ph

        hero = {
            "title": meta.get("headline", data.business_name),
            "subtitle": meta.get("subheadline", data.description),
            "cta_text": meta.get("ctaText", "Kontakt"),
        }
        return {
            "status": "success",
            "provider": provider,
            "warning": warning,
            "gemini_key_loaded": bool(GEMINI_API_KEY),
            "gemini_model": GEMINI_MODEL if provider == "gemini" else None,
            "openrouter_model": OPENROUTER_MODEL if provider == "openrouter" else None,
            "content": {"hero": hero, "services": [], "pricing": []},
            "files": parsed_files,
            "meta": meta,
        }
    except Exception as e:
        import traceback
        print(f"[Builder] CRITICAL ERROR: {e}\n{traceback.format_exc()}", flush=True)
        try:
            fb = fallback_content(data)
            return {
                "status": "success",
                "provider": "fallback",
                "warning": f"Blad krytyczny, uzyto fallback: {str(e)[:200]}",
                "gemini_key_loaded": bool(GEMINI_API_KEY),
                "gemini_model": None,
                "openrouter_model": None,
                "content": {
                    "hero": {
                        "title": data.business_name,
                        "subtitle": data.description[:120] if data.description else "",
                        "cta_text": "Kontakt",
                    },
                    "services": [],
                    "pricing": [],
                },
                "files": fb["files"],
                "meta": fb["meta"],
            }
        except Exception as e2:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=500,
                content={"detail": f"Builder critical error: {str(e)[:300]} | fallback also failed: {str(e2)[:200]}"},
            )


# ---------------------------------------------------------------------------
# UPLOAD ZDJEC - klient dolacza pliki do promptu; AI dostaje URL-e do <img>
# ---------------------------------------------------------------------------
@router.post("/upload")
async def upload_assets(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    urls: List[str] = []
    for f in files[:8]:
        data = await f.read()
        if not data or len(data) > 6_000_000:
            continue
        asset = UploadedAsset(
            id=uuid.uuid4().hex[:16],
            filename=(f.filename or "plik")[:120],
            content_type=f.content_type or "image/jpeg",
            data=data,
            created_at=time.time(),
        )
        db.add(asset)
        db.commit()
        urls.append(f"/api/builder/asset/{asset.id}")
    return {"urls": urls}


@router.get("/asset/{asset_id}")
def get_asset(asset_id: str, db: Session = Depends(get_db)):
    a = db.query(UploadedAsset).filter(UploadedAsset.id == asset_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Nie ma takiego pliku")
    return Response(
        content=a.data,
        media_type=a.content_type or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )