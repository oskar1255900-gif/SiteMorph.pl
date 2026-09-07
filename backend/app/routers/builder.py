from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Tuple
import json
import os
import re
import time
import uuid
import requests

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UploadedAsset
from app.routers.builder_fallback_modern import fallback_content


load_dotenv()

router = APIRouter(prefix="/api/builder", tags=["AI Builder"])


# =============================================================================
# CONFIG
# =============================================================================

# Never hardcode API keys in source code.
XKIRO_API_KEY = os.getenv("XKIRO_API_KEY", "").strip()
XKIRO_BASE_URL = os.getenv("XKIRO_BASE_URL", "https://api.xkiro.com/v1").rstrip("/")

GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY") or "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

MAX_OUTPUT_TOKENS = int(os.getenv("SITEMORPH_MAX_OUTPUT_TOKENS", "90000"))
AI_TIMEOUT = int(os.getenv("SITEMORPH_AI_TIMEOUT", "450"))
FAST_AI_TIMEOUT = int(os.getenv("SITEMORPH_FAST_AI_TIMEOUT", "180"))

# Main generation modes. Kept exactly in the spirit of your current builder.
MODEL_MAP = {
    "normal": os.getenv("SITEMORPH_MODEL_NORMAL", "qwen/qwen3.8-max:free"),
    "ultra": os.getenv("SITEMORPH_MODEL_ULTRA", "openai/gpt-5.6-luna"),
    "ultra+": os.getenv("SITEMORPH_MODEL_ULTRA_PLUS", "anthropic/claude-fable-5"),
}

# Specialist agents. These do not replace the main website model.
ART_DIRECTOR_MODEL = os.getenv("SITEMORPH_ART_DIRECTOR_MODEL", "deepseek/deepseek-v4-pro")
CRITIC_MODEL = os.getenv("SITEMORPH_CRITIC_MODEL", "deepseek/deepseek-v4-pro")
QUESTIONS_MODEL = os.getenv("SITEMORPH_QUESTIONS_MODEL", "deepseek/deepseek-v4-flash")
PREVIEW_MODEL = os.getenv("SITEMORPH_PREVIEW_MODEL", "qwen/qwen3.8-max:free")

# One automatic critique/revision pass gives a large quality improvement, but costs
# another generation request. Disable with SITEMORPH_ENABLE_REFINEMENT=0 if needed.
ENABLE_REFINEMENT = os.getenv("SITEMORPH_ENABLE_REFINEMENT", "1") == "1"
REFINE_NORMAL = os.getenv("SITEMORPH_REFINE_NORMAL", "1") == "1"
REFINE_PREMIUM = os.getenv("SITEMORPH_REFINE_PREMIUM", "1") == "1"
QUALITY_TARGET = float(os.getenv("SITEMORPH_QUALITY_TARGET", "8.6"))

# If your live preview still expects a self-contained preview.html, keep this on.
# If your frontend previews the actual Vite project, set it to 0 and save one AI call.
GENERATE_STANDALONE_PREVIEW = os.getenv("SITEMORPH_STANDALONE_PREVIEW", "1") == "1"

UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "").strip()


# =============================================================================
# DATA MODELS
# =============================================================================


class BuilderInput(BaseModel):
    business_name: str
    niche: str
    description: str
    style: Optional[str] = ""
    colors: Optional[str] = ""
    sections: Optional[List[str]] = None
    extraPrompt: Optional[str] = ""
    package: Optional[str] = "starter"
    credits: Optional[int] = 10
    accent_color: Optional[str] = None
    layout: Optional[str] = None
    fonts: Optional[str] = None
    photo_style: Optional[str] = None
    image_urls: Optional[List[str]] = None
    mode: Optional[str] = "normal"


class DesignAgentInput(BaseModel):
    business_name: str = ""
    niche: str = ""
    description: str = ""
    style: Optional[str] = ""
    colors: Optional[str] = ""
    accent_color: Optional[str] = ""
    layout: Optional[str] = ""
    fonts: Optional[str] = ""
    sections: Optional[List[str]] = None
    photo_style: Optional[str] = ""
    answers: Optional[dict] = None
    full_prompt: str = ""


class QuestionInput(BaseModel):
    business_name: str = ""
    description: str = ""
    full_prompt: str = ""


# =============================================================================
# JSON / MODEL HELPERS
# =============================================================================


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def extract_json(text: str) -> dict:
    """Best-effort extraction of one JSON object from model output."""
    if not text or not text.strip():
        raise ValueError("Pusta odpowiedz modelu")

    cleaned = text.strip()

    fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.IGNORECASE | re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Brak obiektu JSON w odpowiedzi")

    return json.loads(cleaned[start : end + 1])


def extract_json_array(text: str) -> list:
    """Best-effort extraction of a JSON array."""
    if not text or not text.strip():
        raise ValueError("Pusta odpowiedz modelu")

    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.IGNORECASE | re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()

    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Brak tablicy JSON w odpowiedzi")

    return json.loads(cleaned[start : end + 1])


def xkiro_generate_model(
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.72,
    max_tokens: int = MAX_OUTPUT_TOKENS,
    timeout: Optional[int] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Call any OpenAI-compatible model exposed by XKIRO."""
    if not XKIRO_API_KEY:
        return None, "Brak XKIRO_API_KEY"

    try:
        # Some models reject max_tokens above their real output ceiling (HTTP 400).
        output_cap = 65000 if ("luna" in model or "fable" in model) else MAX_OUTPUT_TOKENS
        r = requests.post(
            f"{XKIRO_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {XKIRO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "temperature": temperature,
                "max_tokens": min(max_tokens, output_cap),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            timeout=timeout or AI_TIMEOUT,
        )

        print(f"[SiteMorph][XKIRO] {model} -> HTTP {r.status_code}", flush=True)

        if r.status_code != 200:
            return None, f"{model}: HTTP {r.status_code} - {r.text[:400]}"

        data = r.json()
        choices = data.get("choices") or []
        if not choices:
            return None, f"{model}: brak choices"

        content = choices[0].get("message", {}).get("content", "")
        if isinstance(content, list):
            # Some OpenAI-compatible gateways can return a list of content parts.
            content = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )

        if not str(content).strip():
            return None, f"{model}: pusta odpowiedz"

        return str(content), None

    except Exception as e:
        return None, f"{model}: {str(e)[:240]}"


def gemini_generate(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.72,
    max_tokens: int = MAX_OUTPUT_TOKENS,
) -> Tuple[Optional[str], Optional[str]]:
    """Gemini backup provider. It is not the main SiteMorph generator."""
    if not GEMINI_API_KEY:
        return None, "Brak GEMINI_API_KEY"

    try:
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            params={"key": GEMINI_API_KEY},
            json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": min(max_tokens, MAX_OUTPUT_TOKENS, 65536),
                    "responseMimeType": "application/json",
                },
            },
            timeout=AI_TIMEOUT,
        )

        print(f"[SiteMorph][Gemini] {GEMINI_MODEL} -> HTTP {r.status_code}", flush=True)

        if r.status_code != 200:
            return None, f"{GEMINI_MODEL}: HTTP {r.status_code} - {r.text[:400]}"

        candidates = r.json().get("candidates") or []
        if not candidates:
            return None, f"{GEMINI_MODEL}: brak candidates"

        parts = candidates[0].get("content", {}).get("parts", []) or []
        text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        if not text.strip():
            return None, f"{GEMINI_MODEL}: pusta odpowiedz"

        return text, None

    except Exception as e:
        return None, f"{GEMINI_MODEL}: {str(e)[:240]}"


# =============================================================================
# IMAGE SEARCH
# =============================================================================


def search_unsplash(query: str, count: int = 3) -> List[str]:
    """Search real Unsplash assets when a key exists.

    The source.unsplash.com fallback is retained for compatibility with your old
    builder, but a real Unsplash API key is strongly preferable.
    """
    query = (query or "").strip()
    if not query:
        return []

    if UNSPLASH_ACCESS_KEY:
        try:
            r = requests.get(
                "https://api.unsplash.com/search/photos",
                headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
                params={
                    "query": query,
                    "per_page": max(1, min(count, 10)),
                    "orientation": "landscape",
                    "content_filter": "high",
                },
                timeout=12,
            )
            if r.status_code == 200:
                results = r.json().get("results") or []
                urls = [
                    item.get("urls", {}).get("regular")
                    for item in results
                    if item.get("urls", {}).get("regular")
                ]
                return urls[:count]
        except Exception as e:
            print(f"[Unsplash] {query}: {e}", flush=True)

    # Backward-compatible fallback. If this endpoint stops working in your stack,
    # simply return [] here and require UNSPLASH_ACCESS_KEY.
    q = requests.utils.quote(query)
    return [f"https://source.unsplash.com/1600x1000/?{q}&sig={i}" for i in range(count)]


def collect_design_images(queries: List[str], max_total: int = 8) -> List[Dict[str, str]]:
    assets: List[Dict[str, str]] = []
    seen = set()

    for query in (queries or [])[:5]:
        for url in search_unsplash(query, count=2):
            if url and url not in seen:
                seen.add(url)
                assets.append({"query": query, "url": url})
                if len(assets) >= max_total:
                    return assets

    return assets


# =============================================================================
# ART DIRECTOR
# =============================================================================


ART_DIRECTOR_SYSTEM = r"""
You are the SiteMorph Art Director, a senior digital creative director who designs
real commercial websites that agencies can sell to local businesses.

You DO NOT write code. You create an unusually concrete art direction and page
blueprint that another model can execute without inventing a generic template.

Your enemy is AI SLOP.

AI SLOP includes, unless the business concept genuinely calls for it:
- generic centered hero + two buttons + three equal feature cards
- identical rounded cards in every section
- random bento grids
- gradient text used as decoration
- purple/blue neon blobs
- glassmorphism everywhere
- giant rounded pills everywhere
- icon circles for every bullet
- arbitrary dashboard/SaaS aesthetics on local businesses
- every section using the same fade-up animation
- meaningless marquees, counters or parallax
- filler copy such as "najwyższa jakość" or "indywidualne podejście"

A premium business website needs a clear visual idea, hierarchy, restraint,
photography direction, typography, section rhythm and motion language.

You receive the original user prompt and business information. Preserve factual
business data from the user. Never invent addresses, phone numbers, ratings,
opening hours, legal claims, awards or testimonials that were not supplied.
You may write normal marketing copy, labels and section copy consistent with the
business, but mark unknown factual details as omitted rather than fabricating them.

Return ONLY valid JSON with exactly this top-level structure:
{
  "art_direction": {
    "brand_name": "...",
    "business_goal": "...",
    "creative_concept": "...",
    "design_story": "2-4 sentences explaining the visual idea",
    "theme": "light|dark|mixed",
    "palette": {
      "background": "#HEX",
      "surface": "#HEX",
      "text": "#HEX",
      "muted_text": "#HEX",
      "primary": "#HEX",
      "accent": "#HEX",
      "border": "#HEX"
    },
    "typography": {
      "display_font": "Google Font name",
      "body_font": "Google Font name",
      "display_character": "...",
      "body_character": "...",
      "h1_desktop": "...",
      "h1_mobile": "...",
      "heading_rules": "..."
    },
    "composition": {
      "container": "...",
      "hero": "very concrete composition description",
      "section_rhythm": "...",
      "alignment_logic": "...",
      "grid_logic": "...",
      "mobile_strategy": "..."
    },
    "shape_language": {
      "radius_system": "...",
      "borders": "...",
      "buttons": "...",
      "cards": "when cards are allowed and when not",
      "image_treatment": "..."
    },
    "motion_language": {
      "personality": "...",
      "hero_motion": "...",
      "scroll_motion": "...",
      "hover_motion": "...",
      "signature_interaction": "one distinctive, business-appropriate idea",
      "reduced_motion": "what happens for prefers-reduced-motion"
    },
    "photography": {
      "direction": "...",
      "hero_query": "specific English Unsplash query",
      "supporting_queries": ["specific query", "specific query", "specific query"],
      "avoid": ["...", "..."]
    },
    "content_voice": {
      "tone": "...",
      "headline_style": "...",
      "cta_style": "...",
      "banned_phrases": ["...", "..."]
    },
    "page_blueprint": [
      {
        "id": "hero",
        "purpose": "...",
        "layout": "very concrete layout",
        "content": "what real content belongs here",
        "visual_focus": "...",
        "motion": "..."
      }
    ],
    "must_avoid": [
      "specific visual patterns that would make THIS site feel generic"
    ],
    "premium_details": [
      "small deliberate details that fit THIS concept"
    ],
    "component_plan": ["Header.tsx", "Hero.tsx"],
    "quality_bar": "one paragraph describing what would make the result sellable"
  }
}

Rules:
1. Make the concept specific to this business. A barber, kebab shop, architect,
   dentist, florist and lawyer must NOT feel like reskinned versions of one site.
2. Choose 4-9 page sections based on actual business needs. No filler section.
3. Do not prescribe effects just because they are trendy.
4. Motion must be purposeful and limited to a coherent language.
5. Use no more than two primary font families.
6. Prefer 2-3 border-radius values across the whole design instead of random radii.
7. Explicitly say when cards, gradients, glassmorphism, bento, marquee or counters
   should NOT be used.
8. Preserve every relevant fact from the original user prompt.
9. All website-facing copy/content notes must be in Polish. Search queries may be English.
10. Return JSON only.
"""


def build_art_director_prompt(data: DesignAgentInput) -> str:
    original = data.full_prompt or data.description or ""
    return f"""ORIGINAL USER PROMPT — SOURCE OF TRUTH FOR BUSINESS FACTS:
{original}

STRUCTURED INPUT:
- Business name: {data.business_name}
- Niche: {data.niche}
- Description: {data.description}
- Style preference: {data.style or 'not specified'}
- Color preference: {data.colors or 'not specified'}
- Accent preference: {data.accent_color or 'not specified'}
- Layout preference: {data.layout or 'not specified'}
- Font preference: {data.fonts or 'not specified'}
- Photo preference: {data.photo_style or 'not specified'}
- Requested sections: {', '.join(data.sections or []) or 'not specified'}
- Wizard answers: {json.dumps(data.answers or {}, ensure_ascii=False)}

Create a sellable, concrete art direction. Respect explicit user preferences even
when you would personally choose something else. Do not ask questions. Return JSON only.
"""


def _fallback_art_direction(data: DesignAgentInput) -> Dict[str, Any]:
    """A restrained fallback. Deliberately avoids the old 3-card-template look."""
    dark = any(
        word in f"{data.style} {data.colors}".lower()
        for word in ["dark", "ciem", "czarn", "black"]
    )

    accent = data.accent_color or "#B45309"
    bg = "#0D0D0D" if dark else "#F6F3EC"
    surface = "#171717" if dark else "#FFFFFF"
    text = "#F6F2E9" if dark else "#171717"
    muted = "#A7A29A" if dark else "#625F59"
    border = "#2B2B2B" if dark else "#D9D4CB"

    return {
        "brand_name": data.business_name,
        "business_goal": "Zbudować wiarygodność i doprowadzić użytkownika do kontaktu lub zakupu.",
        "creative_concept": "Editorial local business",
        "design_story": (
            "Strona oparta na mocnej typografii, dobrym rytmie i jednej dominującej fotografii. "
            "Zamiast powtarzających się kart używa sekcji typograficznych, linii podziału i zmian skali."
        ),
        "theme": "dark" if dark else "light",
        "palette": {
            "background": bg,
            "surface": surface,
            "text": text,
            "muted_text": muted,
            "primary": text,
            "accent": accent,
            "border": border,
        },
        "typography": {
            "display_font": "Manrope",
            "body_font": "Inter",
            "display_character": "mocna, współczesna, oszczędna",
            "body_character": "czytelna i neutralna",
            "h1_desktop": "clamp(56px, 7vw, 112px)",
            "h1_mobile": "clamp(42px, 13vw, 68px)",
            "heading_rules": "krótkie nagłówki, mocny kontrast skali, bez gradientowego tekstu",
        },
        "composition": {
            "container": "max-width 1320px, szerokie marginesy zależne od viewportu",
            "hero": "asymetryczny hero z tekstem i jedną dużą fotografią; CTA nie konkuruje z nagłówkiem",
            "section_rhythm": "naprzemiennie gęstsze i bardzo przestronne sekcje",
            "alignment_logic": "główna oś tekstowa wyrównana do lewej, pojedyncze przełamania dla zdjęć",
            "grid_logic": "grid tylko tam, gdzie treść naprawdę jest porównywalna",
            "mobile_strategy": "zachować hierarchię, nie tylko złożyć wszystko w identyczną jedną kolumnę",
        },
        "shape_language": {
            "radius_system": "0px, 8px i 18px; bez losowych dużych zaokrągleń",
            "borders": "cienkie linie strukturalne zamiast cienia na każdej powierzchni",
            "buttons": "proste, czytelne CTA; pill tylko jeśli pasuje do marki",
            "cards": "używać wyłącznie dla elementów wymagających grupowania",
            "image_treatment": "duże kadry, object-cover, spójne proporcje i subtelny zoom hover",
        },
        "motion_language": {
            "personality": "spokojna, precyzyjna, premium",
            "hero_motion": "delikatny reveal tekstu i minimalny scale obrazu",
            "scroll_motion": "clip/reveal dla wybranych bloków zamiast fade-up wszystkiego",
            "hover_motion": "2-4px translation lub scale 1.02 tylko na elementach interaktywnych",
            "signature_interaction": "jedna sekcja z kontrolowanym parallaxem obrazu",
            "reduced_motion": "wyłączyć parallax i transformacje, zachować natychmiastową czytelność",
        },
        "photography": {
            "direction": f"autentyczna fotografia związana z branżą {data.niche or 'local business'}",
            "hero_query": f"{data.niche or 'local business'} authentic editorial photography",
            "supporting_queries": [
                f"{data.niche or 'local business'} detail close up",
                f"{data.niche or 'local business'} interior natural light",
                f"{data.niche or 'local business'} people candid work",
            ],
            "avoid": ["generic corporate stock", "fake handshake photography"],
        },
        "content_voice": {
            "tone": "konkretny, ludzki, bez korpomowy",
            "headline_style": "krótkie zdania opisujące realną korzyść lub charakter miejsca",
            "cta_style": "konkretna czynność: Zadzwoń, Umów wizytę, Zobacz menu",
            "banned_phrases": ["najwyższa jakość", "indywidualne podejście", "kompleksowa oferta"],
        },
        "page_blueprint": [
            {
                "id": "hero",
                "purpose": "natychmiast wyjaśnić markę i główną akcję",
                "layout": "asymetryczna kompozycja tekst + fotografia",
                "content": "nazwa, mocny headline, krótki opis, główne CTA",
                "visual_focus": "typografia i hero image",
                "motion": "kontrolowany reveal + image scale",
            },
            {
                "id": "offer",
                "purpose": "pokazać najważniejszą ofertę bez generowania sztucznych kart",
                "layout": "numerowana lista lub naprzemienne wiersze z liniami podziału",
                "content": "realne usługi/produkty wynikające z promptu",
                "visual_focus": "hierarchia typograficzna",
                "motion": "subtelne reveal przy wejściu",
            },
            {
                "id": "proof",
                "purpose": "zbudować zaufanie tylko prawdziwymi danymi z promptu",
                "layout": "duża liczba/opinia/fotografia zależnie od dostępnych danych",
                "content": "rating, opinie lub konkretne cechy tylko jeśli podane",
                "visual_focus": "jedna mocna informacja",
                "motion": "minimalny",
            },
            {
                "id": "contact",
                "purpose": "doprowadzić do konwersji",
                "layout": "dane + prosty formularz dopasowany do branży",
                "content": "tylko podane dane kontaktowe + formularz",
                "visual_focus": "CTA i czytelność",
                "motion": "bez zbędnych efektów",
            },
        ],
        "must_avoid": [
            "trzy identyczne karty jako domyślna oferta",
            "gradientowy tekst",
            "glassmorphism",
            "losowe bento",
            "dekoracyjne blob-y",
            "fade-up na każdym elemencie",
        ],
        "premium_details": [
            "spójne focus states",
            "dopasowany cursor/hover tylko na klikalnych elementach",
            "staranna typografia mobilna",
            "subtelne linie i rytm pionowy",
        ],
        "component_plan": ["Header.tsx", "Hero.tsx", "Offer.tsx", "Proof.tsx", "Contact.tsx", "Footer.tsx"],
        "quality_bar": "Ma wyglądać jak projekt wykonany dla tej konkretnej firmy, nie jak demo biblioteki komponentów.",
    }


@router.post("/design-agent")
def run_design_agent(data: DesignAgentInput):
    prompt = build_art_director_prompt(data)

    if XKIRO_API_KEY:
        text, err = xkiro_generate_model(
            ART_DIRECTOR_MODEL,
            ART_DIRECTOR_SYSTEM,
            prompt,
            temperature=0.76,
            max_tokens=6500,
            timeout=FAST_AI_TIMEOUT,
        )
        if text:
            try:
                parsed = extract_json(text)
                art = parsed.get("art_direction") or parsed
                if isinstance(art, dict) and art.get("palette") and art.get("page_blueprint"):
                    return {
                        "status": "success",
                        "art_direction": art,
                        # compatibility with your previous frontend/API naming
                        "design_guidelines": art,
                        "source": ART_DIRECTOR_MODEL,
                    }
            except Exception as e:
                print(f"[ArtDirector] parse error: {e}", flush=True)
        elif err:
            print(f"[ArtDirector] {err}", flush=True)

    # Gemini is only a fallback for art direction.
    if GEMINI_API_KEY:
        text, err = gemini_generate(ART_DIRECTOR_SYSTEM, prompt, temperature=0.72, max_tokens=6500)
        if text:
            try:
                parsed = extract_json(text)
                art = parsed.get("art_direction") or parsed
                if isinstance(art, dict) and art.get("palette") and art.get("page_blueprint"):
                    return {
                        "status": "success",
                        "art_direction": art,
                        "design_guidelines": art,
                        "source": f"gemini:{GEMINI_MODEL}",
                    }
            except Exception as e:
                print(f"[ArtDirector][Gemini] parse error: {e}", flush=True)

    art = _fallback_art_direction(data)
    return {
        "status": "success",
        "art_direction": art,
        "design_guidelines": art,
        "source": "fallback-art-direction",
    }


# =============================================================================
# WEBSITE GENERATOR PROMPT
# =============================================================================


SYSTEM_PROMPT = r"""
You are SiteMorph Build Engine — a senior React engineer with exceptional visual
implementation skills. You build commercial websites for real businesses.

You are NOT the art director. The ART DIRECTION supplied by SiteMorph is law.
Your job is to execute it faithfully and beautifully in React.

The result must feel designed, not generated.

===============================================================================
1. PRIORITY ORDER
===============================================================================
1) User facts and explicit user requirements
2) ART DIRECTION / PAGE BLUEPRINT
3) Correct, production-quality implementation
4) Restraint and polish
5) Library convenience

Never override a concrete art-direction decision with a generic pattern.

===============================================================================
2. ANTI-AI-SLOP RULES
===============================================================================
Do NOT default to:
- centered hero + two CTA buttons + three equal cards
- bento grid
- gradient headline
- purple/blue blobs
- glassmorphism
- rounded-3xl on every container
- a shadow on every card
- icon circles for every line of text
- repeated eyebrow + heading + paragraph composition in every section
- fake statistics
- fake testimonials
- generic SaaS design for a local business

Those patterns are allowed ONLY when the ART DIRECTION specifically calls for them.

Do not make every element animate. Premium motion is selective.
Do not add effects simply because a library exists.

===============================================================================
3. OUTPUT — VALID JSON ONLY
===============================================================================
Return exactly:
{
  "files": {
    "main/frontend/package.json": "...",
    "main/frontend/index.html": "...",
    "main/frontend/tailwind.config.js": "...",
    "main/frontend/postcss.config.js": "...",
    "main/frontend/src/main.tsx": "...",
    "main/frontend/src/index.css": "...",
    "main/frontend/src/App.tsx": "...",
    "main/frontend/src/components/SomeComponent.tsx": "..."
  },
  "meta": {
    "title": "...",
    "headline": "...",
    "subheadline": "...",
    "ctaText": "...",
    "designConcept": "..."
  }
}

Do NOT generate preview.html in this step. SiteMorph builds the standalone preview
separately so you can spend your full output budget on the real React website.

Every file value must be a complete string. Use literal \n escapes as required by JSON.
No markdown fences. No commentary outside JSON.

===============================================================================
4. PROJECT REQUIREMENTS
===============================================================================
Use React 18 + TypeScript + Vite + Tailwind CSS 3.

Minimum required files:
- package.json
- index.html
- tailwind.config.js
- postcss.config.js
- src/main.tsx
- src/index.css
- src/App.tsx
- meaningful components based on the supplied component plan

Do not create files just to hit a count. A focused 5-component site is better than
12 pointless components.

Available libraries:
- react / react-dom
- framer-motion
- gsap / @gsap/react
- @studio-freight/lenis
- lucide-react
- embla-carousel-react
- @radix-ui/react-dialog
- clsx
- tailwind-merge
- class-variance-authority
- canvas-confetti
- @formkit/auto-animate

Use ZERO, ONE or several of these based on the design. Never import a library only
to prove it exists.

Prefer Framer Motion for normal UI motion.
Use GSAP only for a genuinely cinematic/scroll-driven interaction.
Use Lenis only when smooth scrolling materially supports the concept.
Use Embla only for a real gallery/menu/testimonial carousel.
Use Radix only when a modal/dialog is genuinely useful.
Use confetti only when it fits the brand; never on serious/legal/medical contexts.

===============================================================================
5. VISUAL IMPLEMENTATION QUALITY
===============================================================================
- Respect the exact palette from ART DIRECTION with CSS variables.
- Use typography specified by ART DIRECTION. Load Google Fonts in index.html.
- Build a deliberate type scale with clamp() where useful.
- Preserve readable line lengths; body copy should rarely span the full container.
- Use the specified shape language consistently.
- Use whitespace as part of the composition.
- Mix section structures only when the blueprint says to.
- The design must still feel intentional at 375px, 768px, 1024px and 1440px.
- Mobile navigation must work.
- Avoid horizontal overflow.
- Images require useful alt text and object-fit behavior.
- Buttons and links need visible hover/focus states.
- Respect prefers-reduced-motion.

===============================================================================
6. MOTION QUALITY
===============================================================================
Motion must follow the supplied MOTION LANGUAGE.

A good default implementation pattern is:
- one controlled hero entrance
- one section-reveal language used on selected major blocks
- one signature interaction
- small responsive hover feedback on interactive elements

Do NOT attach whileInView to every div.
Do NOT make the whole website bob/float.
Do NOT use endless animations unless brand concept genuinely demands it.
Animations should have easing and timing consistent with the business personality.

===============================================================================
7. CONTENT / BUSINESS TRUTH
===============================================================================
The ORIGINAL USER PROMPT is the source of truth for factual details.
Use real supplied name, phone, address, menu items, prices, rating, opening hours,
services and reviews where present.

Never invent:
- address
- phone/email
- ratings/review counts
- legal accreditations
- awards
- opening hours
- customer testimonials
- business history dates
- medical/legal guarantees

If something factual is missing, simply design around its absence.
You MAY write original marketing copy that does not pretend to be a fact.

Avoid empty corporate phrases such as:
- "najwyższa jakość"
- "indywidualne podejście"
- "kompleksowa oferta"
- "profesjonalizm na każdym kroku"

Copy must sound like the specific business.

===============================================================================
8. FORMS AND INTERACTIONS
===============================================================================
Forms must match the business:
- restaurant: reservation/order enquiry when appropriate
- barber/beauty: booking enquiry
- service business: quote/contact request
- law/medical: restrained contact form with no misleading claims

Use local React state. Provide polished success/error states.
Do not pretend that a form actually sends data if no backend endpoint was supplied.
Instead use a transparent local success state such as "Dziękujemy — formularz jest gotowy do podłączenia."

===============================================================================
9. CODE QUALITY
===============================================================================
- No TODOs or placeholder ellipses.
- No broken imports.
- No references to files that are not returned.
- No unknown Tailwind plugins.
- package.json dependencies must match imports.
- Keep data arrays in components when appropriate rather than duplicating markup.
- Avoid dangerouslySetInnerHTML.
- Use semantic sections/nav/header/main/footer.
- Ensure TypeScript is valid.

Before returning JSON, mentally inspect the result as if you had to sell it to the
business owner tomorrow. If it resembles a generic AI landing-page template,
redesign it to match the art direction before answering.
"""


def _build_generation_prompt(
    data: BuilderInput,
    art_direction: Dict[str, Any],
    image_assets: List[Dict[str, str]],
) -> str:
    sections = ", ".join(data.sections or []) or "not specified"

    return f"""ORIGINAL USER PROMPT — SOURCE OF TRUTH:
{data.extraPrompt or data.description or ''}

BUSINESS INPUT:
- BUSINESS_NAME: {data.business_name}
- NICHE: {data.niche}
- DESCRIPTION: {data.description}
- STYLE: {data.style or 'not specified'}
- COLORS: {data.colors or 'not specified'}
- ACCENT_COLOR: {data.accent_color or 'not specified'}
- LAYOUT: {data.layout or 'not specified'}
- FONTS: {data.fonts or 'not specified'}
- PHOTO_STYLE: {data.photo_style or 'not specified'}
- REQUESTED_SECTIONS: {sections}

ART DIRECTION — FOLLOW THIS AS A DESIGN SPEC:
{json.dumps(art_direction, ensure_ascii=False, indent=2)}

APPROVED IMAGE ASSETS:
{json.dumps(image_assets, ensure_ascii=False, indent=2) if image_assets else '[]'}

IMAGE RULES:
- If user-uploaded assets are included above, prioritize them.
- Otherwise use the approved Unsplash assets in contexts matching their query.
- Do not repeat the same image in multiple major sections unless the art direction calls for it.
- Do not invent random external image URLs.

Build the complete React website now. Return JSON only.
"""


# =============================================================================
# PROJECT VALIDATION / HEURISTICS
# =============================================================================


REQUIRED_PROJECT_FILES = {
    "main/frontend/package.json",
    "main/frontend/index.html",
    "main/frontend/src/main.tsx",
    "main/frontend/src/index.css",
    "main/frontend/src/App.tsx",
}

BANNED_PLACEHOLDER_PATTERNS = [
    r"\blorem ipsum\b",
    r"\bTODO\b",
    r"ADRES DO UZUPE",
    r"TELEFON DO UZUPE",
    r"EMAIL DO UZUPE",
    r"example\.com",
]


def normalize_files(files: Dict[str, Any]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for path, content in (files or {}).items():
        if not isinstance(path, str):
            continue
        if isinstance(content, str):
            out[path.strip()] = content
        elif content is not None:
            out[path.strip()] = str(content)
    return out


def validate_project(files: Dict[str, str]) -> Tuple[bool, List[str]]:
    issues: List[str] = []

    missing = sorted(REQUIRED_PROJECT_FILES - set(files.keys()))
    if missing:
        issues.append("Missing required files: " + ", ".join(missing))

    app = files.get("main/frontend/src/App.tsx", "")
    css = files.get("main/frontend/src/index.css", "")
    package = files.get("main/frontend/package.json", "")

    if len(app) < 500:
        issues.append("App.tsx is suspiciously short")

    if len(css) < 400:
        issues.append("index.css is suspiciously short")

    total_chars = sum(len(v) for v in files.values())
    if total_chars < 6500:
        issues.append("Project is too small for a polished business website")

    all_code = "\n".join(files.values())
    for pattern in BANNED_PLACEHOLDER_PATTERNS:
        if re.search(pattern, all_code, re.IGNORECASE):
            issues.append(f"Placeholder content detected: {pattern}")

    try:
        pkg = json.loads(package) if package else {}
        deps = {**(pkg.get("dependencies") or {}), **(pkg.get("devDependencies") or {})}
        if "react" not in deps or "react-dom" not in deps:
            issues.append("package.json misses React dependencies")
        if "vite" not in deps:
            issues.append("package.json misses Vite")
    except Exception:
        issues.append("package.json is not valid JSON")

    # Slop heuristics. These are warnings, not automatic failures.
    rounded_3xl = all_code.count("rounded-3xl") + all_code.count("rounded-[32")
    gradient_text = all_code.count("bg-clip-text") + all_code.count("text-transparent")
    backdrop = all_code.count("backdrop-blur")
    if rounded_3xl >= 8:
        issues.append("Possible AI-slop: excessive huge rounded containers")
    if gradient_text >= 4:
        issues.append("Possible AI-slop: excessive gradient text")
    if backdrop >= 8:
        issues.append("Possible AI-slop: excessive glass/backdrop blur")

    hard_fail = bool(missing) or len(app) < 500 or total_chars < 6500
    return (not hard_fail), issues


# =============================================================================
# DESIGN CRITIC + REVISION
# =============================================================================


CRITIC_SYSTEM = r"""
You are SiteMorph Design Critic, a ruthless senior web design reviewer.
You review the generated React project against its ART DIRECTION before a client sees it.

You care about sellability, specificity, composition, visual hierarchy, typography,
image usage, motion restraint, mobile behavior, credibility and code completeness.

Penalize AI slop heavily:
- generic hero + 3 cards
- excessive rounded cards
- random bento
- gradient text without reason
- generic glassmorphism
- repetitive section structure
- animation on everything
- fake facts/testimonials/stats
- visual style that ignores the business niche

Return ONLY JSON:
{
  "score": 0.0,
  "verdict": "short Polish verdict",
  "strengths": ["..."],
  "issues": [
    {
      "severity": "critical|major|minor",
      "area": "design|motion|content|responsive|code",
      "problem": "...",
      "fix": "very concrete instruction"
    }
  ],
  "revision_instructions": [
    "ordered concrete instruction for the implementation model"
  ]
}

Score meanings:
9.0-10: confidently sellable, bespoke agency quality
8.0-8.9: strong, only small polish needed
7.0-7.9: decent but visibly templated / inconsistent
5.0-6.9: AI-looking or underdesigned
0-4.9: broken / generic / unusable

Do not praise generously. The purpose is to catch weak work.
"""


def _project_for_review(files: Dict[str, str], max_chars: int = 120000) -> str:
    priority = [
        "main/frontend/src/App.tsx",
        "main/frontend/src/index.css",
        "main/frontend/index.html",
        "main/frontend/package.json",
    ]
    ordered = []
    for p in priority:
        if p in files:
            ordered.append((p, files[p]))
    for p, c in files.items():
        if p not in dict(ordered) and p.endswith((".tsx", ".ts", ".css", ".html")):
            ordered.append((p, c))

    chunks = []
    used = 0
    for path, content in ordered:
        block = f"\n--- FILE: {path} ---\n{content}\n"
        if used + len(block) > max_chars:
            remain = max_chars - used
            if remain > 500:
                chunks.append(block[:remain])
            break
        chunks.append(block)
        used += len(block)

    return "".join(chunks)


def run_design_critic(
    data: BuilderInput,
    art_direction: Dict[str, Any],
    files: Dict[str, str],
    heuristic_issues: List[str],
) -> Dict[str, Any]:
    if not XKIRO_API_KEY:
        return {
            "score": 8.0 if not heuristic_issues else 7.2,
            "verdict": "Brak dostępu do zewnętrznego krytyka.",
            "strengths": [],
            "issues": [],
            "revision_instructions": heuristic_issues,
            "source": "heuristic",
        }

    prompt = f"""BUSINESS:
{data.business_name} / {data.niche}

ORIGINAL USER PROMPT:
{data.extraPrompt or data.description or ''}

ART DIRECTION:
{json.dumps(art_direction, ensure_ascii=False, indent=2)}

STATIC VALIDATOR NOTES:
{json.dumps(heuristic_issues, ensure_ascii=False, indent=2)}

GENERATED PROJECT:
{_project_for_review(files)}

Review it. Return JSON only.
"""

    text, err = xkiro_generate_model(
        CRITIC_MODEL,
        CRITIC_SYSTEM,
        prompt,
        temperature=0.25,
        max_tokens=4500,
        timeout=FAST_AI_TIMEOUT,
    )

    if text:
        try:
            review = extract_json(text)
            review["source"] = CRITIC_MODEL
            review["score"] = float(review.get("score", 0))
            return review
        except Exception as e:
            print(f"[Critic] parse error: {e}", flush=True)

    return {
        "score": 7.2 if heuristic_issues else 8.0,
        "verdict": err or "Critic parse failed",
        "strengths": [],
        "issues": [],
        "revision_instructions": heuristic_issues,
        "source": "heuristic",
    }


REVISION_SYSTEM = r"""
You are SiteMorph Revision Engine.
You receive a complete React project, the original art direction and a design critic report.

Fix the project instead of redesigning it into another generic template.
Preserve all correct business facts and all strong design decisions.
Apply every critical and major critic instruction unless it conflicts with user facts.

Return the ENTIRE corrected project as valid JSON using exactly:
{
  "files": { "path": "complete file contents" },
  "meta": { "title": "...", "headline": "...", "subheadline": "...", "ctaText": "...", "designConcept": "..." }
}

Rules:
- Return all required files, not diffs.
- No markdown.
- No fake facts.
- Do not add generic bento/cards/gradients while fixing something else.
- Keep TypeScript/imports/package.json coherent.
"""


def revise_project(
    model: str,
    data: BuilderInput,
    art_direction: Dict[str, Any],
    files: Dict[str, str],
    meta: Dict[str, Any],
    review: Dict[str, Any],
) -> Tuple[Optional[Dict[str, str]], Optional[Dict[str, Any]], Optional[str]]:
    prompt = f"""ORIGINAL USER PROMPT:
{data.extraPrompt or data.description or ''}

ART DIRECTION:
{json.dumps(art_direction, ensure_ascii=False, indent=2)}

CRITIC REPORT:
{json.dumps(review, ensure_ascii=False, indent=2)}

CURRENT META:
{json.dumps(meta or {}, ensure_ascii=False, indent=2)}

CURRENT PROJECT:
{_project_for_review(files, max_chars=150000)}

Return the full corrected project JSON only.
"""

    text, err = xkiro_generate_model(
        model,
        REVISION_SYSTEM,
        prompt,
        temperature=0.46,
        max_tokens=MAX_OUTPUT_TOKENS,
        timeout=AI_TIMEOUT,
    )

    if not text:
        return None, None, err

    try:
        parsed = extract_json(text)
        new_files = normalize_files(parsed.get("files") or {})
        new_meta = parsed.get("meta") or meta or {}
        valid, issues = validate_project(new_files)
        if not valid:
            return None, None, "Revision invalid: " + " | ".join(issues[:5])
        return new_files, new_meta, None
    except Exception as e:
        return None, None, f"Revision parse error: {str(e)[:240]}"


# =============================================================================
# STANDALONE PREVIEW
# =============================================================================


PREVIEW_SYSTEM = r"""
You are SiteMorph Preview Compiler.
Convert an already-designed React website into ONE self-contained preview.html.

This file exists only because the current SiteMorph live preview can display standalone HTML.
Do not redesign the site. Reproduce the React design faithfully.

Requirements:
- one complete HTML document
- inline CSS
- inline vanilla JS only where needed
- Google Fonts links are allowed
- image URLs supplied in the React project are allowed
- no React, no npm, no module imports, no build step
- reproduce the same palette, typography, layouts, content and key motion
- responsive mobile/tablet/desktop
- prefers-reduced-motion support
- no fake business facts

Return ONLY JSON:
{"preview_html": "<!doctype html>..."}
"""


def make_standalone_preview(
    data: BuilderInput,
    art_direction: Dict[str, Any],
    files: Dict[str, str],
) -> Tuple[Optional[str], Optional[str]]:
    if not GENERATE_STANDALONE_PREVIEW:
        return None, "disabled"
    if not XKIRO_API_KEY:
        return None, "Brak XKIRO_API_KEY"

    prompt = f"""BUSINESS: {data.business_name} / {data.niche}
ORIGINAL USER PROMPT:
{data.extraPrompt or data.description or ''}

ART DIRECTION:
{json.dumps(art_direction, ensure_ascii=False, indent=2)}

REACT PROJECT:
{_project_for_review(files, max_chars=145000)}

Create preview.html now. Return JSON only.
"""

    text, err = xkiro_generate_model(
        PREVIEW_MODEL,
        PREVIEW_SYSTEM,
        prompt,
        temperature=0.30,
        max_tokens=MAX_OUTPUT_TOKENS,
        timeout=AI_TIMEOUT,
    )

    if not text:
        return None, err

    try:
        parsed = extract_json(text)
        html = parsed.get("preview_html") or ""
        if "<html" not in html.lower() or len(html) < 2500:
            return None, "Preview too short or invalid"
        return html, None
    except Exception as e:
        return None, f"Preview parse error: {str(e)[:240]}"


def ensure_preview_entry(files: Dict[str, str], title: str) -> None:
    """If standalone conversion failed, still give the project a preview.html entry.

    This fallback works when preview.html is served through the same Vite dev server.
    """
    if "main/frontend/preview.html" in files:
        return

    safe_title = (title or "SiteMorph Preview").replace("<", "").replace(">", "")
    files["main/frontend/preview.html"] = f"""<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{safe_title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"""


# =============================================================================
# QUESTIONS AGENT
# =============================================================================


_BUSINESS_KEYWORDS = {
    "restaurac": "Restauracja",
    "kebab": "Kebab",
    "jedzenie": "Restauracja",
    "food": "Restauracja",
    "pizzeria": "Pizzeria",
    "pizza": "Pizzeria",
    "burger": "Burgerownia",
    "bistro": "Bistro",
    "barber": "Barber",
    "fryzjer": "Salon fryzjerski",
    "beauty": "Salon beauty",
    "manicure": "Salon beauty",
    "paznokci": "Salon beauty",
    "spa": "SPA",
    "kawiarnia": "Kawiarnia",
    "coffee": "Kawiarnia",
    "silowni": "Siłownia",
    "fitness": "Siłownia",
    "warsztat": "Warsztat",
    "mechanik": "Warsztat",
    "prawnik": "Kancelaria prawna",
    "adwokat": "Kancelaria prawna",
    "kancelaria": "Kancelaria prawna",
    "dentyst": "Dentysta",
    "stomatolog": "Dentysta",
    "nieruchomosc": "Nieruchomości",
    "hotel": "Hotel",
    "kwiaciarni": "Kwiaciarnia",
    "fotograf": "Fotograf",
    "tattoo": "Studio tatuażu",
    "tatuaz": "Studio tatuażu",
    "saas": "Startup SaaS",
    "startup": "Startup",
}


def _detect_niche_from_text(text: str) -> str:
    t = (text or "").lower()
    for kw, niche in _BUSINESS_KEYWORDS.items():
        if kw in t:
            return niche
    return ""


QUESTIONS_SYSTEM_PROMPT = r"""
You are SiteMorph Discovery Designer.
Analyze the user's website prompt first. Ask only questions whose answers materially
change the design or conversion strategy.

Do not ask for information already present in the prompt.
Do not ask trivial questions merely to reach a quota.
Return 2-4 questions maximum. All user-facing text must be Polish.

Useful unknowns include:
- light/dark/mixed mood when genuinely ambiguous
- visual personality (editorial, raw, elegant, playful, technical, etc.)
- most important conversion action
- whether specific sections such as menu/pricing/gallery are desired
- photography preference when it changes the concept

Return ONLY a JSON array:
[
  {
    "question": "5-14 words po polsku",
    "placeholder": "krótki przykład",
    "options": ["...", "...", "..."],
    "stateKey": "theme|layout|sections|tone|photos|goal|extras",
    "multi": false
  }
]
"""


@router.post("/generate-questions")
def generate_questions(data: QuestionInput):
    prompt_text = data.full_prompt or data.description or data.business_name or ""
    detected = _detect_niche_from_text(prompt_text)

    if XKIRO_API_KEY:
        user_msg = f"""USER PROMPT:
{prompt_text}

Business name if known: {data.business_name}
Detected niche hint: {detected or 'unknown'}
Ask only questions that would materially improve the site design. JSON only.
"""
        text, err = xkiro_generate_model(
            QUESTIONS_MODEL,
            QUESTIONS_SYSTEM_PROMPT,
            user_msg,
            temperature=0.55,
            max_tokens=1800,
            timeout=FAST_AI_TIMEOUT,
        )
        if text:
            try:
                arr = extract_json_array(text)
                valid = [
                    q for q in arr
                    if isinstance(q, dict) and q.get("question") and q.get("stateKey")
                ][:4]
                if len(valid) >= 1:
                    resp = {"questions": valid, "source": QUESTIONS_MODEL}
                    if detected:
                        resp["detected_niche"] = detected
                    return resp
            except Exception as e:
                print(f"[Questions] parse error: {e}", flush=True)

    fallback_questions = [
        {
            "question": "Jaki ma być główny klimat strony?",
            "placeholder": "np. elegancki i spokojny",
            "options": ["Minimalistyczny", "Ciemny premium", "Editorial", "Odważny i energiczny"],
            "stateKey": "tone",
            "multi": False,
        },
        {
            "question": "Co użytkownik ma zrobić przede wszystkim?",
            "placeholder": "np. zadzwonić lub zarezerwować",
            "options": ["Zadzwonić", "Napisać", "Zarezerwować", "Kupić / zamówić"],
            "stateKey": "goal",
            "multi": False,
        },
        {
            "question": "Które sekcje są najważniejsze?",
            "placeholder": "",
            "options": ["Oferta", "Cennik", "Galeria", "Opinie", "O nas", "Kontakt", "FAQ"],
            "stateKey": "sections",
            "multi": True,
        },
    ]

    resp = {"questions": fallback_questions, "source": "fallback"}
    if detected:
        resp["detected_niche"] = detected
    return resp


# =============================================================================
# GENERATE ENDPOINT
# =============================================================================


def _should_refine(mode: str, review_score: float, validator_issues: List[str]) -> bool:
    if not ENABLE_REFINEMENT:
        return False
    if mode == "normal" and not REFINE_NORMAL:
        return False
    if mode != "normal" and not REFINE_PREMIUM:
        return False

    has_serious_static_issue = any(
        not issue.startswith("Possible AI-slop") for issue in validator_issues
    )
    return review_score < QUALITY_TARGET or has_serious_static_issue


def _user_uploaded_assets(data: BuilderInput) -> List[Dict[str, str]]:
    return [
        {"query": "user uploaded asset", "url": url}
        for url in (data.image_urls or [])[:8]
        if url
    ]


def _art_image_queries(art: Dict[str, Any]) -> List[str]:
    photography = art.get("photography") or {}
    queries = []
    hero = photography.get("hero_query")
    if isinstance(hero, str) and hero.strip():
        queries.append(hero.strip())
    supporting = photography.get("supporting_queries") or []
    for q in supporting:
        if isinstance(q, str) and q.strip():
            queries.append(q.strip())
    return queries[:5]


def _make_art_input(data: BuilderInput) -> DesignAgentInput:
    return DesignAgentInput(
        business_name=data.business_name,
        niche=data.niche,
        description=data.description,
        style=data.style,
        colors=data.colors,
        accent_color=data.accent_color,
        layout=data.layout,
        fonts=data.fonts,
        sections=data.sections,
        photo_style=data.photo_style,
        answers={"original_extra_prompt": data.extraPrompt} if data.extraPrompt else None,
        full_prompt=data.extraPrompt or data.description or "",
    )


@router.post("/generate")
def generate_site(data: BuilderInput):
    warning_parts: List[str] = []

    try:
        mode = (data.mode or "normal").lower().strip()
        selected_model = MODEL_MAP.get(mode, MODEL_MAP["normal"])
        print(f"[SiteMorph] mode={mode} model={selected_model}", flush=True)

        # ---------------------------------------------------------------------
        # 1) ART DIRECTOR
        # ---------------------------------------------------------------------
        art_result = run_design_agent(_make_art_input(data))
        art_direction = art_result.get("art_direction") or art_result.get("design_guidelines") or {}
        art_source = art_result.get("source", "unknown")
        print(f"[SiteMorph] Art Director: {art_source}", flush=True)

        # ---------------------------------------------------------------------
        # 2) IMAGE DIRECTION -> REAL ASSETS
        # ---------------------------------------------------------------------
        image_assets = _user_uploaded_assets(data)
        if not image_assets:
            queries = _art_image_queries(art_direction)
            image_assets = collect_design_images(queries, max_total=8)

        # ---------------------------------------------------------------------
        # 3) MAIN REACT GENERATION
        # ---------------------------------------------------------------------
        generation_prompt = _build_generation_prompt(data, art_direction, image_assets)

        parsed_files: Optional[Dict[str, str]] = None
        parsed_meta: Dict[str, Any] = {}
        provider = "fallback"

        if XKIRO_API_KEY:
            text, err = xkiro_generate_model(
                selected_model,
                SYSTEM_PROMPT,
                generation_prompt,
                temperature=0.66 if mode == "normal" else 0.62,
                max_tokens=MAX_OUTPUT_TOKENS,
                timeout=AI_TIMEOUT,
            )
            if text:
                try:
                    parsed = extract_json(text)
                    candidate_files = normalize_files(parsed.get("files") or {})
                    candidate_meta = parsed.get("meta") or {}
                    valid, issues = validate_project(candidate_files)
                    if valid:
                        parsed_files = candidate_files
                        parsed_meta = candidate_meta
                        provider = f"{mode} ({selected_model})"
                    else:
                        warning_parts.append("Primary invalid: " + " | ".join(issues[:4]))
                except Exception as e:
                    warning_parts.append(f"Primary parse error: {str(e)[:180]}")
            else:
                warning_parts.append(f"Primary unavailable: {err}")

        # ---------------------------------------------------------------------
        # 3b) FREE FALLBACK — premium model failed (403 balance / 429 / 5xx),
        #     retry once with the free Qwen model instead of dropping to template
        # ---------------------------------------------------------------------
        if parsed_files is None and XKIRO_API_KEY and selected_model != MODEL_MAP["normal"]:
            text, err = xkiro_generate_model(
                MODEL_MAP["normal"],
                SYSTEM_PROMPT,
                generation_prompt,
                temperature=0.66,
                max_tokens=MAX_OUTPUT_TOKENS,
                timeout=AI_TIMEOUT,
            )
            if text:
                try:
                    parsed = extract_json(text)
                    candidate_files = normalize_files(parsed.get("files") or {})
                    candidate_meta = parsed.get("meta") or {}
                    valid, issues = validate_project(candidate_files)
                    if valid:
                        parsed_files = candidate_files
                        parsed_meta = candidate_meta
                        provider = f"{mode}-free-fallback ({MODEL_MAP['normal']})"
                    else:
                        warning_parts.append("Free fallback invalid: " + " | ".join(issues[:4]))
                except Exception as e:
                    warning_parts.append(f"Free fallback parse error: {str(e)[:180]}")
            else:
                warning_parts.append(f"Free fallback unavailable: {err}")

        # ---------------------------------------------------------------------
        # 4) GEMINI BACKUP
        # ---------------------------------------------------------------------
        if parsed_files is None and GEMINI_API_KEY:
            text, err = gemini_generate(
                SYSTEM_PROMPT,
                generation_prompt,
                temperature=0.64,
                max_tokens=MAX_OUTPUT_TOKENS,
            )
            if text:
                try:
                    parsed = extract_json(text)
                    candidate_files = normalize_files(parsed.get("files") or {})
                    candidate_meta = parsed.get("meta") or {}
                    valid, issues = validate_project(candidate_files)
                    if valid:
                        parsed_files = candidate_files
                        parsed_meta = candidate_meta
                        provider = f"gemini-backup ({GEMINI_MODEL})"
                    else:
                        warning_parts.append("Gemini invalid: " + " | ".join(issues[:4]))
                except Exception as e:
                    warning_parts.append(f"Gemini parse error: {str(e)[:180]}")
            elif err:
                warning_parts.append(f"Gemini unavailable: {err}")

        # ---------------------------------------------------------------------
        # 5) LOCAL FALLBACK
        # ---------------------------------------------------------------------
        fb = fallback_content(data)
        if parsed_files is None:
            parsed_files = normalize_files(fb.get("files") or {})
            parsed_meta = fb.get("meta") or {}
            provider = "fallback"
            warning_parts.append("AI generation failed; local fallback used")

        # ---------------------------------------------------------------------
        # 6) STATIC VALIDATION + AI DESIGN CRITIC
        # ---------------------------------------------------------------------
        valid, validator_issues = validate_project(parsed_files)
        if not valid:
            warning_parts.append("Validator: " + " | ".join(validator_issues[:5]))

        review = run_design_critic(
            data=data,
            art_direction=art_direction,
            files=parsed_files,
            heuristic_issues=validator_issues,
        )
        review_score = float(review.get("score", 0) or 0)
        print(f"[SiteMorph] Critic score: {review_score:.1f}/10", flush=True)

        # ---------------------------------------------------------------------
        # 7) ONE AUTOMATIC REVISION PASS
        # ---------------------------------------------------------------------
        refined = False
        if provider != "fallback" and _should_refine(mode, review_score, validator_issues):
            new_files, new_meta, revision_err = revise_project(
                selected_model,
                data,
                art_direction,
                parsed_files,
                parsed_meta,
                review,
            )
            if new_files:
                parsed_files = new_files
                parsed_meta = new_meta or parsed_meta
                refined = True

                # lightweight second review; useful for diagnostics, not another loop
                _, revised_validator_issues = validate_project(parsed_files)
                review = run_design_critic(
                    data=data,
                    art_direction=art_direction,
                    files=parsed_files,
                    heuristic_issues=revised_validator_issues,
                )
                review_score = float(review.get("score", review_score) or review_score)
                print(f"[SiteMorph] Post-refine score: {review_score:.1f}/10", flush=True)
            elif revision_err:
                warning_parts.append(f"Revision skipped/failed: {revision_err}")

        # ---------------------------------------------------------------------
        # 8) STANDALONE PREVIEW (SEPARATE FROM REAL REACT PROJECT)
        # ---------------------------------------------------------------------
        preview_html, preview_err = make_standalone_preview(
            data,
            art_direction,
            parsed_files,
        )
        if preview_html:
            parsed_files["main/frontend/preview.html"] = preview_html
        else:
            ensure_preview_entry(
                parsed_files,
                parsed_meta.get("title") or data.business_name,
            )
            if preview_err not in {None, "disabled"}:
                warning_parts.append(f"Standalone preview fallback: {preview_err}")

        meta = parsed_meta or fb.get("meta") or {}
        hero = {
            "title": meta.get("headline", data.business_name),
            "subtitle": meta.get("subheadline", data.description),
            "cta_text": meta.get("ctaText", "Kontakt"),
        }

        return {
            "status": "success",
            "provider": provider,
            "model": selected_model if provider != "fallback" else None,
            "warning": " | ".join(warning_parts) if warning_parts else None,
            "art_director": art_source,
            "quality_score": round(review_score, 1),
            "quality_review": review,
            "refined": refined,
            "gemini_key_loaded": bool(GEMINI_API_KEY),
            "gemini_model": GEMINI_MODEL if provider.startswith("gemini") else None,
            "openrouter_model": selected_model if provider != "fallback" else None,
            "content": {"hero": hero, "services": [], "pricing": []},
            "files": parsed_files,
            "meta": meta,
            # Helpful for debugging / showing a hidden developer panel in SiteMorph.
            "design_guidelines": art_direction,
            "image_assets": image_assets,
        }

    except Exception as e:
        import traceback

        print(f"[Builder] CRITICAL ERROR: {e}\n{traceback.format_exc()}", flush=True)

        try:
            fb = fallback_content(data)
            files = normalize_files(fb.get("files") or {})
            meta = fb.get("meta") or {}
            ensure_preview_entry(files, meta.get("title") or data.business_name)

            return {
                "status": "success",
                "provider": "fallback",
                "model": None,
                "warning": f"Błąd krytyczny; użyto fallbacku: {str(e)[:250]}",
                "quality_score": None,
                "quality_review": None,
                "refined": False,
                "gemini_key_loaded": bool(GEMINI_API_KEY),
                "gemini_model": None,
                "openrouter_model": None,
                "content": {
                    "hero": {
                        "title": data.business_name,
                        "subtitle": data.description[:160] if data.description else "",
                        "cta_text": "Kontakt",
                    },
                    "services": [],
                    "pricing": [],
                },
                "files": files,
                "meta": meta,
            }
        except Exception as e2:
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=500,
                content={
                    "detail": (
                        f"Builder critical error: {str(e)[:300]} | "
                        f"fallback also failed: {str(e2)[:220]}"
                    )
                },
            )


# =============================================================================
# UPLOADS
# =============================================================================


@router.post("/upload")
async def upload_assets(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    urls: List[str] = []

    for f in files[:8]:
        raw = await f.read()
        if not raw or len(raw) > 6_000_000:
            continue

        content_type = f.content_type or "image/jpeg"
        if not content_type.startswith("image/"):
            continue

        asset = UploadedAsset(
            id=uuid.uuid4().hex[:16],
            filename=(f.filename or "plik")[:120],
            content_type=content_type,
            data=raw,
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
