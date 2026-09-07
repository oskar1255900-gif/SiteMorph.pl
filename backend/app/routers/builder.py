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

XKIRO_API_KEY = os.getenv("XKIRO_API_KEY", "sk-xt-fd5b3d4e86e51412c0a7d876b345ff77cd63e55729234f3e")
XKIRO_BASE_URL = "https://api.xkiro.com/v1"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_MAX_TOKENS = int(os.getenv("GEMINI_MAX_TOKENS", "90000"))


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
    per_try_timeout = 450
    try:
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            params={"key": GEMINI_API_KEY},
            json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": min(max_tokens, 65536),
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
    """XKIRO API (OpenAI-compatible via requests). Zwraca (tekst, None) albo (None, blad)."""
    if not XKIRO_API_KEY:
        return None, "Brak XKIRO_API_KEY"
    per_try_timeout = 450
    try:
        r = requests.post(
            f"{XKIRO_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {XKIRO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "qwen/qwen3.8-max:free",
                "temperature": temperature,
                "max_tokens": min(max_tokens, 90000),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            timeout=per_try_timeout,
        )
        print(f"[SiteMorph][XKIRO] qwen/qwen3.8-max:free -> HTTP {r.status_code}", flush=True)
        if r.status_code != 200:
            return None, f"XKIRO: HTTP {r.status_code} - {r.text[:200]}"
        data = r.json()
        choices = data.get("choices") or []
        if not choices:
            return None, "XKIRO: brak choices"
        text = choices[0].get("message", {}).get("content", "")
        if not text.strip():
            return None, "XKIRO: pusta odpowiedz"
        return text, None
    except Exception as e:
        return None, f"XKIRO: {str(e)[:150]}"


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
# Jeden spĂłjny format wyjscia: standalone HTML w polu files["main/frontend/src/App.tsx"].
# Nie ma tu juz sprzecznosci "jeden plik HTML" vs "projekt React" ktora byla w user_prompt.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are SiteMorph AI — an elite web designer and React developer. You build STUNNING, LIVING websites that feel like premium agency work (10,000 PLN quality). You are an ARTIST, not a template machine: every project gets its own structure, its own file layout, its own visual language.

YOUR JOB: Take the business info + design guidelines + ORIGINAL USER PROMPT and produce a COMPLETE React project. The design guidelines are your source of truth for colors, fonts, layout, sections and tone. Follow them exactly.

=====================================================================
CREATIVE FREEDOM — NOTHING IS HARDCODED
=====================================================================
- DO NOT use a fixed file template. There is NO required list of files.
- You decide the file structure based on what THIS business needs. A restaurant might need: Menu.tsx, Reservations.tsx, Gallery.tsx, ChefsNote.tsx. A law firm might need: PracticeAreas.tsx, Team.tsx, Publications.tsx. A SaaS might need: Features.tsx, Pricing.tsx, Changelog.tsx, Waitlist.tsx.
- Create 5-12 component files under main/frontend/src/components/ with meaningful names for THIS business.
- Only create a section if the design guidelines ask for it or it genuinely serves the business. No filler sections.
- The richer the design guidelines, the richer your output must be.

OUTPUT FORMAT — ONLY valid JSON:
{
  "files": {
    "main/frontend/preview.html": "***REQUIRED*** A complete, standalone, SELF-CONTAINED HTML file (inline CSS + JS, Tailwind CDN, Google Fonts, all animations working) that faithfully renders the ENTIRE site exactly as designed. This is what the client previews live. No React needed here — pure HTML/CSS/JS, 500+ lines, ALL sections, ALL animations, ALL real content.",
    "main/frontend/index.html": "...full HTML with Tailwind CDN, Google Fonts, Lucide, React 18...",
    "main/frontend/package.json": "...ALL of the INSTALLED LIBRARIES listed below as dependencies (every single one, versions ^latest), plus react/react-dom v18 and vite/tailwind devDeps...",
    "main/frontend/src/main.tsx": "...",
    "main/frontend/src/index.css": "...ALL custom CSS, keyframes, reveal classes...",
    "main/frontend/src/App.tsx": "...imports your components, holds IntersectionObserver + Lenis + shared state...",
    "main/frontend/src/components/<NAME1>.tsx": "...",
    "main/frontend/src/components/<NAME2>.tsx": "...",
    "main/frontend/src/components/<NAME3>.tsx": "..."
  },
  "meta": {"title":"...", "headline":"...", "subheadline":"...", "ctaText":"..."}
}

preview.html and the React project must look IDENTICAL — same sections, same content, same colors, same animations. preview.html is a hand-crafted HTML/CSS/JS replica of the React components.

=====================================================================
INSTALLED LIBRARIES — ALL of these ARE in package.json dependencies. YOU KNOW THEIR APIs AND YOU USE THEM:
=====================================================================
This exact npm install command was run for the project, so every one of these packages is available to import:

npm install tailwindcss clsx tailwind-merge class-variance-authority framer-motion gsap @gsap/react @studio-freight/lenis @formkit/auto-animate lucide-react @fontsource/inter @fontsource/playfair-display embla-carousel-react canvas-confetti @radix-ui/react-dialog

Your package.json MUST include ALL of the following as dependencies (write the full list, versions ^ latest):
- tailwindcss (v3, with postcss + autoprefixer in devDependencies)
- clsx, tailwind-merge, class-variance-authority (cva) — utility for clean className composition
- framer-motion — page transitions, scroll reveals, gestures, stagger (import from 'framer-motion')
- gsap + @gsap/react — timeline animations, ScrollTrigger parallax
- @studio-freight/lenis — buttery smooth scrolling (init in App.tsx useEffect)
- @formkit/auto-animate — one-line animations for list add/remove
- lucide-react — consistent icons everywhere
- @fontsource/inter + @fontsource/playfair-display — self-hosted fonts (import in index.css or main.tsx)
- embla-carousel-react — carousels/sliders (menu, gallery, testimonials)
- canvas-confetti — celebration effects after form submit
- @radix-ui/react-dialog — accessible modals
- react, react-dom (v18)

USE THEM LIBERALLY: every component should import something real from this stack. clsx+tailwind-merge for class composition, framer-motion for all entrance animations, lenis for scroll, lucide-react for every icon, embla for carousels, canvas-confetti after successful form submit, radix dialog for any modal (menu item detail, gallery lightbox, reservation confirmation).

PICK THE RIGHT TOOLS: don't use all of them everywhere — choose what fits. Framer Motion for most animations, GSAP only for cinematic scroll effects, Lenis for scroll feel, Embla for the menu/gallery carousel, Radix Dialog for modals, canvas-confetti after a successful reservation.

=====================================================================
FONTS — choose 1-2 that match the business personality
=====================================================================
- Inter — clean modern, default body font
- Playfair Display — elegant, luxury, restaurants, hotels, law
- Space Grotesk — techy, startups, modern
- DM Serif Display — editorial, boutique, cafes
- Bebas Neue — bold condensed, sports, streetwear, kebabs, fast food
- Cormorant Garamond — high-end, fine dining
- Outfit — friendly modern, health, beauty
- JetBrains Mono — code, SaaS, dev tools
Load them via Google Fonts <link> in index.html. Headings get the character font, body gets Inter (or another readable font).

=====================================================================
MANDATORY VISUAL QUALITY (non-negotiable)
=====================================================================
1. MOTION — the site MUST feel alive:
   - Every section fades/slides in on scroll (IntersectionObserver + .reveal, or framer-motion whileInView)
   - Hero headline: staggered word/line reveal (framer-motion staggerChildren)
   - Buttons: hover scale, active press, magnetic feel
   - Cards: hover lift + shadow grow + image zoom (duration-500)
   - Nav: backdrop-blur when scrolled, smooth anchor scroll
   - At least ONE signature animation per site: marquee, parallax hero image, counter-up numbers, tilt cards, or scroll-driven hero zoom
   - Smooth scrolling with Lenis

2. LAYOUT — no boring centered-column-skeleton:
   - Hero: asymmetric split, or full-bleed image with overlaid content, or editorial magazine grid — pick per business
   - Mix layouts across sections: bento grids, numbered lists, alternating rows, full-width band + narrow content
   - Generous whitespace (py-20 to py-32 sections)
   - Use borders/divider lines to structure, not just cards everywhere

3. THEME & COLORS — from design guidelines only:
   - Use the EXACT palette from design guidelines (primary, secondary, accent, background, text, muted)
   - Light or dark theme as the guidelines say — never generic blue unless guidelines say blue
   - Background, card surfaces, borders must all come from the palette
   - Accent color used sparingly for CTAs, links, highlights

4. IMAGES — specific, not generic:
   - Use the image URLs from design guidelines if provided
   - Otherwise pick Unsplash photo IDs that match the business (e.g. kebab: grilled meat, flatbread; cafe: latte art, pastries)
   - Every image: rounded corners, object-cover, hover zoom on cards, alt text

5. FORMS — built for THIS business:
   - Restaurant/kebab: imię, telefon, data (date picker), godzina, liczba gości, wiadomość → canvas-confetti on submit
   - Service: imię, email, telefon, wybór usługi, wiadomość
   - Landing: imię, email, wiadomość
   - Forms must look designed: floating labels or clean fields, focus rings, validation messages in Polish

6. REAL CONTENT — never placeholders:
   - Use the ORIGINAL USER PROMPT data first (name, address, phone, rating, reviews, menu items)
   - Fill gaps with realistic Polish content, prices in PLN
   - Zero lorem ipsum, zero "...", zero "TODO", zero "ADRES DO UZUPEŁNIENIA"
   - BANNED words: "profesjonalny", "kompleksowy", "najwyzsza jakosc", "indywidualne podejscie", "z przyjemnoscia pomozemy"

7. DETAILS THAT MAKE IT PREMIUM:
   - Custom cursor hover states on cards, gradient text accents, noise/grain overlay, subtle pattern backgrounds
   - Section eyebrows (small uppercase labels), numbered sections ("01 / Menu")
   - Polish typography: proper quotes, correct chars, balanced headings
   - Responsive: mobile-first, tablet 2-col, desktop full layout

=====================================================================
MINIMUM BAR — if you don't meet these, the site is a FAIL
=====================================================================
- preview.html: 700+ lines, fully self-contained, EVERY section animated and interactive (hover, scroll reveals, working nav), zero placeholders.
- Each React component: 50+ lines, typed props, real Polish content, at least one animation, at least one hover interaction.
- At least 6 sections. At least 3 DIFFERENT layout patterns (no repeated card grids everywhere).
- At least 5 distinct animation types across the page (fade-up, stagger, marquee, parallax, counter-up, tilt, scroll zoom).
- Every Unsplash image MUST use a real existing photo ID (images.unsplash.com/photo-<id>?w=1600&q=80). NEVER invent IDs.
- No section may consist of a single centered paragraph. No page may be 90% empty white space.
- Background must have depth: subtle gradient, grain, pattern, or image — never flat color without reason.
- Custom scrollbar, selection color, focus-visible states, meta description, favicon (inline SVG data URI).
- You have a 90000-token budget — USE IT. Long, detailed, finished code. The richer the output, the better the site.

JSON RULES:
- Each file = complete, working code (50+ lines per component)
- Newlines = \n in JSON string, NO backticks inside JSON values
- Each file = ONE string value, Polish UTF-8 works normally
- index.css contains ALL keyframes and utility classes used by components
- App.tsx wires everything: Lenis init, IntersectionObserver, global state (e.g. cart, modal)

THE DESIGN GUIDELINES ARE LAW — colors, fonts, sections, tone come from them. The ORIGINAL USER PROMPT is your content source. Combine both and create something beautiful.
"""

def openrouter_generate_model(model: str, system_prompt: str, user_prompt: str, temperature: float = 0.85, max_tokens: int = 90000):
    """Generate using XKIRO (OpenAI-compatible) with any model."""
    if not XKIRO_API_KEY:
        return None, "Brak XKIRO_API_KEY"
    # Ultra+ (Fable) needs more time for complex backend generation
    per_try_timeout = 600 if "fable" in model.lower() else 450
    try:
        r = requests.post(
            f"{XKIRO_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {XKIRO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "temperature": temperature,
                "max_tokens": min(max_tokens, 90000),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            timeout=per_try_timeout,
        )
        print(f"[SiteMorph][XKIRO] {model} -> HTTP {r.status_code}", flush=True)
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
    "normal": "qwen/qwen3.8-max:free",         # Free, 1M context, landing page only
    "ultra": "openai/gpt-5.6-luna",            # $0.025/strona, better quality landing
    "ultra+": "anthropic/claude-fable-5-1"      # Premium, backend features (reservations, admin)
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
# DESIGN AGENT -- Gemini 3.8 Flash creates design_guidelines.json
# ---------------------------------------------------------------------------
DESIGN_AGENT_SYSTEM = """You are a senior UI/UX design agent. Your job is to analyze a business
and create a complete design system before any code is written.

You will receive:
- Business name, niche, description
- User answers to wizard questions (style, colors, sections, photos preference)
- Any attached images

You MUST return a JSON object with this EXACT structure:

{
  "design_guidelines": {
    "brand_name": "Business Name",
    "concept": "One sentence describing the visual concept",
    "color_palette": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "background": "#hex (light or dark)",
      "text": "#hex",
      "muted": "#hex"
    },
    "typography": {
      "heading_font": "Font name from Google Fonts",
      "body_font": "Font name from Google Fonts",
      "heading_weight": "700 or 800",
      "heading_size_h1": "48-80px range",
      "heading_size_h2": "32-48px range",
      "body_size": "16-18px"
    },
    "layout": {
      "max_width": "1200px",
      "section_padding": "80-140px",
      "grid": "description of grid strategy",
      "hero_style": "asymmetric / centered / split"
    },
    "visual_effects": {
      "shadows": "description",
      "borders": "description",
      "gradients": "description or none",
      "animations": "fade-in / slide-up / parallax / none"
    },
    "image_search_queries": [
      "search term 1 for Unsplash hero image",
      "search term 2 for section image",
      "search term 3 for additional image"
    ],
    "sections": [
      {
        "id": "unique-section-name-for-this-business",
        "title": "Section title in Polish",
        "subtitle": "Section subtitle",
        "cta_text": "Button text",
        "description": "What this section contains, its layout, its real content taken from the ORIGINAL USER PROMPT (name, menu, address, phone, reviews, hours)"
      }
    ],
    "content_tone": "Description of writing style (e.g. warm and casual, professional and clean)",
    "special_instructions": "Unique requirements: must include original prompt data (address, phone, menu items, rating), signature animations to use, component files to create"
  }
}

RULES:
- You are a senior creative director. Design a UNIQUE concept for THIS business — never a template.
- The ORIGINAL USER PROMPT is your content source of truth: business name, address, phone, rating, menu items, reviews — embed them in sections.
- Choose 2 fonts that match the personality (serif for elegant, condensed for street food, mono for tech...).
- Decide the number of sections YOURSELF: 4-10 based on what the business needs. No filler.
- Pick colors that fit THIS specific business (not generic blue!).
- Theme: decide light or dark based on business + prompt. If prompt is ambiguous, pick what makes the business look best.
- Search queries must be specific (not "business photo" but "kebab grilled meat flatbread dark")
- In special_instructions: name the exact component files to create (e.g. Menu.tsx, Reservations.tsx, Gallery.tsx) and the signature animation(s).
- All text content must be in Polish.
- Return ONLY the JSON, no markdown, no explanation."""


class DesignAgentInput(BaseModel):
    business_name: str = ""
    niche: str = ""
    description: str = ""
    style: Optional[str] = ""
    accent_color: Optional[str] = ""
    layout: Optional[str] = ""
    sections: Optional[List[str]] = None
    photo_style: Optional[str] = ""
    answers: Optional[dict] = None
    full_prompt: str = ""  # original user prompt — must be embedded in guidelines


@router.post("/design-agent")
def run_design_agent(data: DesignAgentInput):
    """Design Agent (Gemini 3.8 Flash) creates design guidelines before code generation."""
    
    user_prompt = f"""ORIGINAL USER PROMPT (source of truth for content):
{data.full_prompt or data.description or ''}

Business: {data.business_name}
Niche: {data.niche}
Description: {data.description}
Style preference: {data.style or 'not specified'}
Accent color: {data.accent_color or 'not specified'}
Layout preference: {data.layout or 'not specified'}
Photo style: {data.photo_style or 'not specified'}
Sections preference: {', '.join(data.sections or [])}
User answers: {json.dumps(data.answers or {}, ensure_ascii=False)}

Create a complete design system for this business. Include the original prompt content (name, address, phone, menu, reviews) in your sections. Return ONLY the JSON."""

    if GEMINI_API_KEY:
        text, err = gemini_generate(DESIGN_AGENT_SYSTEM, user_prompt, temperature=0.8, max_tokens=4000)
        if text:
            try:
                cleaned = text.strip().strip("`json").strip("`").strip()
                parsed = json.loads(cleaned)
                guidelines = parsed.get("design_guidelines") or parsed
                if isinstance(guidelines, dict) and guidelines.get("color_palette"):
                    return {"status": "success", "design_guidelines": guidelines, "source": "gemini"}
            except Exception as e:
                print(f"[DesignAgent] Parse error: {e}", flush=True)
    
    # Fallback: generate basic guidelines from inputs
    color = data.accent_color or "#2563eb"
    is_dark = "ciemny" in (data.style or "").lower() or "dark" in (data.style or "").lower()
    bg = "#0a0a0a" if is_dark else "#fafafa"
    text_color = "#ffffff" if is_dark else "#111827"
    
    fallback = {
        "brand_name": data.business_name,
        "concept": f"Modern, clean website for {data.niche or 'business'}",
        "color_palette": {
            "primary": color,
            "secondary": color + "80",
            "accent": color,
            "background": bg,
            "text": text_color,
            "muted": "#6b7280"
        },
        "typography": {
            "heading_font": "Inter",
            "body_font": "Inter",
            "heading_weight": "800",
            "heading_size_h1": "64px",
            "heading_size_h2": "40px",
            "body_size": "16px"
        },
        "layout": {
            "max_width": "1200px",
            "section_padding": "100px",
            "grid": "responsive 1-3 column grid",
            "hero_style": "asymmetric"
        },
        "visual_effects": {
            "shadows": "subtle card shadows",
            "borders": "rounded corners 16px",
            "gradients": "none",
            "animations": "fade-in on scroll"
        },
        "image_search_queries": [data.niche or "business", "professional workspace", "team photo"],
        "sections": [
            {"id": "hero", "title": data.business_name, "subtitle": data.description[:100] if data.description else "", "cta_text": "Kontakt", "description": "Full-width hero with image"},
            {"id": "services", "title": "Nasza oferta", "items": ["Usługa 1", "Usługa 2", "Usługa 3"], "description": "3-column grid of services"},
            {"id": "contact", "title": "Kontakt", "description": "Formularz kontaktowy + dane"}
        ],
        "content_tone": "professional yet friendly",
        "special_instructions": ""
    }
    return {"status": "success", "design_guidelines": fallback, "source": "fallback"}



# ---------------------------------------------------------------------------
# GENERATE QUESTIONS -- DeepSeek V4 Pro (smart: skips questions already in prompt)
# ---------------------------------------------------------------------------
_BUSINESS_KEYWORDS = {
    "restaurac": "Restauracja", "kebab": "Kebab", "jedzenie": "Restauracja",
    "food": "Restauracja", "pizzeria": "Pizzeria", "bistro": "Bistro",
    "doner": "Kebab", "shawarma": "Kebab", "szawarma": "Kebab",
    "bar": "Bar", "pub": "Pub", "piwo": "Bar", "kawiarnia": "Kawiarnia",
    "barber": "Barber", "fryzjer": "Barber", "strzyz": "Barber", "salon fryzj": "Barber",
    "beauty": "Salon beauty", "salon urod": "Salon beauty", "manicure": "Salon beauty",
    "paznokci": "Salon beauty", "spa": "Salon beauty", "kosmetyczk": "Salon beauty",
    "silowni": "Silownia", "fitness": "Silownia", "gym": "Silownia",
    "warsztat": "Warsztat", "mechanik": "Warsztat", "napraw": "Warsztat",
    "kwiaciarni": "Kwiaciarnia", "kwiat": "Kwiaciarnia",
    "prawnik": "Prawnik", "kancelaria": "Prawnik", "adwokat": "Prawnik",
    "dentyst": "Dentysta", "stomatolog": "Dentysta",
    "nieruchomosc": "Nieruchomosci", "mieszkan": "Nieruchomosci",
    "hotel": "Hotel", "nocleg": "Hotel",
    "coffee": "Kawiarnia", "kawa": "Kawiarnia",
    "sklep": "Sklep", "butik": "Sklep", "moda": "Sklep",
    "saas": "Startup SaaS", "landing page": "Landing page", "startup": "Startup",
    "pizza": "Pizzeria", "burger": "Burgerownia", "lodziarnia": "Lodziarnia",
    "cukierni": "Cukiernia", "piekarni": "Piekarnia", "warzyw": "Sklep warzywny",
    "optic": "Optyk", "okulista": "Optyk", "apteka": "Apteka",
    "tatuaz": "Salon tatuazu", "tattoo": "Salon tatuazu",
    "joga": "Studio jogi", "yoga": "Studio jogi", "trener": "Trener personalny",
    "gabinet": "Gabinet", "lekarz": "Gabinet lekarski",
    "mysl": "Mysliwy", "wedkarsk": "Sklep wedkarski",
    "agencja": "Agencja", "marketing": "Agencja marketingowa",
    "fotograf": "Fotograf", "fotografi": "Fotograf",
    "tlumacz": "Tlumacz", "biuro": "Biuro tlumaczen",
}


def _detect_niche_from_text(text: str) -> str:
    t = text.lower()
    for kw, niche in _BUSINESS_KEYWORDS.items():
        if kw in t:
            return niche
    return ""


class QuestionInput(BaseModel):
    business_name: str = ""
    description: str = ""
    full_prompt: str = ""  # raw user prompt for Gemini analysis


QUESTIONS_SYSTEM_PROMPT = (
    "You are SiteMorph AI - an expert web designer. The user wrote a prompt describing their website.\n\n"
    "STEP 1: ANALYZE the prompt. Identify what is ALREADY clear:\n"
    "- Business type (restaurant, kebab, barber, cafe, salon, etc)\n"
    "- Location/address\n"
    "- Contact info (phone, email)\n"
    "- Colors or style preference\n"
    "- Sections they want (menu, pricing, gallery, contact)\n\n"
    "STEP 2: Generate 2-4 questions ONLY about what is NOT clear.\n"
    "If business type is clear → DO NOT ask about it.\n"
    "If address is provided → DO NOT ask about location.\n"
    "If phone/email provided → DO NOT ask about contact.\n"
    "If colors are described → DO NOT ask about colors.\n\n"
    "STEP 3: Return ONLY a JSON array. ALL text must be in POLISH.\n"
    "Each element: {\"question\": \"Polish text 5-12 words\", \"placeholder\": \"example\", \"options\": [\"option1\", \"option2\", \"option3\"], \"stateKey\": \"key\", \"multi\": false}\n"
    "stateKey options: theme|layout|sections|tone|photos|extras (NOT niche if business is clear)\n"
    "PREFERRED theme question when relevant: ask about motyw (jasny/ciemny) with stateKey 'theme' and options Jasny/Ciemny\n"
    "Return ONLY the JSON array. No explanation, no markdown."
)


@router.post("/generate-questions")
def generate_questions(data: QuestionInput):
    """DeepSeek V4 Pro ANALYZES the user prompt first.
    Only asks questions about things NOT already clear from the prompt."""
    prompt_text = data.full_prompt or data.description or data.business_name or ""

    user_msg = (
        'USER PROMPT: "' + prompt_text + '"\n\n'
        'Analyze this prompt. What is ALREADY clear? '
        'Generate questions ONLY for what is missing. All questions in POLISH.'
    )

    # Use DeepSeek V4 Pro for thorough prompt analysis (free, deep reasoning)
    if XKIRO_API_KEY:
        text, err = openrouter_generate_model("deepseek/deepseek-v4-pro", QUESTIONS_SYSTEM_PROMPT, user_msg, temperature=0.7, max_tokens=2000)
        if text:
            try:
                cleaned = text.strip()
                if cleaned.startswith("```"):
                    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
                    cleaned = re.sub(r"\s*```$", "", cleaned)
                questions = json.loads(cleaned.strip())
                if isinstance(questions, list) and len(questions) >= 2:
                    valid = [q for q in questions if isinstance(q, dict) and q.get("question") and q.get("stateKey")]
                    if len(valid) >= 1:
                        detected = _detect_niche_from_text(prompt_text)
                        resp = {"questions": valid[:5], "source": "deepseek-v4-pro"}
                        if detected:
                            resp["detected_niche"] = detected
                        return resp
            except Exception as e:
                print(f"[Questions] DeepSeek parse error: {e}", flush=True)

    # SMART FALLBACK
    import random
    detected_niche = _detect_niche_from_text(prompt_text)
    fb = [
        {"question": "Jaki to biznes?", "placeholder": "np. Restauracja, Barber...", "options": ["Restauracja", "Barber", "Salon beauty", "Kawiarnia", "Warsztat", "Prawnik"], "stateKey": "niche"},
        {"question": "Jaki kolor przewodni?", "placeholder": "np. Zloty, granatowy...", "options": ["Niebieski #2563eb", "Ciemny #111827", "Zloty #d97706", "Zielony #059669", "Fioletowy #7c3aed", "Rozowy #ec4899"], "stateKey": "accent"},
        {"question": "Jaki klimat strony?", "placeholder": "np. Elegancki, sportowy...", "options": ["Nowoczesny i minimalistyczny", "Ciemny i premium", "Cieply i przytulny", "Odwazny i kolorowy"], "stateKey": "layout"},
        {"question": "Ktore sekcje na stronie?", "placeholder": "", "options": ["Hero", "Oferta", "Cennik", "Opinie", "Kontakt", "Galeria", "O nas", "FAQ"], "stateKey": "sections", "multi": True},
        {"question": "Styl zdjec?", "placeholder": "np. Ciemne, jasne...", "options": ["Profesjonalne studyjne", "Naturalne / lifestyle", "Ciemne i dramaticzne", "Jasne i przestronne"], "stateKey": "photos"},
    ]
    if detected_niche:
        fb = [q for q in fb if q["stateKey"] != "niche"]
    random.shuffle(fb)
    result = fb[:4]
    resp = {"questions": result, "source": "fallback"}
    if detected_niche:
        resp["detected_niche"] = detected_niche
    return resp


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

        # First run Design Agent to get guidelines
        design_guidelines_str = ""
        try:
            da_input = DesignAgentInput(
                business_name=data.business_name,
                niche=data.niche,
                description=data.description,
                style=data.style,
                accent_color=data.accent_color,
                layout=data.layout,
                sections=data.sections,
                photo_style=data.photo_style,
                answers=data.extraPrompt and {"original_prompt": data.extraPrompt} or None,
                full_prompt=data.extraPrompt or "",
            )
            da_result = run_design_agent(da_input)
            if da_result.get("design_guidelines"):
                design_guidelines_str = f"\nDESIGN GUIDELINES (created by Design Agent):\n{json.dumps(da_result['design_guidelines'], ensure_ascii=False, indent=2)}"
                print(f"[Builder] Design Agent: {da_result.get('source', 'unknown')}", flush=True)
        except Exception as e:
            print(f"[Builder] Design Agent fallback: {e}", flush=True)

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
{design_guidelines_str}
---

Wygeneruj kompletne strone HTML. Uzyj DESIGN GUIDELINES do kolorow, fontow, layoutu i tresci.
Zwroc JSON z plikami React TSX. Bez pytan."""

        warning = None
        provider = "fallback"
        parsed_files = None
        parsed_meta = None

        # Select model based on mode
        selected_model = MODEL_MAP.get(data.mode or "normal", MODEL_MAP["normal"])
        print(f"[SiteMorph] Mode: {data.mode} -> Model: {selected_model}", flush=True)

        # 1) PRIMARY: Use selected model via OpenRouter
        if XKIRO_API_KEY:
            text, err = openrouter_generate_model(selected_model, SYSTEM_PROMPT, user_prompt, max_tokens=GEMINI_MAX_TOKENS)
            if text:
                try:
                    parsed = extract_json(text)
                    pfiles = parsed.get("files") or {}
                    app_tsx = pfiles.get("main/frontend/src/App.tsx", "")
                    total_len = len(json.dumps(pfiles))
                    # AI invents its own component names — accept any valid multi-file project
                    if app_tsx and total_len >= 8000:
                        parsed_files = pfiles
                        parsed_meta = parsed.get("meta", {})
                        provider = f"{data.mode} ({selected_model.split('/')[-1]})"
                    else:
                        warning = f"Za malo plikow - probuje backup"
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
                    app_tsx = pfiles.get("main/frontend/src/App.tsx", "")
                    if app_tsx and len(json.dumps(pfiles)) >= 8000:
                        parsed_files = pfiles
                        parsed_meta = parsed.get("meta", {})
                        provider = "gemini (backup)"
                    else:
                        warning = (warning + " | " if warning else "") + f"Gemini: za krotka ({len(json.dumps(pfiles))})"
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

        # Ensure React TSX files exist jesli ich nie ma (wrapper przez iframe)
        if parsed_files and "main/frontend/App.tsx" in parsed_files:
            ph = parsed_files["main/frontend/src/App.tsx"]
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
                    '"dependencies":{"react":"^18.2.0","react-dom":"^18.2.0",'
                    '"clsx":"^2.1.0","tailwind-merge":"^2.2.0","class-variance-authority":"^0.7.0",'
                    '"framer-motion":"^11.0.0","gsap":"^3.12.0","@gsap/react":"^2.1.0",'
                    '"@studio-freight/lenis":"^1.0.0","@formkit/auto-animate":"^0.8.0",'
                    '"lucide-react":"^0.300.0","@fontsource/inter":"^5.0.0","@fontsource/playfair-display":"^5.0.0",'
                    '"embla-carousel-react":"^8.0.0","canvas-confetti":"^1.9.0","@radix-ui/react-dialog":"^1.0.0"},'
                    '"devDependencies":{"@types/react":"^18.2.0","@types/canvas-confetti":"^1.6.0",'
                    '"@vitejs/plugin-react":"^4.2.0",'
                    '"autoprefixer":"^10.4.0","postcss":"^8.4.0","tailwindcss":"^3.4.0",'
                    '"typescript":"^5.3.0","vite":"^5.0.0"}}'
                )
                parsed_files["main/frontend/src/App.tsx"] = (
                    "import { useEffect, useRef } from 'react'\n\n"
                    "export default function App() {\n"
                    "  const ref = useRef<HTMLIFrameElement>(null)\n"
                    "  useEffect(() => {\n"
                    "    fetch('/App.tsx').then(r => r.text()).then(html => {\n"
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
                parsed_files["main/frontend/src/App.tsx"] = ph

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
            "openrouter_model": None,
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