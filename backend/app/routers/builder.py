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

SYSTEM_PROMPT = """You are SiteMorph AI — a senior web designer who creates stunning, production-ready websites for local Polish businesses. Your output must look like it was made by a top design agency, NOT like generic AI output.

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
STEP 2: CREATE ONE STUNNING HTML FILE
═══════════════════════════════════════════════
Generate ONE complete, self-contained HTML file with embedded CSS and JavaScript.
This file must be 400+ lines and look like a real, hand-coded website.

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no text before/after:
{
  "thinking": {
    "business_analysis": "2-3 sentences about the business and design decisions",
    "design_direction": "Colors, fonts, mood, photo style chosen and why",
    "content_plan": "What sections, what content in each"
  },
  "files": {
    "main/frontend/preview.html": "THE COMPLETE HTML FILE (400+ lines)"
  },
  "meta": {
    "title": "Business Name",
    "headline": "Main headline from hero",
    "subheadline": "Subtitle from hero",
    "ctaText": "CTA button text"
  }
}

═══════════════════════════════════════════════
STEP 3: VISUAL QUALITY REQUIREMENTS
═══════════════════════════════════════════════
The HTML file MUST include ALL of:

STRUCTURE:
- <script src="https://cdn.tailwindcss.com"></script>
- Google Fonts: Inter (400-900) + one accent font
- <script src="https://unpkg.com/lucide@latest"></script> + lucide.createIcons()
- Responsive (Tailwind sm/md/lg breakpoints)
- Smooth scroll behavior

SECTIONS (6 minimum):
1. NAVBAR: sticky, logo (text-based), links, CTA button
2. HERO: BIG headline (48-72px, weight 800), subtitle, 2 CTA buttons, hero image
3. OFFER/MENU: 4-6 cards with icons, descriptions, prices
4. TESTIMONIALS: 3-4 reviews with stars, names, roles
5. CONTACT: form (name, email, phone, message, submit button) + address/hours
6. FOOTER: links, copyright, social icons

TYPOGRAPHY:
- Headlines: 48-72px, weight 800, letter-spacing: -0.02em
- Body: 16px, line-height 1.6, weight 400
- Section titles: 32-40px, weight 700
- Use Polish characters: ą ć ę ł ń ó ś ź ż — they MUST work correctly

COLORS:
- ONE accent color (chosen based on industry, NOT default blue)
- Light background (#fafafa or white) OR dark (#0a0a0a) — never mix
- Text: dark on light, light on dark — high contrast
- Cards: subtle shadows, rounded corners (rounded-2xl)

SPACING:
- Sections: 80-120px vertical padding between them
- Content max-width: 1200px, centered
- Cards: 24-32px internal padding
- Elements: 16-24px gaps

IMAGES:
- Use Unsplash: <img src="https://source.unsplash.com/800x600/?SPECIFIC-TERM" />
- SPECIFIC terms: "barber-shop", "restaurant-plating", "law-office-modern", "gym-interior"
- NEVER: "business", "office", "generic"
- Images must have object-cover, rounded corners

ANIMATIONS (CSS only, no JS frameworks):
- @keyframes fadeInUp: opacity 0 translateY(30px) → opacity 1 translateY(0)
- @keyframes fadeIn: opacity 0 → opacity 1
- Apply to sections on load with staggered delays (0.1s, 0.2s, 0.3s...)
- Hover on cards: transform translateY(-4px), box-shadow increases
- Hover on buttons: transform scale(1.02), brightness 1.1
- Smooth transitions: transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)

FORM (in Contact section):
- Fields: Name (required), Email (required), Phone, Message (required, textarea)
- Submit button: "Wyślij wiadomość" or "Skontaktuj się"
- Modern styling: rounded-xl inputs, focus ring, subtle border
- action="#" method="POST"

WHAT MAKES IT LOOK PROFESSIONAL:
- Asymmetric hero layout (text left, image right) — NOT centered generic
- Gradient accents on headlines or buttons
- Subtle background patterns or gradients
- Floating badges or ratings (★ 4.9 · 126 opinii)
- Proper font hierarchy (big headline, small labels, medium body)
- White space — don't cram everything together
- Consistent color usage throughout

═══════════════════════════════════════════════
STEP 4: CONTENT RULES
═══════════════════════════════════════════════
- Use ALL facts from the user's description (name, phone, address, hours, prices)
- NEVER invent phone numbers or addresses if not provided — use "[telefon]" placeholder
- Prices: use real ones if provided, otherwise realistic for Polish market
- Reviews: 3-4 with Polish first names, specific details (not "super!")
- Write like a human describing their business, NOT like a marketing agency
- BANNED words: "profesjonalny", "kompleksowy", "najwyższa jakość", "wieloletnie doświadczenie"
- Zero lorem ipsum, zero "...", zero TODO, zero questions to the user
- Polish language throughout — proper grammar, natural phrasing

═══════════════════════════════════════════════
CRITICAL JSON RULES
═══════════════════════════════════════════════
- The HTML string must use ONLY double quotes for attributes
- Newlines in HTML = literal \n in JSON string
- NO backticks in JSON strings
- The ENTIRE HTML file = ONE line in the JSON
- HTML file must be 400+ lines when rendered
- Include Polish characters normally — ą ć ę ł ń ó ś ź ż"""


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
    "normal": "qwen/qwen3-coder-plus:free",   # Free, 1M context, coding-focused
    "ultra": "anthropic/claude-fable-5-1",      # Best quality, autonomous coding
}


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