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
    per_try_timeout = 15 if os.getenv("VERCEL") else 450
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
    mode: Optional[str] = "normal"  # normal = qwen3-coder, ultra = fable-5.1


from app.routers.builder_fallback_modern import fallback_content

# ---------------------------------------------------------------------------
# SYSTEM PROMPT
# Jeden spĂłjny format wyjscia: standalone HTML w polu files["main/frontend/preview.html"].
# Nie ma tu juz sprzecznosci "jeden plik HTML" vs "projekt React" ktora byla w user_prompt.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are SiteMorph AI — a senior React developer and web designer. You create stunning, production-ready React websites for local Polish businesses.

═══════════════════════════════════════════════
STEP 1: THINK BEFORE YOU CODE
═══════════════════════════════════════════════
Before writing ANY code, analyze the business:
- What industry? What mood fits? (elegant, cozy, modern, premium, playful)
- Who are the customers? (families, young people, businesses)
- What's the ONE thing that makes this business special?
- What color palette fits THIS specific business? (NOT default blue!)
- What photos would look authentic for THIS business?

═══════════════════════════════════════════════
STEP 2: GENERATE REACT PROJECT
═══════════════════════════════════════════════
Generate a COMPLETE React project with separate component files.
Each component must be FULLY implemented, not stubs.

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no text before/after:
{
  "files": {
    "main/frontend/index.html": "<!doctype html><html lang='pl'><head>...</head><body><div id='root'></div><script type='module' src='/src/main.tsx'></script></body></html>",
    "main/frontend/src/main.tsx": "import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App'; import './index.css'; ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);",
    "main/frontend/src/index.css": "ALL CSS STYLES — Tailwind imports + custom animations + component styles",
    "main/frontend/src/App.tsx": "import Hero from './components/Hero'; import Menu from './components/Menu'; import Contact from './components/Contact'; import Footer from './components/Footer'; export default function App() { return (<div><Hero /><Menu /><Contact /><Footer /></div>); }",
    "main/frontend/src/components/Hero.tsx": "FULL Hero component with JSX + Tailwind styles",
    "main/frontend/src/components/Menu.tsx": "FULL Menu/Offer component with cards",
    "main/frontend/src/components/Contact.tsx": "FULL Contact component with form",
    "main/frontend/src/components/Footer.tsx": "FULL Footer component",
    "main/frontend/package.json": "React 18 + Vite + Tailwind + TypeScript dependencies"
  },
  "meta": {
    "title": "Business Name",
    "headline": "Main headline from hero",
    "subheadline": "Subtitle from hero",
    "ctaText": "CTA button text"
  }
}

═══════════════════════════════════════════════
STEP 3: EACH FILE MUST BE COMPLETE
═══════════════════════════════════════════════

index.html:
- Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>
- Google Fonts: Inter (400-900) + one accent font
- Lucide Icons: <script src="https://unpkg.com/lucide@latest"></script>
- Meta charset UTF-8, viewport, title

src/index.css:
- @tailwind base; @tailwind components; @tailwind utilities;
- @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
- body { font-family: 'Inter', sans-serif; }
- CSS animations: @keyframes fadeInUp, fadeIn
- Scroll reveal: .reveal opacity 0 translateY(30px), .reveal.visible opacity 1 translateY(0)

src/App.tsx:
- Import all components: Hero, Menu, Contact, Footer
- Render in order
- useEffect with IntersectionObserver for scroll-reveal

src/components/Hero.tsx:
- BIG headline: text-5xl md:text-7xl font-extrabold tracking-tight
- Subtitle: text-lg text-gray-600
- 2 CTA buttons: primary (filled) + secondary (outline)
- Hero image from Unsplash with object-cover rounded-2xl
- Asymmetric layout: text left (col-span-7), image right (col-span-5)
- Floating badge: star rating
- ALL text in Polish with proper characters

src/components/Menu.tsx:
- 4-6 offer cards in grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Each card: Lucide icon, title, description, price
- Cards: rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300
- Realistic prices for Polish market (not generic)

src/components/Contact.tsx:
- Two-column layout: form left, info right
- Form: Name (required), Email (required), Phone, Message (textarea, required)
- Submit: "Wyslij wiadomosc" button
- Inputs: rounded-xl border-2 focus:ring-2 transition
- Address, phone, hours on the right

src/components/Footer.tsx:
- Logo text, navigation links, social icons
- Copyright with current year
- Minimal, clean design

═══════════════════════════════════════════════
STEP 4: VISUAL QUALITY
═══════════════════════════════════════════════
- ONE accent color chosen for THIS business (not default blue)
- Light bg (#fafafa) OR dark (#0a0a0a) — never mix
- Typography: headlines 48-72px bold, body 16px, titles 32-40px
- Spacing: 80-120px between sections, max-width 1200px centered
- Animations: scroll-reveal fade-in, card hover lift, button scale
- Images: Unsplash with SPECIFIC terms (not generic "business")
- Polish chars: a c e l n o s z z MUST work correctly

═══════════════════════════════════════════════
STEP 5: CONTENT RULES
═══════════════════════════════════════════════
- Use ALL facts from user description
- NEVER invent phone/address if not provided
- Prices: realistic for Polish market
- Reviews: 3-4 with Polish names, specific details
- Write like a human, NOT marketing agency
- BANNED: "profesjonalny", "kompleksowy", "najwyzsza jakosc"
- Zero lorem ipsum, zero "...", zero TODO

═══════════════════════════════════════════════
JSON RULES
═══════════════════════════════════════════════
- Each file = complete working code
- JSX uses double quotes for attributes
- Newlines = \n in JSON string
- NO backticks in JSON
- Each file = ONE line in JSON
- Polish chars work normally
- MINIMUM 40 lines per component"""


def openrouter_generate_model(model: str, system_prompt: str, user_prompt: str, temperature: float = 0.85, max_tokens: int = 24000):
    """Generate using OpenRouter with any model."""
    if not OPENROUTER_API_KEY:
        return None, "Brak OPENROUTER_API_KEY"
    per_try_timeout = 15 if os.getenv("VERCEL") else 450
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
                "model": model,
                "temperature": temperature,
                "max_tokens": min(max_tokens, 24000),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            timeout=per_try_timeout,
        )
        print(f"[SiteMorph][OpenRouter] {model} -> HTTP {r.status_code}", flush=True)
        if r.status_code != 200:
            return None, f"{model}: HTTP {r.status_code} - {r.text[:200]}"
        data = r.json()
        choices = data.get("choices") or []
        if not choices:
            return None, f"{model}: brak choices"
        text = choices[0].get("message", {}).get("content", "")
        if not text.strip():
            return None, f"{model}: pusta odpowiedz"
        return text, None
    except Exception as e:
        return None, f"{model}: {str(e)[:150]}"


# Model mapping: normal = fast/cheap, ultra = best quality
MODEL_MAP = {
    "normal": "qwen/qwen3-coder-plus:free",        # Free, 1M context, flagship quality
    "ultra": "openai/gpt-5.6-luna"             # $0.20/1M in, $1.20/1M out, ~$0.025/strone
}




# ---------------------------------------------------------------------------
# UNPLASH SEARCH
# ---------------------------------------------------------------------------
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")

def search_unsplash(query, count=4):
    if not UNSPLASH_ACCESS_KEY:
        q = requests.utils.quote(query)
        return [f"https://source.unsplash.com/800x600/?{q}&sig={i}" for i in range(count)]
    try:
        r = requests.get(
            "https://api.unsplash.com/search/photos",
            headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            params={"query": query, "per_page": count, "orientation": "landscape"},
            timeout=8,
        )
        if r.status_code == 200:
            data = r.json()
            return [res["urls"]["regular"] for res in data.get("results", [])[:count]]
    except Exception:
        pass
    q = requests.utils.quote(query)
    return [f"https://source.unsplash.com/800x600/?{q}&sig={i}" for i in range(count)]


# ---------------------------------------------------------------------------
# GENERATE QUESTIONS -- Gemini 3.8 Flash
# ---------------------------------------------------------------------------
class QuestionInput(BaseModel):
    business_name: str = ""
    description: str = ""

@router.post("/generate-questions")
def generate_questions(data: QuestionInput):
    system = (
        "You are SiteMorph AI assistant. Generate 4-5 short, creative questions "
        "to help build a website for a Polish local business. "
        "Return ONLY a JSON array of question objects. Each object has: "
        '"question" (short Polish text, 5-12 words), '
        '"placeholder" (example answer in Polish), '
        '"options" (array of 3-6 short Polish option strings), '
        '"stateKey" (one of: niche, accent, layout, sections, tone, photos, extras), '
        '"multi" (boolean, true for multi-select). '
        "Rules: vary wording/order/focus each time. sections=multi:true. "
        "accent=colors with hex. Include style and photos questions. "
        "All Polish. Return ONLY JSON array."
    )
    user = f"Business: {data.business_name or 'not specified'}. Desc: {data.description or 'not specified'}. Generate creative questions."

    if GEMINI_API_KEY:
        text, err = gemini_generate(system, user, temperature=0.95, max_tokens=2000)
        if text:
            try:
                cleaned = text.strip().strip("`json").strip("`").strip()
                questions = json.loads(cleaned)
                if isinstance(questions, list) and len(questions) >= 3:
                    return {"questions": questions[:6], "source": "gemini"}
            except Exception:
                pass

    import random
    fb = [
        {"question": "Jaki to biznes?", "placeholder": "np. Restauracja, Barber...", "options": ["Restauracja", "Barber", "Salon beauty", "Kawiarnia", "Warsztat", "Prawnik"], "stateKey": "niche"},
        {"question": "Jaki kolor przewodni?", "placeholder": "np. Zloty, granatowy...", "options": ["Niebieski #2563eb", "Ciemny #111827", "Zloty #d97706", "Zielony #059669", "Fioletowy #7c3aed", "Rozowy #ec4899"], "stateKey": "accent"},
        {"question": "Jaki klimat strony?", "placeholder": "np. Elegancki, sportowy...", "options": ["Nowoczesny i minimalistyczny", "Ciemny i premium", "Cieply i przytulny", "Odwazny i kolorowy"], "stateKey": "layout"},
        {"question": "Ktore sekcje?", "placeholder": "", "options": ["Hero", "Oferta", "Cennik", "Opinie", "Kontakt", "Galeria", "O nas", "FAQ"], "stateKey": "sections", "multi": True},
        {"question": "Styl zdjec?", "placeholder": "np. Ciemne, jasne...", "options": ["Profesjonalne studyjne", "Naturalne / lifestyle", "Ciemne i dramaticzne", "Jasne i przestronne"], "stateKey": "photos"},
    ]
    random.shuffle(fb)
    return {"questions": fb[:5], "source": "fallback"}


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
        elif data.niche:
            try:
                unsplash_urls = search_unsplash(data.niche, count=4)
                if unsplash_urls:
                    u_str = ", ".join(unsplash_urls)
                    image_section = f"\nUNSPLASH PHOTOS (uzyj jako tlo/hero/sekcyjne): {u_str}"
            except Exception:
                pass

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

        # Select model based on mode
        selected_model = MODEL_MAP.get(data.mode or "normal", MODEL_MAP["normal"])
        print(f"[SiteMorph] Mode: {data.mode} -> Model: {selected_model}", flush=True)

        # 1) PRIMARY: Use selected model via OpenRouter
        if OPENROUTER_API_KEY:
            text, err = openrouter_generate_model(selected_model, SYSTEM_PROMPT, user_prompt, max_tokens=GEMINI_MAX_TOKENS)
            if text:
                try:
                    parsed = extract_json(text)
                    pfiles = parsed.get("files") or {}
                    ph = pfiles.get("main/frontend/preview.html", "")
                    if ph and len(ph) >= 2000:
                        parsed_files = pfiles
                        parsed_meta = parsed.get("meta", {})
                        provider = f"{data.mode} ({selected_model.split('/')[-1]})"
                    else:
                        warning = f"Za krotka strona ({len(ph)} znakow) - probuje backup"
                except Exception as e:
                    warning = f"Nieparsowalna odpowiedz ({str(e)[:120]})"
            else:
                warning = f"Model niedostepny: {err}"

        # 2) GEMINI = BACKUP, tylko jesli OpenRouter nie dal wyniku
        if parsed_files is None and GEMINI_API_KEY:
            text, err = gemini_generate(SYSTEM_PROMPT, user_prompt, max_tokens=GEMINI_MAX_TOKENS)
            if text:
                try:
                    parsed = extract_json(text)
                    pfiles = parsed.get("files") or {}
                    ph = pfiles.get("main/frontend/preview.html", "")
                    if ph and len(ph) >= 2000:
                        parsed_files = pfiles
                        parsed_meta = parsed.get("meta", {})
                        provider = "gemini (backup)"
                    else:
                        warning = (warning + " | " if warning else "") + f"Gemini: za krotka ({len(ph)})"
                except Exception as e:
                    warning = (warning + " | " if warning else "") + f"Gemini: {str(e)[:120]}"

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