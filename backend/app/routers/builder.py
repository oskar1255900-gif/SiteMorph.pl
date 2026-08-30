from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
import os
import json
import re
import time
import requests
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/builder", tags=["AI Builder"])

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "z-ai/glm-5.2:free")
# Max tokens: AI generuje 20+ plików, 8k to za mało
OPENROUTER_MAX_TOKENS = int(os.getenv("OPENROUTER_MAX_TOKENS", "16000"))
GEMINI_MAX_TOKENS = int(os.getenv("GEMINI_MAX_TOKENS", "16000"))
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "SiteMorph")

# Google (Gemini) â€” glowny provider
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
# Preferowana kolejnosc modeli â€” resolver sam sprawdzi co realnie jest dostepne dla klucza
GEMINI_PREFERRED = [
    m.strip() for m in os.getenv(
        "GEMINI_MODELS",
        # z-ai/glm-5.2:free = PRIMARY (OpenRouter). Gemini = backup:
        # 3.5 flash lite najczÄ™Ĺ›ciej, 3.7 flash rzadko (mimo ĹĽe user prosi, drogi/wolny)
        "gemini-3.5-flash-lite,gemini-flash-latest,gemini-3.7-flash,gemini-3.1-flash-lite,gemini-2.5-flash-lite",
    ).split(",") if m.strip()
]
_gemini_model_cache: Optional[str] = None


def resolve_gemini_model() -> Optional[str]:
    """Znajdz pierwszy dzialajacy model Gemini dla danego klucza.
    Nazwy modeli sie zmieniaja (np. 'gemini-3.7-flash'), wiec odpytujemy
    liste modeli API i wybieramy wg preferencji."""
    global _gemini_model_cache
    if not GEMINI_API_KEY:
        return None
    if _gemini_model_cache:
        return _gemini_model_cache
    available: List[str] = []
    try:
        r = requests.get(
            "https://generativelanguage.googleapis.com/v1beta/models",
            params={"key": GEMINI_API_KEY},
            timeout=8,
        )
        r.raise_for_status()
        for m in r.json().get("models", []):
            name = (m.get("name") or "").replace("models/", "")
            methods = m.get("supportedGenerationMethods") or []
            if name and "generateContent" in methods:
                available.append(name)
    except Exception:
        available = []
    for pref in GEMINI_PREFERRED:
        exact = next((n for n in available if n == pref), None)
        if exact:
            _gemini_model_cache = exact
            return exact
    for pref in GEMINI_PREFERRED:
        partial = next((n for n in available if pref in n), None)
        if partial:
            _gemini_model_cache = partial
            return partial
    flash = sorted(n for n in available if "flash" in n.lower())
    if flash:
        _gemini_model_cache = flash[0]
        return flash[0]
    # Nie udalo sie ustalic â€” probuj po kolei nazw preferowanych przy wywolaniu
    _gemini_model_cache = GEMINI_PREFERRED[0] if GEMINI_PREFERRED else None
    return _gemini_model_cache


def gemini_generate(system_prompt: str, user_prompt: str, temperature: float = 0.85, max_tokens: int = 32768):
    """Zwroc (tekst, None) albo (None, opis_bledu). Vercel Hobby limit 10s:
    JEDEN szybki call na flash-lite (najszybszy model), timeout 9s, zero retry/resolve."""
    if not GEMINI_API_KEY:
        return None, "Brak GEMINI_API_KEY"
    # 3.7 Flash = PRIMARY (najnowszy, najlepszy), potem 3.5 flash lite, potem 2.5
    candidates = ["gemini-3.7-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"]
    # 3.7 Flash = PRIMARY (najnowszy, najlepszy), potem 3.5 flash lite, potem 2.5
    candidates = ["gemini-3.7-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"]
    per_try_timeout = 8 if os.getenv("VERCEL") else 12
    errs: List[str] = []
    last_err: str = "brak dostÄ™pnych modeli"
    for mdl in candidates[:2]:
        try:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{mdl}:generateContent",
                params={"key": GEMINI_API_KEY},
                json={
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": min(max_tokens, 14000),
                        "responseMimeType": "application/json",
                    },
                },
                timeout=per_try_timeout,
            )
            print(f"[SiteMorph][Gemini] {mdl} -> HTTP {r.status_code}", flush=True)
            if r.status_code >= 500 or r.status_code == 404:
                last_err = f"{mdl}: HTTP {r.status_code}"
                errs.append(last_err)
                continue
            if r.status_code in (400, 403):
                last_err = f"{mdl}: HTTP {r.status_code}"
                errs.append(last_err)
                continue
            r.raise_for_status()
            cands = r.json().get("candidates") or []
            if not cands:
                last_err = f"{mdl}: brak candidates"
                errs.append(last_err)
                continue
            parts = cands[0].get("content", {}).get("parts", []) or []
            text = "".join(p.get("text", "") for p in parts)
            if not text.strip():
                last_err = f"{mdl}: pusta odpowiedz"
                errs.append(last_err)
                continue
            return text, None
        except Exception as e:
            last_err = f"{mdl}: {str(e)[:120]}"
            errs.append(last_err)
            continue
    print(f"[SiteMorph][Gemini] wszystkie proby nieudane: {errs}", flush=True)
    return None, last_err

class BuilderInput(BaseModel):
    business_name: str
    niche: str
    description: str
    style: Optional[str] = "nowoczesny, minimalistyczny"
    colors: Optional[str] = "limonkowy #bef264 + neutralny"
    sections: Optional[List[str]] = None
    extraPrompt: Optional[str] = ""
    package: Optional[str] = "starter"
    credits: Optional[int] = 10
    accent_color: Optional[str] = None
    layout: Optional[str] = None
    fonts: Optional[str] = None
    photo_style: Optional[str] = None

from app.routers.builder_fallback_modern import fallback_content

# System prompt for SiteMorph AI Builder
# AI generates ONE standalone HTML file — beautiful, modern, animated

EDITORIAL_RULES = """Jesteś premium projektantem stron. Twoje strony wyglądają jak z najlepszej agencji, nie jak generator AI.

ZASADY:
- Paleta: białe tło, akcent kolorystyczny wg danych klienta (niebieski #2563eb domyślnie)
- Typografia: Google Fonts (Inter + Instrument Serif), nagłówki 48-72px bold, body 16px/1.6
- Układ: 12 kolumn, max 1240px, 80-120px między sekcjami, asymetria
- Karty: rounded-2xl, subtelne cienie, hover translateY(-4px)
- Zdjęcia: Unsplash z konkretnymi frazami pasującymi do branży
- Animacje: scroll reveal (opacity 0→1 + translateY), hover effects, smooth transitions
- Pisz po polsku, jak człowiek nie jak marketingowiec. Zero "profesjonalny", "kompleksowy", "premium"
- Zero lorem ipsum — prawdziwe dane klienta
"""

IMPECCABLE_DESIGN_RULES = EDITORIAL_RULES

# 10 templatów kolorystycznych
TEMPLATES = [
    {"id": 1, "name": "Blue Atelier", "palette": "biel + niebieski #2563eb", "accent": "#2563eb", "images": "minimal office, blue wireframe", "layout": "hero asymetria 8/4"},
    {"id": 2, "name": "Ink Paper", "palette": "papier #fcfcf9 + atrament #131412 + błękit", "accent": "#2563eb", "images": "paper texture, ink pen", "layout": "hero 7/5 z obrazem"},
    {"id": 3, "name": "Stripe Flux", "palette": "biel + grafit #0f172a + niebieski", "accent": "#2563eb", "images": "stripe dashboard", "layout": "centered hero, tabela cennika"},
    {"id": 4, "name": "Paczkomat Grid", "palette": "szarość #f8fafc + niebieski", "accent": "#2563eb", "images": "locker grid, code", "layout": "bento 8/4"},
    {"id": 5, "name": "Map Card", "palette": "map #f1f5f9 + pine #1e293b", "accent": "#2563eb", "images": "google maps pin", "layout": "map-first hero"},
    {"id": 6, "name": "Leaflet Price", "palette": "biel + niebieski + szary", "accent": "#2563eb", "images": "price tag, leaflet", "layout": "price-forward hero"},
    {"id": 7, "name": "Canvas Promo", "palette": "canvas #ffffff + tusz #111111", "accent": "#2563eb", "images": "instagram promo, phone preview", "layout": "phone preview hero"},
    {"id": 8, "name": "Linear Board", "palette": "notion #ffffff + slate #0f172a", "accent": "#2563eb", "images": "linear board, task list", "layout": "board top bar, dense table"},
    {"id": 9, "name": "Facture Tabular", "palette": "faktura #ffffff + linia #EAEAEA", "accent": "#2563eb", "images": "invoice table", "layout": "tabular hero"},
    {"id": 10, "name": "Atelier Warm", "palette": "ciepły #fefce8 + grafit", "accent": "#2563eb", "images": "warm wood, cafe interior", "layout": "hero z obrazem na pół"},
]

def pick_template(business_name: str) -> dict:
    import hashlib, random
    h = int(hashlib.md5(business_name.encode()).hexdigest()[:8], 16)
    if random.random() < 0.8:
        return random.choice(TEMPLATES)
    return TEMPLATES[h % len(TEMPLATES)]


SYSTEM_PROMPT = """JESTES SiteMorph AI - generator stron dla lokalnych firm.

ZADANIE: Wygeneruj JEDEN plik HTML (standalone, z Tailwind CDN).
To jest strona podgladu - musi wygladac GOTOWO jak profesjonalna strona.

JSON FORMAT:
{
  "files": {
    "main/frontend/preview.html": "TUTAJ PELNY KOD HTML"
  },
  "meta": {
    "title": "Nazwa Firmy",
    "headline": "Glowny naglowek",
    "subheadline": "Podtytul",
    "ctaText": "Tekst CTA"
  }
}

ZASADY:
1. HTML z <script src="https://cdn.tailwindcss.com"> + Google Fonts (Inter)
2. Uzyj Lucide Icons: <script src="https://unpkg.com/lucide@latest"> potem <i data-lucide="nazwa"></i>
3. Sekcje: sticky header, hero z duzym naglowkiem, oferta (3-6 kart), cennik, opinie (3 sztuki z gwiazdkami), kontakt z formularzem, stopka
4. Animacje: .reveal {opacity:0;transform:translateY(20px);transition:all .5s} .reveal.visible {opacity:1;transform:translateY(0)} + IntersectionObserver
5. Kolory: jesli podano - uzyj. Jesli nie - #2563eb
6. Font: H1 48-72px bold, body 16px
7. Zdjecia: Unsplash src z frazami pasujacymi do branzy
8. DANE KLIENTA: wyciagnij z opisu - nazwa, telefon, adres, ceny, opinie, godziny
9. Ceny REALISTYCZNE (nie 3zl, tylko 3000zl dla uslug, 25zl dla jedzenia)
10. Teksty CHWYTLIWE - nie "Profesjonalne uslugi" tylko konkretne, emocjonalne
11. RESPONSIVE: mobile-first
12. MINIMUM 200 linii HTML - nie skracaj
13. PO POLSKU, jak czlowiek nie jak marketingowiec
14. NIE zadawaj pytan. Nie pisz "...".
15. UZYJ podanego ACCENT COLOR zamiast domyslnego
16. UZYJ podanego LAYOUT (split/full/centered/dark)
17. UZYJ podanych FONTOW zamiast Inter

ZAMIAST: "Profesjonalne uslugi" -> "Od 15 lat karmimy mieszkancow"
ZAMIAST: "Najwyzsza jakosc" -> "Kurczak soczysty, frytki chrupkie"
ZAMIAST: "Skontaktuj sie" -> "Zamow teraz" "Rezerwuj stolik"

LUCIDE IKONY (uzyj w HTML):
- phone, map-pin, clock, star, arrow-right, check-circle, send
- utensils (restauracja), scissors (barber), heart, sparkles, zap, shield

PRZYKLAD DOBREGO HERO:
<h1>Jedzenie, do ktorego sie wraca</h1>
<p>Od 15 lat karmimy. Duze porcje, ceny bez niespodzianek.</p>
<a>Zamow teraz</a>

PRZYKLAD ZLEGO HERO:
<h1>Profesjonalne uslugi gastronomiczne</h1>
<p>Oferujemy kompleksowe rozwiazania w branzy gastronomicznej.</p>
<a>Skontaktuj sie</a>
"""



@router.post("/generate")
def generate_site(data: BuilderInput):
    try:
        sections_str = ", ".join(data.sections or [])
        
        # OkreĹ›l nazwÄ™ pakietu na podstawie kredytĂłw
        package_map = {
            "starter": "STARTER",
            "pro": "PRO", 
            "business": "BUSINESS",
            "agencja": "AGENCJA"
        }
        package_name = package_map.get((data.package or "starter").lower(), "STARTER")
        credits = data.credits or 10
        template = pick_template(data.business_name or data.niche or "Site")
        # SYSTEM_PROMPT zawiera {package_name} i {credits} â€” wypeĹ‚nij je bezpiecznie (bez ruszenia JSONowych { })
        system_prompt_filled = SYSTEM_PROMPT.replace("{package_name}", package_name).replace("{credits}", str(credits))
        # Nie doklejaj losowego template do system promptu - template sluzy tylko do preview fallback, nie powinien mieszac LLM-owi
        
        user_prompt = f"""Dane firmy / instrukcja od uĹĽytkownika:
---
BUSINESS_NAME: {data.business_name}
NICHE: {data.niche}
DESCRIPTION: {data.description}
STYLE: {data.style}
COLORS: {data.colors}
SECTIONS: {sections_str}
EXTRA: {data.extraPrompt or ''}
PACKAGE: {package_name} ({credits} kredytĂłw)
---

Wygeneruj stronÄ™ zgodnie z SYSTEM_PROMPT: React + Vite + TypeScript + Tailwind project structure, polskie treĹ›ci, premium design, dostosowane do pakietu {package_name}.
JeĹ›li w DESCRIPTION/EXTRA jest wklejony surowy tekst z Google Maps â€” wyciÄ…gnij z niego fakty i uĹĽyj ich na stronie.
NIE zadawaj pytaĹ„. ZwrĂłÄ‡ od razu kompletny JSON."""

        warning = None
        provider = "fallback"
        parsed_files = None
        parsed_meta = None

        # 1) OpenRouter / Laguna S-2.1 = PRIMARY (czÄ™Ĺ›ciej, nowoczesne strony)
        if OPENROUTER_API_KEY:
            # Vercel 10s â†’ max 8s, inaczej 15s
            _laguna_timeout = 8 if os.getenv("VERCEL") else 15
            try:
                resp = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "HTTP-Referer": OPENROUTER_SITE_URL,
                        "X-Title": OPENROUTER_APP_NAME,
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": OPENROUTER_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt_filled},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.85,
                        "max_tokens": OPENROUTER_MAX_TOKENS,
                    },
                    timeout=_laguna_timeout,
                )
                resp.raise_for_status()
                content_text = resp.json()["choices"][0]["message"]["content"]
                parsed = extract_json(content_text)
                ofiles = parsed.get("files") or {}
                has_preview = any("preview.html" in k for k in ofiles)
                has_react = any(k.endswith(("index.html", "App.tsx", "main.tsx")) for k in ofiles)
                if has_preview or has_react:
                    if has_preview:
                        ph = ofiles.get("main/frontend/preview.html", "")
                        if len(ph) < 2000:
                            warning = f"AI za krotki ({len(ph)} chars) - fallback"
                        else:
                            parsed_files = ofiles
                            parsed_meta = parsed.get("meta", {})
                            provider = "openrouter"
                    else:
                        parsed_files = ofiles
                        parsed_meta = parsed.get("meta", {})
                        provider = "openrouter"
                else:
                    warning = "Laguna nie zwrĂłciĹ‚a plikĂłw â€” prĂłbujÄ™ Gemini"
            except Exception as e:
                warning = f"Laguna bĹ‚Ä…d: {str(e)[:150]}"
                print(f"[SiteMorph][Laguna] fail: {warning}", flush=True)

        # 2) Gemini = BACKUP (3.5 flash lite najczÄ™Ĺ›ciej, 3.7 flash rzadko) â€” na Vercel tylko Laguna, potem fallback (limit 10s)
        if parsed_files is None and GEMINI_API_KEY and not os.getenv("VERCEL"):
            text, err = gemini_generate(system_prompt_filled, user_prompt, max_tokens=GEMINI_MAX_TOKENS)
            if text:
                try:
                    parsed = extract_json(text)
                    pfiles = parsed.get("files") or {}
                    has_preview = any("preview.html" in k for k in pfiles)
                    has_react = any(k.endswith(("index.html", "App.tsx", "main.tsx")) for k in pfiles)
                    if has_preview or has_react:
                        if has_preview:
                            ph = pfiles.get("main/frontend/preview.html", "")
                            if len(ph) < 2000:
                                warning = f"Gemini za krotki ({len(ph)} chars) - fallback"
                            else:
                                parsed_files = pfiles
                                parsed_meta = parsed.get("meta", {})
                                provider = "gemini"
                        else:
                            parsed_files = pfiles
                            parsed_meta = parsed.get("meta", {})
                            provider = "gemini"
                    else:
                        warning = "Gemini nie zwrĂłciĹ‚ plikĂłw â€” prĂłbuje fallback"
                except Exception as e:
                    warning = f"Gemini: nieparsowalna odpowiedĹş ({str(e)[:120]})"
            else:
                if warning is None:
                    warning = f"Gemini niedostÄ™pny: {err}"
                else:
                    warning = warning + f" | Gemini: {err}"

        # 3) Fallback lokalny
        fb = fallback_content(data)
        if parsed_files is None:
            parsed_files = fb["files"]
            parsed_meta = fb["meta"]
            provider = "fallback"
            if warning is None:
                warning = "Brak dostÄ™pnego dostawcy AI â€” pokazujÄ™ szablon awaryjny"

        # Auto-generuj React pliki z preview.html jeśli ich nie ma
        if parsed_files and 'main/frontend/preview.html' in parsed_files:
            ph = parsed_files['main/frontend/preview.html']
            if 'main/frontend/src/App.tsx' not in parsed_files:
                # Konwertuj HTML → React App.tsx
                title = meta.get('title', 'Strona')
                headline = meta.get('headline', title)
                parsed_files['main/frontend/index.html'] = '<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + title + '</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>'
                parsed_files['main/frontend/src/main.tsx'] = "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\nReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)"
                parsed_files['main/frontend/src/index.css'] = '@tailwind base;\n@tailwind components;\n@tailwind utilities;'
                parsed_files['main/frontend/package.json'] = '{"name":"firma-site","private":true,"type":"module","scripts":{"dev":"vite","build":"vite build","preview":"vite preview"},"dependencies":{"react":"^18.2.0","react-dom":"^18.2.0","lucide-react":"^0.300.0"},"devDependencies":{"@types/react":"^18.2.0","@vitejs/plugin-react":"^4.2.0","autoprefixer":"^10.4.0","postcss":"^8.4.0","tailwindcss":"^3.4.0","typescript":"^5.3.0","vite":"^5.0.0"}}'
                # App.tsx — wrapper ktory wrzuca preview.html do iframe
                parsed_files['main/frontend/src/App.tsx'] = "import { useEffect, useRef } from 'react'\n\nexport default function App() {\n  const ref = useRef<HTMLIFrameElement>(null)\n  useEffect(() => {\n    fetch('/preview.html').then(r => r.text()).then(html => {\n      if (ref.current) ref.current.srcdoc = html\n    })\n  }, [])\n  return (\n    <div style={{width:'100vw',height:'100vh'}}>\n      <iframe ref={ref} style={{width:'100%',height:'100%',border:'none'}} title='Strona' />\n    </div>\n  )\n}"
                parsed_files['main/frontend/preview.html'] = ph

        meta = parsed_meta or fb["meta"]
        hero = {"title": meta.get("headline", data.business_name), "subtitle": meta.get("subheadline", data.description), "cta_text": meta.get("ctaText", "Kontakt")}
        return {"status": "success", "provider": provider, "warning": warning, "gemini_key_loaded": bool(GEMINI_API_KEY), "gemini_model": None, "content": {"hero": hero, "services": [], "pricing": []}, "files": parsed_files, "meta": meta}
    except Exception as e:
        import traceback
        print(f"[Builder] CRITICAL ERROR: {e}\n{traceback.format_exc()}", flush=True)
        try:
            fb = fallback_content(data)
            return {"status": "success", "provider": "fallback", "warning": f"BĹ‚Ä…d krytyczny, uĹĽyto fallback: {str(e)[:200]}", "gemini_key_loaded": bool(GEMINI_API_KEY), "gemini_model": None, "content": {"hero": {"title": data.business_name, "subtitle": data.description[:120] if data.description else "", "cta_text": "Kontakt"}, "services": [], "pricing": []}, "files": fb["files"], "meta": fb["meta"]}
        except Exception as e2:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=500, content={"detail": f"Builder critical error: {str(e)[:300]} | fallback also failed: {str(e2)[:200]}"})



