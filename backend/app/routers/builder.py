from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Tuple
import html
import json
import os
import re
import shutil
import subprocess
import time
import uuid
import requests
from openai import OpenAI
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UploadedAsset
from app.auth import get_current_user
from app.builder_prompt import SYSTEM_PROMPT, PROMPT_VERSION
from app.builder_validation import validate_project
from app.builder_assets import resolve_assets, add_photo_credits, track_selected_photos


load_dotenv()

router = APIRouter(prefix="/api/builder", tags=["AI Builder"])


# =============================================================================
# CONFIG
# =============================================================================

# Never hardcode API keys in source code.
XKIRO_API_KEY = os.getenv("XKIRO_API_KEY", "").strip()
XKIRO_BASE_URL = os.getenv("XKIRO_BASE_URL", "https://api.xkiro.com/v1").rstrip("/")

# The active pipeline is one compact design-spec response plus deterministic
# validation/assets/React compilation. Hosting timeouts are configurable; they
# are limits, never promised generation durations.
_IS_VERCEL = os.getenv("VERCEL") == "1"

# Quality must never be silently reduced on production. DeepSeek V4 Pro gets a
# 32k output-token ceiling on BOTH Vercel and local. 32k is a LIMIT, not a target:
# the model generates as many tokens as the site actually needs (typically far
# fewer), so the Vercel 300s function cap is only at risk on unusually long runs.
# Provider errors are surfaced; no retries or smaller token ceilings.
MAX_OUTPUT_TOKENS = int(os.getenv("SITEMORPH_MAX_OUTPUT_TOKENS", "32000"))
AI_TIMEOUT = int(os.getenv("SITEMORPH_AI_TIMEOUT", "280" if _IS_VERCEL else "450"))
FAST_AI_TIMEOUT = int(os.getenv("SITEMORPH_FAST_AI_TIMEOUT", "60" if _IS_VERCEL else "180"))
# Compatibility only: the AI standalone-preview path is disabled (GENERATE_STANDALONE_PREVIEW=False)
# and never runs inside /generate.
PREVIEW_MAX_TOKENS = int(os.getenv("SITEMORPH_PREVIEW_MAX_TOKENS", "16000"))
GENERATION_ATTEMPTS = 1

# Keep mode names for frontend/pricing compatibility. All modes currently use
# the same one-call spec compiler path. Legacy helper constants remain only
# for older/debug functions; they are not called by /generate.
DEEPSEEK_MODEL = os.getenv(
    "SITEMORPH_DEEPSEEK_MODEL",
    "deepseek/deepseek-v4-pro",
)
FABLE_MODEL = "anthropic/claude-fable-5"
ULTRA_MODEL = "qwen/qwen3.8-max:free"

MODEL_MAP = {
    "normal": DEEPSEEK_MODEL,
    "ultra": ULTRA_MODEL,
    "ultra+": FABLE_MODEL,
}

PROMPT_PARSER_MODEL = DEEPSEEK_MODEL
BRAND_STRATEGIST_MODEL = DEEPSEEK_MODEL
ART_DIRECTOR_MODEL = DEEPSEEK_MODEL
CRITIC_MODEL = DEEPSEEK_MODEL
QUESTIONS_MODEL = DEEPSEEK_MODEL
PREVIEW_MODEL = DEEPSEEK_MODEL

# Legacy refinement flags are retained for backwards compatibility.
# The normal single-pass /generate endpoint does NOT call the AI critic/revision path.
ENABLE_REFINEMENT = os.getenv("SITEMORPH_ENABLE_REFINEMENT", "0" if _IS_VERCEL else "1") == "1"
REFINE_NORMAL = os.getenv("SITEMORPH_REFINE_NORMAL", "1") == "1"
REFINE_PREMIUM = os.getenv("SITEMORPH_REFINE_PREMIUM", "1") == "1"
QUALITY_TARGET = float(os.getenv("SITEMORPH_QUALITY_TARGET", "8.6"))

# Legacy preview switch retained only for old helper compatibility.
# Kept as a compatibility flag only. The normal builder path NEVER asks AI to
# regenerate React into preview.html. The browser renders the real React files.
GENERATE_STANDALONE_PREVIEW = False

UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "").strip()
# Optional diagnostic only. It never becomes the live preview source.
SERVER_BUILD_CHECK = os.getenv("SITEMORPH_SERVER_BUILD_CHECK", "0") == "1"


# =============================================================================
# WALL-CLOCK GUARD — Vercel Hobby terminates functions at 300s (hard cap).
# The pipeline measures elapsed time and shrinks/skips later AI stages so the
# request ALWAYS finishes inside the limit instead of dying with HTTP 504 when
# the model runs slower than usual.
# =============================================================================

_WALL_START = time.time()


def _wall_remaining(limit: float = 290.0) -> float:
    """Seconds left before the platform function limit is hit."""
    return limit - (time.time() - _WALL_START)


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
    image_details: Optional[List[Dict[str, str]]] = None
    answers: Optional[dict] = None
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
    model: str, system_prompt: str, user_prompt: str, temperature: float = 0.58,
    max_tokens: int = MAX_OUTPUT_TOKENS, timeout: Optional[int] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Call XKIRO via OpenAI-compatible client with single retry on 429/5xx."""
    if not XKIRO_API_KEY:
        return None, "Brak XKIRO_API_KEY"
    client = OpenAI(base_url=XKIRO_BASE_URL, api_key=XKIRO_API_KEY)
    effective_timeout = timeout or AI_TIMEOUT
    _RETRYABLE = {429, 500, 502, 503, 504}
    last_err = None
    for attempt in range(2):  # attempt 0 = first try, attempt 1 = single retry
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=temperature,
                max_tokens=min(int(max_tokens), 32000),
                timeout=effective_timeout,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            if response.choices:
                finish = response.choices[0].finish_reason
                if finish == "length":
                    return None, "Odpowiedź ucięta przez limit modelu."
                content = response.choices[0].message.content or ""
                if isinstance(content, list):
                    content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
                return (content, None) if isinstance(content, str) and content.strip() else (None, "Pusta odpowiedź modelu.")
            return None, "Provider zwrócił pustą odpowiedź."
        except Exception as exc:
            err_str = str(exc).lower()
            status_code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
            is_retryable = (
                status_code in _RETRYABLE
                or any(kw in err_str for kw in ("429", "rate limit", "too many", "timeout", "timed out", "500", "502", "503", "504"))
            )
            if is_retryable and attempt == 0:
                import time as _time
                wait = 15 if status_code == 429 or "429" in err_str or "rate limit" in err_str else 8
                print(f"[SiteMorph] Retryable error ({status_code or err_str[:60]}) — retrying in {wait}s (attempt {attempt+1}/2)")
                _time.sleep(wait)
                last_err = f"Provider: {exc}"
                continue
            return None, f"Provider: {exc}"
    return None, last_err or "Wyczerpano próby transportowe."


# =============================================================================
# IMAGE SEARCH
# =============================================================================


def curated_asset_for(query: str) -> str:
    """Legacy API: no unverified generic fallback image."""
    return ""


def search_unsplash(query: str, count: int = 3) -> List[str]:
    from app.builder_assets import _search
    return [p["url"] for p in _search({"query": query, "subject": query}, UNSPLASH_ACCESS_KEY)][:count]


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
# PROMPT PARSER -> BRAND STRATEGIST -> ART DIRECTOR
# =============================================================================
# Legacy agent helpers below are intentionally RETAINED because they contain useful
# parsing/design infrastructure and may be used by debug/admin tooling. The normal
# /api/builder/generate path does NOT call them; its design reasoning is integrated
# into the single DeepSeek V4 Pro response.



def _original_prompt_from(data: Any) -> str:
    """Return the raw user prompt. It is the factual source of truth."""
    return (
        getattr(data, "full_prompt", "")
        or getattr(data, "extraPrompt", "")
        or getattr(data, "description", "")
        or getattr(data, "business_name", "")
        or ""
    ).strip()


def _normalize_auto(value: Any) -> str:
    """Wizard 'auto' values are not real design preferences."""
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    low = text.lower()
    if low in {
        "auto",
        "automatycznie",
        "dobierz automatycznie",
        "zdecyduj za mnie",
        "bez preferencji",
        "not specified",
    }:
        return ""
    return text


def _explicit_preferences(data: Any) -> Dict[str, Any]:
    answers = getattr(data, "answers", None) or {}
    return {
        "style": _normalize_auto(getattr(data, "style", "")),
        "colors": _normalize_auto(getattr(data, "colors", "")),
        "accent_color": _normalize_auto(getattr(data, "accent_color", "")),
        "layout": _normalize_auto(getattr(data, "layout", "")),
        "fonts": _normalize_auto(getattr(data, "fonts", "")),
        "photo_style": _normalize_auto(getattr(data, "photo_style", "")),
        "sections": list(getattr(data, "sections", None) or []),
        "wizard_answers": answers,
    }


PROMPT_PARSER_SYSTEM = r"""
You are SiteMorph Prompt Parser.

Your ONLY job is to convert a raw, often messy website prompt into a factual business brief.
The prompt may contain copied Google Maps text, icons, navigation labels, review blocks,
menu text, owner descriptions, URLs and image URLs.

DO NOT design the website yet.
DO NOT choose a palette.
DO NOT invent facts.
DO NOT "improve" phone numbers, addresses, ratings, opening hours, prices or reviews.
Ignore UI garbage such as "Wyznacz trasę", "Zapisz", "Udostępnij", map icons and
other interface labels unless they contain actual business information.

The ORIGINAL USER PROMPT is the source of truth.

Extract:
- exact brand/business name
- category and more specific subcategory
- description / owner description
- city and exact address
- phone, email, website/order links
- rating, review count, price range, opening hours
- real products/menu items and prices when present
- real reviews when present
- requested sections
- explicit design preferences ONLY when the user truly states them
- visual/brand signals that are factual clues from the prompt
  (for example: sakura garden, Japanese atmosphere, handmade ceramics, brutalist interior)
- conversion actions such as order, book, call, visit
- image URLs present in the prompt

If a field is unknown, use an empty string, empty array or null.
Never replace an unknown with a plausible value.

Return ONLY valid JSON:
{
  "business": {
    "name": "",
    "category": "",
    "subcategory": "",
    "description": "",
    "owner_description": "",
    "location": {"city": "", "address": ""},
    "phone": "",
    "email": "",
    "website": "",
    "order_links": [],
    "rating": null,
    "reviews_count": null,
    "price_range": "",
    "opening_hours": ""
  },
  "products_services": [
    {"name": "", "description": "", "price": "", "image_url": ""}
  ],
  "reviews": [
    {"author": "", "rating": null, "text": ""}
  ],
  "requested_sections": [],
  "explicit_design_preferences": {
    "colors": [],
    "theme": "",
    "style": "",
    "fonts": "",
    "layout": "",
    "motion": "",
    "photo_style": ""
  },
  "brand_signals": [],
  "conversion_actions": [],
  "image_urls_from_prompt": [],
  "important_content": [],
  "unknowns": []
}
"""


def _guess_business_name(original: str, fallback: str = "") -> str:
    text = (original or "").strip()
    patterns = [
        r"(?:zrób|zrob|stwórz|stworz)\s+(?:mi\s+)?stron(?:ę|e)\s*:?\s*([^\n\r]+)",
        r"(?:strona|website)\s+(?:dla|for)\s*:?\s*([^\n\r]+)",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            candidate = re.sub(r"\s+", " ", m.group(1)).strip(" -*:")
            if 2 <= len(candidate) <= 140:
                return candidate
    first = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
    if first and len(first) <= 140:
        return re.sub(r"^(?:zrób|zrob|stwórz|stworz)\s+(?:mi\s+)?stron(?:ę|e)\s*:?\s*", "", first, flags=re.I).strip()
    return fallback or ""


def _fallback_business_brief(data: Any) -> Dict[str, Any]:
    original = _original_prompt_from(data)
    name_hint = _normalize_auto(getattr(data, "business_name", ""))
    niche_hint = _normalize_auto(getattr(data, "niche", ""))
    name = name_hint or _guess_business_name(original)
    requested = list(getattr(data, "sections", None) or [])
    prefs = _explicit_preferences(data)

    phone_match = re.search(r"(?<!\d)(?:\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}(?!\d)", original)
    rating_match = re.search(r"(?<!\d)([1-5][,.]\d)\s*\((\d+)\)", original)
    address_match = re.search(
        r"([A-ZĄĆĘŁŃÓŚŹŻ][\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ .'-]+\s+\d+[A-Za-z]?,?\s+\d{2}-\d{3}\s+[A-ZĄĆĘŁŃÓŚŹŻ][\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ .'-]+)",
        original,
    )

    return {
        "business": {
            "name": name,
            "category": niche_hint,
            "subcategory": niche_hint,
            "description": getattr(data, "description", "") or "",
            "owner_description": "",
            "location": {"city": "", "address": address_match.group(1).strip() if address_match else ""},
            "phone": phone_match.group(0).strip() if phone_match else "",
            "email": "",
            "website": "",
            "order_links": [],
            "rating": float(rating_match.group(1).replace(",", ".")) if rating_match else None,
            "reviews_count": int(rating_match.group(2)) if rating_match else None,
            "price_range": "",
            "opening_hours": "",
        },
        "products_services": [],
        "reviews": [],
        "requested_sections": requested,
        "explicit_design_preferences": {
            "colors": [prefs["colors"]] if prefs["colors"] else [],
            "theme": prefs["colors"],
            "style": prefs["style"],
            "fonts": prefs["fonts"],
            "layout": prefs["layout"],
            "motion": "",
            "photo_style": prefs["photo_style"],
        },
        "brand_signals": [],
        "conversion_actions": [],
        "image_urls_from_prompt": [],
        "important_content": [],
        "unknowns": [],
    }


def parse_business_prompt(data: Any) -> Dict[str, Any]:
    original = _original_prompt_from(data)
    fallback = _fallback_business_brief(data)

    if not XKIRO_API_KEY or not original:
        return fallback

    prompt = f"""ORIGINAL USER PROMPT:
{original}

STRUCTURED HINTS FROM THE APP (use only when non-empty):
- business_name_hint: {_normalize_auto(getattr(data, 'business_name', ''))}
- niche_hint: {_normalize_auto(getattr(data, 'niche', ''))}
- requested_sections_hint: {json.dumps(list(getattr(data, 'sections', None) or []), ensure_ascii=False)}
- wizard/preferences: {json.dumps(_explicit_preferences(data), ensure_ascii=False)}

Extract the factual brief. JSON only.
"""

    text, err = xkiro_generate_model(
        PROMPT_PARSER_MODEL,
        PROMPT_PARSER_SYSTEM,
        prompt,
        temperature=0.12,
        max_tokens=8000,
        timeout=FAST_AI_TIMEOUT,
    )
    if text:
        try:
            parsed = extract_json(text)
            if isinstance(parsed, dict) and isinstance(parsed.get("business"), dict):
                return parsed
        except Exception as e:
            print(f"[PromptParser] parse error: {e}", flush=True)
    elif err:
        print(f"[PromptParser] {err}", flush=True)

    return fallback


BRAND_STRATEGIST_SYSTEM = r"""
You are SiteMorph Brand Strategist.

You receive a factual business brief and the raw user preferences.
Your task is to understand the semantic and emotional world of THIS EXACT brand
before any visual design is chosen.

You do NOT design page sections yet and you do NOT write code.

Analyze:
- what is actually being sold
- physical/product character: soft, precise, handmade, technical, fresh, heavy, playful...
- cultural context and references that genuinely exist in the brief
- likely audience and purchase context
- price/positioning signals
- emotional goal of the experience
- physical environment or atmosphere described by owner/reviews
- visual associations naturally connected to the product and place
- appropriate materials, textures and photography
- color families that make semantic sense
- typography personality
- motion personality
- visual directions that would feel wrong for this brand

PRIORITY:
1. Explicit user design preferences ALWAYS win.
2. Existing brand assets and factual brand signals.
3. Semantic reasoning from product/culture/audience/environment.
4. General industry knowledge.
5. Generic trends LAST.

Never randomly choose "premium black + gold", dark mode, blue SaaS, neon,
glassmorphism, bento or Inter just because they are familiar.

Example reasoning:
A Japanese mochi donut + matcha shop with sakura, bright dessert photography
and a Japanese garden suggests softness, rounded tactile product forms,
warm cream/milk-white, sakura pink, matcha green, charcoal text,
restrained Japanese whitespace and playful but controlled motion.
Black/gold luxury or yellow/black industrial would be semantically wrong
unless explicitly requested.

Return ONLY valid JSON:
{
  "brand_strategy": {
    "one_sentence_positioning": "",
    "brand_personality": [],
    "audience": [],
    "purchase_context": [],
    "emotional_goals": [],
    "product_character": [],
    "cultural_context": [],
    "physical_environment": [],
    "visual_associations": [],
    "materials_textures": [],
    "photography_direction": "",
    "color_direction": [],
    "typography_direction": "",
    "motion_personality": "",
    "positioning": "",
    "conversion_priority": "",
    "avoid": [],
    "reasoning_summary": ""
  }
}
"""


def _fallback_brand_strategy(brief: Dict[str, Any], data: Any) -> Dict[str, Any]:
    business = brief.get("business") or {}
    signals = brief.get("brand_signals") or []
    category = business.get("subcategory") or business.get("category") or _normalize_auto(getattr(data, "niche", ""))
    return {
        "one_sentence_positioning": f"Strona dla marki {business.get('name') or 'lokalnej firmy'} dopasowana do jej realnej oferty.",
        "brand_personality": [],
        "audience": [],
        "purchase_context": [],
        "emotional_goals": ["zaufanie", "czytelność", "chęć wykonania głównej akcji"],
        "product_character": [],
        "cultural_context": signals,
        "physical_environment": [],
        "visual_associations": signals,
        "materials_textures": [],
        "photography_direction": f"Autentyczna fotografia związana z {category or 'biznesem'}, spójne światło i kolor.",
        "color_direction": [],
        "typography_direction": "Dobierz charakter pisma do osobowości produktu; nie używaj domyślnego fontu bez powodu.",
        "motion_personality": "Ruch ma wynikać z charakteru marki i być oszczędny.",
        "positioning": "",
        "conversion_priority": (brief.get("conversion_actions") or ["kontakt"])[0],
        "avoid": ["generic SaaS template", "random black/gold", "random neon", "design unrelated to the business"],
        "reasoning_summary": "Fallback strategiczny — bez losowego narzucania stylu.",
    }


def create_brand_strategy(data: Any, business_brief: Dict[str, Any]) -> Dict[str, Any]:
    fallback = _fallback_brand_strategy(business_brief, data)
    if not XKIRO_API_KEY:
        return fallback

    prompt = f"""FACTUAL BUSINESS BRIEF:
{json.dumps(business_brief, ensure_ascii=False, indent=2)}

EXPLICIT APP/WIZARD PREFERENCES:
{json.dumps(_explicit_preferences(data), ensure_ascii=False, indent=2)}

Create the brand strategy. Do not invent business facts. JSON only.
"""
    text, err = xkiro_generate_model(
        BRAND_STRATEGIST_MODEL,
        BRAND_STRATEGIST_SYSTEM,
        prompt,
        temperature=0.42,
        max_tokens=6500,
        timeout=FAST_AI_TIMEOUT,
    )
    if text:
        try:
            parsed = extract_json(text)
            strategy = parsed.get("brand_strategy") or parsed
            if isinstance(strategy, dict):
                return strategy
        except Exception as e:
            print(f"[BrandStrategist] parse error: {e}", flush=True)
    elif err:
        print(f"[BrandStrategist] {err}", flush=True)
    return fallback


ART_DIRECTOR_SYSTEM = r"""
You are SiteMorph Art Director — a senior digital creative director designing
real, sellable websites for specific businesses.

You receive:
1. the factual business brief,
2. the brand strategy,
3. explicit user preferences.

You DO NOT write code.
You turn strategy into ONE coherent visual concept and a concrete page blueprint.

Your enemy is AI SLOP:
- generic centered hero + two buttons + three equal cards
- identical rounded cards in every section
- random bento
- decorative gradient text
- purple/blue blobs
- glassmorphism everywhere
- giant pills/rounded-3xl everywhere
- icon circles everywhere
- generic SaaS styling on local businesses
- every section using the same fade-up
- meaningless marquee/counters/parallax
- fake facts or fake testimonials

DESIGN PRINCIPLES:
- Every viewport should have one dominant visual idea.
- Typography is identity, not just readability.
- Color must be explainable by the brand strategy.
- Empty space is part of composition.
- Consecutive sections should not repeat the same visual structure.
- Photography must have a consistent lighting/framing/color direction.
- Shapes, borders, buttons and image crops must share one shape language.
- Motion must express the brand personality.
- Premium means concept + restraint + detail, not more effects.
- The website should look like THIS BUSINESS could realistically own it.

PRIORITY:
1. Explicit user instructions.
2. Factual brand signals/assets.
3. Brand strategy.
4. Good design principles.
5. Generic defaults only as a last resort.

If the user explicitly asks for black/yellow, respect it even for mochi.
If the user did NOT specify colors, do NOT invent a random trend; infer them from
the strategy and explain them through the concept.

Return ONLY valid JSON:
{
  "art_direction": {
    "brand_name": "",
    "business_goal": "",
    "creative_concept": "",
    "design_story": "",
    "theme": "light|dark|mixed",
    "palette": {
      "background": "#HEX",
      "surface": "#HEX",
      "text": "#HEX",
      "muted_text": "#HEX",
      "primary": "#HEX",
      "secondary": "#HEX",
      "accent": "#HEX",
      "border": "#HEX"
    },
    "typography": {
      "display_font": "Google Font name",
      "body_font": "Google Font name",
      "display_character": "",
      "body_character": "",
      "h1_desktop": "",
      "h1_mobile": "",
      "heading_rules": ""
    },
    "composition": {
      "container": "",
      "hero": "very concrete composition",
      "section_rhythm": "",
      "alignment_logic": "",
      "grid_logic": "",
      "whitespace_strategy": "",
      "mobile_strategy": ""
    },
    "shape_language": {
      "concept": "",
      "radius_system": "",
      "borders": "",
      "buttons": "",
      "cards": "",
      "image_treatment": "",
      "decorative_motifs": ""
    },
    "motion_language": {
      "personality": "",
      "hero_motion": "",
      "scroll_motion": "",
      "hover_motion": "",
      "signature_interaction": "",
      "reduced_motion": ""
    },
    "photography": {
      "direction": "",
      "hero_query": "specific English image query",
      "supporting_queries": ["", "", ""],
      "avoid": []
    },
    "content_voice": {
      "tone": "",
      "headline_style": "",
      "cta_style": "",
      "banned_phrases": []
    },
    "page_blueprint": [
      {
        "id": "hero",
        "purpose": "",
        "layout": "very concrete layout",
        "content": "which real facts/products belong here",
        "visual_focus": "",
        "motion": "",
        "mobile_behavior": ""
      }
    ],
    "must_avoid": [],
    "premium_details": [],
    "component_plan": ["Header.tsx", "Hero.tsx"],
    "quality_bar": ""
  }
}

Rules:
- Pick 4-9 sections from actual business needs; no filler.
- Do not repeat identical 3-card grids unless the content truly requires comparison.
- Use at most two font families.
- Choose a coherent radius/border system.
- Preserve every factual detail from the business brief.
- All website-facing content notes are Polish; image queries can be English.
- JSON only.
"""


def _fallback_art_direction(
    data: Any,
    business_brief: Dict[str, Any],
    brand_strategy: Dict[str, Any],
) -> Dict[str, Any]:
    business = business_brief.get("business") or {}
    prefs = _explicit_preferences(data)
    text_blob = " ".join(
        [
            _original_prompt_from(data),
            business.get("name") or "",
            business.get("category") or "",
            business.get("subcategory") or "",
            " ".join(business_brief.get("brand_signals") or []),
        ]
    ).lower()

    # Semantic emergency palette. This is only used when DeepSeek is unavailable.
    if any(k in text_blob for k in ["mochi", "matcha", "sakura", "japo", "japan"]):
        palette = {
            "background": "#FFF9F5",
            "surface": "#FFFFFF",
            "text": "#2A2523",
            "muted_text": "#756C68",
            "primary": "#E99BAF",
            "secondary": "#C9D9A5",
            "accent": "#B94C68",
            "border": "#EEDFD9",
        }
        concept = "Soft Japanese dessert editorial"
        display_font = "Zen Maru Gothic"
        body_font = "Manrope"
        shape_concept = "Miękkie, koliste formy inspirowane mochi; subtelna geometria i dużo oddechu."
    elif any(k in text_blob for k in ["barber", "mechanik", "warsztat", "auto"]):
        palette = {
            "background": "#F3F2EE",
            "surface": "#FFFFFF",
            "text": "#171717",
            "muted_text": "#6B6964",
            "primary": "#202020",
            "secondary": "#D9D4CA",
            "accent": "#B84B31",
            "border": "#D8D5CF",
        }
        concept = "Utility editorial"
        display_font = "Archivo"
        body_font = "Inter"
        shape_concept = "Mocne linie, techniczna precyzja, mało zaokrągleń."
    else:
        palette = {
            "background": "#F7F5F0",
            "surface": "#FFFFFF",
            "text": "#171717",
            "muted_text": "#68645E",
            "primary": "#2A2926",
            "secondary": "#DAD5CB",
            "accent": "#8A5A44",
            "border": "#DDD8CE",
        }
        concept = "Brand-led editorial business site"
        display_font = "Manrope"
        body_font = "Inter"
        shape_concept = "Prosty, spójny system form; zaokrąglenia tylko tam, gdzie wspierają charakter marki."

    # Explicit user colors/theme override emergency inference.
    explicit_colors = prefs.get("colors") or ""
    if explicit_colors:
        concept += f" — z bezwzględnym uwzględnieniem preferencji użytkownika: {explicit_colors}"

    brand_name = business.get("name") or _normalize_auto(getattr(data, "business_name", "")) or "Marka"
    requested = business_brief.get("requested_sections") or list(getattr(data, "sections", None) or [])
    section_ids = [str(x).strip().lower() for x in requested if str(x).strip()]
    default_blueprint = [
        {
            "id": "hero",
            "purpose": "Natychmiast pokazać charakter marki i główną akcję.",
            "layout": "Asymetryczny hero oparty o jeden dominujący motyw wizualny i realny produkt/usługę.",
            "content": "Nazwa, krótki brandowy headline, opis oparty na faktach, główne CTA.",
            "visual_focus": "Typografia + fotografia produktu/miejsca.",
            "motion": "Jedna kontrolowana animacja wejścia zgodna z osobowością marki.",
            "mobile_behavior": "Zachować dominantę wizualną i kolejność treści bez ściskania elementów.",
        },
        {
            "id": "offer",
            "purpose": "Pokazać najważniejsze produkty/usługi.",
            "layout": "Układ wynikający z rodzaju oferty: lista editorial, gallery grid lub rytmiczne wiersze; nie domyślne 3 karty.",
            "content": "Tylko realne produkty/usługi z briefu.",
            "visual_focus": "Produkt/usługa.",
            "motion": "Subtelny reveal wybranych elementów.",
            "mobile_behavior": "Czytelny scroll bez poziomego overflow.",
        },
        {
            "id": "proof",
            "purpose": "Zbudować zaufanie realnymi opiniami/ratingiem, jeśli są dostępne.",
            "layout": "Jedna mocna opinia lub rating + kontekst, bez sztucznego gridu 3 testimonial cards.",
            "content": "Tylko realne dane.",
            "visual_focus": "Dowód społeczny.",
            "motion": "Minimalny.",
            "mobile_behavior": "Duża czytelność cytatów i ratingu.",
        },
        {
            "id": "contact",
            "purpose": "Doprowadzić do wizyty, telefonu, rezerwacji lub zamówienia.",
            "layout": "Dane + CTA; formularz tylko gdy ma sens.",
            "content": "Realny adres/telefon/godziny/linki, jeśli są dostępne.",
            "visual_focus": "Konwersja.",
            "motion": "Bez zbędnych efektów.",
            "mobile_behavior": "CTA dostępne kciukiem, dane w jednej czytelnej kolumnie.",
        },
    ]

    return {
        "brand_name": brand_name,
        "business_goal": brand_strategy.get("conversion_priority") or "Doprowadzić do głównej akcji biznesowej.",
        "creative_concept": concept,
        "design_story": brand_strategy.get("reasoning_summary") or "Projekt wynika z charakteru marki, produktu i odbiorcy, a nie z gotowego szablonu.",
        "theme": "light",
        "palette": palette,
        "typography": {
            "display_font": display_font,
            "body_font": body_font,
            "display_character": brand_strategy.get("typography_direction") or "charakterystyczna dla marki",
            "body_character": "czytelna i spokojna",
            "h1_desktop": "clamp(58px, 7vw, 108px)",
            "h1_mobile": "clamp(40px, 12vw, 64px)",
            "heading_rules": "Krótko, duży kontrast skali, bez przypadkowego gradient text.",
        },
        "composition": {
            "container": "max-width 1320px, responsywne marginesy",
            "hero": "Jedna dominująca kompozycja dopasowana do marki; nie domyślny centered SaaS hero.",
            "section_rhythm": "Naprzemiennie sekcje gęstsze i przestronne; bez powtarzania tej samej konstrukcji.",
            "alignment_logic": "Spójna oś i świadome przełamania dla fotografii.",
            "grid_logic": "Grid tylko gdy zawartość tego wymaga.",
            "whitespace_strategy": "Dużo kontrolowanego oddechu wokół dominanty.",
            "mobile_strategy": "Zachować hierarchię i rytm zamiast tylko stackować desktop.",
        },
        "shape_language": {
            "concept": shape_concept,
            "radius_system": "2-3 wartości maksymalnie",
            "borders": "Subtelne linie strukturalne zamiast cienia na każdym elemencie.",
            "buttons": "CTA dopasowane do charakteru marki, nie automatyczne pills.",
            "cards": "Tylko gdy semantyka treści wymaga grupowania.",
            "image_treatment": "Spójne kadry i światło, jeden język cropów.",
            "decorative_motifs": "Tylko motywy wynikające z marki.",
        },
        "motion_language": {
            "personality": brand_strategy.get("motion_personality") or "spokojna i celowa",
            "hero_motion": "Jedna wyrazista, ale kontrolowana animacja wejścia.",
            "scroll_motion": "Wybrane reveal/mask, nie fade-up na każdym divie.",
            "hover_motion": "Drobna reakcja tylko elementów interaktywnych.",
            "signature_interaction": "Jedna interakcja wynikająca z produktu lub fotografii.",
            "reduced_motion": "Wyłącz transformacje/parallax i zachowaj natychmiastową czytelność.",
        },
        "photography": {
            "direction": brand_strategy.get("photography_direction") or "Autentyczna, spójna fotografia marki.",
            "hero_query": f"{business.get('subcategory') or business.get('category') or 'local business'} editorial product photography",
            "supporting_queries": [
                f"{business.get('subcategory') or business.get('category') or 'local business'} detail natural light",
                f"{business.get('subcategory') or business.get('category') or 'local business'} interior atmosphere",
                f"{business.get('subcategory') or business.get('category') or 'local business'} product close up",
            ],
            "avoid": ["generic corporate stock", "mismatched lighting", "unrelated stock imagery"],
        },
        "content_voice": {
            "tone": "konkretny, brandowy, naturalny",
            "headline_style": "krótki i związany z realnym charakterem marki",
            "cta_style": "konkretna czynność: Zamów, Zobacz menu, Umów, Zadzwoń, Odwiedź",
            "banned_phrases": ["najwyższa jakość", "indywidualne podejście", "kompleksowa oferta"],
        },
        "page_blueprint": default_blueprint,
        "must_avoid": [
            "generic centered hero + 3 cards",
            "random black/gold",
            "random blue/purple SaaS",
            "glassmorphism without brand reason",
            "gradient text without brand reason",
            "bento for decoration",
            "fake facts/testimonials",
        ],
        "premium_details": ["spójny focus/hover", "dopieszczona typografia mobilna", "świadomy rytm pionowy"],
        "component_plan": ["Header.tsx", "Hero.tsx", "Offer.tsx", "Proof.tsx", "Contact.tsx", "Footer.tsx"],
        "quality_bar": "Ma wyglądać jak projekt wykonany dla tej konkretnej firmy, a nie demo generatora AI.",
    }


def build_art_director_prompt(
    data: Any,
    business_brief: Dict[str, Any],
    brand_strategy: Dict[str, Any],
) -> str:
    return f"""ORIGINAL USER PROMPT — SOURCE OF TRUTH:
{_original_prompt_from(data)}

FACTUAL BUSINESS BRIEF:
{json.dumps(business_brief, ensure_ascii=False, indent=2)}

BRAND STRATEGY:
{json.dumps(brand_strategy, ensure_ascii=False, indent=2)}

EXPLICIT USER/WIZARD PREFERENCES:
{json.dumps(_explicit_preferences(data), ensure_ascii=False, indent=2)}

Turn this into one coherent, sellable art direction.
Respect explicit user preferences even if your own taste differs.
Do not ask questions. JSON only.
"""


def create_art_direction(
    data: Any,
    business_brief: Dict[str, Any],
    brand_strategy: Dict[str, Any],
) -> Tuple[Dict[str, Any], str]:
    fallback = _fallback_art_direction(data, business_brief, brand_strategy)
    if not XKIRO_API_KEY:
        return fallback, "fallback-art-direction"

    text, err = xkiro_generate_model(
        ART_DIRECTOR_MODEL,
        ART_DIRECTOR_SYSTEM,
        build_art_director_prompt(data, business_brief, brand_strategy),
        temperature=0.58,
        max_tokens=8500,
        timeout=FAST_AI_TIMEOUT,
    )
    if text:
        try:
            parsed = extract_json(text)
            art = parsed.get("art_direction") or parsed
            if isinstance(art, dict) and art.get("palette") and art.get("page_blueprint"):
                return art, ART_DIRECTOR_MODEL
        except Exception as e:
            print(f"[ArtDirector] parse error: {e}", flush=True)
    elif err:
        print(f"[ArtDirector] {err}", flush=True)

    return fallback, "fallback-art-direction"


@router.post("/design-agent")
def run_design_agent(data: DesignAgentInput):
    """Compatibility/debug endpoint.

    SiteMorph no longer spends a second AI request on a standalone design agent.
    The ONE DeepSeek V4 Pro generation request performs brand understanding,
    art direction and implementation together. This endpoint exposes the raw
    brief/preferences so older UI/debug code keeps working without another model call.
    """
    original = _original_prompt_from(data)
    brief = _fallback_business_brief(data)
    strategy = _fallback_brand_strategy(brief, data)
    art = _fallback_art_direction(data, brief, strategy)
    return {
        "status": "success",
        "source": "integrated-single-pass",
        "message": "Brand strategy + art direction are executed inside the single DeepSeek V4 Pro generation request.",
        "original_prompt": original,
        "business_brief": brief,
        "brand_strategy": strategy,
        "art_direction": art,
        "design_guidelines": art,
    }


# =============================================================================
# WEBSITE GENERATOR PROMPT
# =============================================================================


# The active system contract lives in app.builder_prompt.


def _build_generation_prompt(
    data: BuilderInput,
    business_brief: Optional[Dict[str, Any]] = None,
    brand_strategy: Optional[Dict[str, Any]] = None,
    art_direction: Optional[Dict[str, Any]] = None,
    image_assets: Optional[List[Dict[str, str]]] = None,
) -> str:
    raw_prompt = (data.extraPrompt or data.description or data.business_name or "").strip()
    prefs = _explicit_preferences(data)
    user_assets = [
        {"url": str(item.get("url")), "description": item.get("query", "")}
        for item in (image_assets or [])
        if isinstance(item, dict) and str(item.get("url") or "").startswith(("http://", "https://", "/api/"))
    ]

    return f"""RAW USER PROMPT — SOURCE OF TRUTH:
{raw_prompt}

APP/WIZARD PREFERENCES — ONLY EXPLICIT NON-AUTO VALUES MATTER:
{json.dumps(prefs, ensure_ascii=False, indent=2)}

USER-SUPPLIED IMAGE ASSETS:
{json.dumps(user_assets, ensure_ascii=False, indent=2)}

BUILD MODE:
{data.mode or 'normal'}

Your job is to understand this exact business, silently create the right brand/art
direction, and then implement the COMPLETE React website in this same response.

Do not output analysis, a design report or preview.html.
Return the final JSON project only.
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


def normalize_files(files: Any) -> Dict[str, str]:
    """Accept both the legacy {path: content} map and the v2 list of {path, content}.

    Anything outside the project tree (path traversal, absolute paths, files
    without the main/frontend/ prefix) is dropped.
    """
    out: Dict[str, str] = {}
    entries: List[Any]
    if isinstance(files, dict):
        entries = [{"path": k, "content": v} for k, v in (files or {}).items()]
    elif isinstance(files, list):
        entries = list(files or [])
    else:
        return out

    for item in entries:
        if not isinstance(item, dict):
            continue
        path = item.get("path")
        content = item.get("content")
        if not isinstance(path, str):
            continue
        path = path.strip().replace("\\", "/")
        if not path:
            continue
        # Security: only files inside the project tree.
        if path.startswith("/") or re.match(r"^[a-zA-Z]:/", path) or ".." in path.split("/"):
            continue
        if not path.startswith("main/frontend/"):
            continue
        if content is None:
            continue
        out[path] = content if isinstance(content, str) else str(content)
    return out


def extract_contract(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the v2 design contract fields from a model response, tolerantly.

    Everything is best-effort; the legacy meta fields remain the source of the
    response shape the frontend already understands.
    """
    def _safe(obj: Any, limit: int = 40) -> List[Any]:
        return obj[:limit] if isinstance(obj, list) else []

    brief = parsed.get("designBrief")
    if not isinstance(brief, dict):
        brief = {}
    tokens = parsed.get("designTokens")
    if not isinstance(tokens, dict):
        tokens = {}
    section_plan = _safe(parsed.get("sectionPlan"))
    asset_requests = _safe(parsed.get("assetRequests"), limit=8)
    warnings = parsed.get("warnings")
    if isinstance(warnings, str):
        warnings = [warnings]
    warnings = _safe(warnings, limit=10)

    return {
        "schemaVersion": parsed.get("schemaVersion") or 1,
        "projectName": str(parsed.get("projectName") or "").strip(),
        "design_brief": brief,
        "design_tokens": tokens,
        "section_plan": section_plan,
        "asset_requests": asset_requests,
        "warnings": warnings,
    }


# Validation is imported from app.builder_validation.


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
        max_tokens=PREVIEW_MAX_TOKENS,
        timeout=FAST_AI_TIMEOUT,
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
# REAL REACT BUILD — compile the actual generated Vite project and inline it
# into ONE self-contained HTML so the live preview (and publish) show the real
# React app, not a hand-made AI replica. Used whenever node/npm is available.
# =============================================================================


# Vercel: filesystem jest read-only poza /tmp — mkdir na poziomie modulu na
# sciezce projektu rzucalby OSError przy imporcie i wallal CALY backend
# (FUNCTION_INVOCATION_FAILED na kazdym /api). Dlatego: /tmp na Vercelu,
# katalog projektu lokalnie, i nigdy nie rzucamy przy starcie.
_default_build_dir = os.getenv(
    "SITEMORPH_BUILD_DIR",
    "/tmp/sitemorph_builds" if os.getenv("VERCEL") else str(Path(__file__).resolve().parents[2] / ".sitemorph_builds"),
)
BUILD_ROOT = Path(_default_build_dir)
try:
    BUILD_ROOT.mkdir(parents=True, exist_ok=True)
except OSError:
    try:
        BUILD_ROOT = Path("/tmp/sitemorph_builds")
        BUILD_ROOT.mkdir(parents=True, exist_ok=True)
    except OSError:
        BUILD_ROOT = None  # realny build React po prostu niedostepny
MAX_BUILD_DIRS = 8


def _npm_cmd() -> Optional[List[str]]:
    """Return [node, npm-cli.js] — robust on Windows without shell=True."""
    node = shutil.which("node")
    if not node:
        return None
    npm_cli = os.path.join(os.path.dirname(node), "node_modules", "npm", "bin", "npm-cli.js")
    if not os.path.exists(npm_cli):
        return None
    return [node, npm_cli]


def _strip_project_prefix(path: str) -> str:
    for pre in ("main/frontend/", "frontend/", "app/"):
        if path.startswith(pre):
            return path[len(pre):]
    return path.lstrip("/")


def _ensure_build_essentials(proj: Path) -> None:
    """Guarantee package.json / vite / tailwind / index.html are buildable even
    when the AI output omitted them. Never removes what the AI wrote."""
    pkg_path = proj / "package.json"
    pkg = {}
    if pkg_path.exists():
        try:
            pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
        except Exception:
            pkg = {}
    deps = pkg.setdefault("dependencies", {})
    dev = pkg.setdefault("devDependencies", {})
    runtime = {
        "react": "^18.2.0", "react-dom": "^18.2.0",
        "clsx": "^2.1.0", "tailwind-merge": "^2.2.0",
        "class-variance-authority": "^0.7.0",
        "framer-motion": "^11.0.0", "gsap": "^3.12.0",
        "@gsap/react": "^2.1.0", "@studio-freight/lenis": "^1.0.0",
        "@formkit/auto-animate": "^0.8.0", "lucide-react": "^0.300.0",
        "@fontsource/inter": "^5.0.0", "@fontsource/playfair-display": "^5.0.0",
        "embla-carousel-react": "^8.0.0", "canvas-confetti": "^1.9.0",
        "@radix-ui/react-dialog": "^1.0.0",
    }
    for k, v in runtime.items():
        deps.setdefault(k, v)
    for k, v in {
        "vite": "^5.4.0", "@vitejs/plugin-react": "^4.3.0",
        "typescript": "^5.3.0", "tailwindcss": "^3.4.0",
        "postcss": "^8.4.0", "autoprefixer": "^10.4.0",
    }.items():
        dev.setdefault(k, v)
    pkg.setdefault("type", "module")
    pkg["scripts"] = {"dev": "vite", "build": "vite build", "preview": "vite preview"}
    pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2), encoding="utf-8")

    # Our own vite.config forces relative base + a single inline chunk so the
    # built output can be inlined into one HTML file afterwards.
    (proj / "vite.config.ts").write_text(
        "import { defineConfig } from 'vite';\n"
        "import react from '@vitejs/plugin-react';\n"
        "export default defineConfig({\n"
        "  base: './',\n"
        "  plugins: [react()],\n"
        "  build: { outDir: 'dist', rollupOptions: { output: { inlineDynamicImports: true } } },\n"
        "});\n",
        encoding="utf-8",
    )

    if not (proj / "postcss.config.js").exists():
        (proj / "postcss.config.js").write_text(
            "export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n",
            encoding="utf-8",
        )
    if not (proj / "tailwind.config.js").exists():
        (proj / "tailwind.config.js").write_text(
            "/** @type {import('tailwindcss').Config} */\n"
            "export default { content: ['./index.html', './src/**/*.{ts,tsx}'],"
            " theme: { extend: {} }, plugins: [] };\n",
            encoding="utf-8",
        )

    html_path = proj / "index.html"
    if html_path.exists():
        idx = html_path.read_text(encoding="utf-8")
        if "main.tsx" not in idx and "main.jsx" not in idx:
            idx = idx.replace("</body>", '    <script type="module" src="/src/main.tsx"></script>\n  </body>')
            html_path.write_text(idx, encoding="utf-8")


def _run(cmd: List[str], cwd: Path, timeout: int) -> Tuple[int, str]:
    proc = subprocess.run(
        cmd,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    return proc.returncode, ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()


def _inline_assets(dist: Path, html: str) -> str:
    """Inline the single JS chunk and CSS emitted by Vite into the HTML."""

    def _file(href: str) -> str:
        if href.startswith(('http://', 'https://', 'data:', '//')):
            return ''
        p = (dist / href.lstrip('./')).resolve()
        try:
            p.relative_to(dist.resolve())
        except Exception:
            return ''
        if p.exists():
            return p.read_text(encoding="utf-8", errors="replace")
        return ''

    def _js(m):
        c = _file(m.group(1))
        return '<script type="module">' + c + '</script>' if c else m.group(0)

    def _css(m):
        c = _file(m.group(1))
        return '<style>' + c + '</style>' if c else m.group(0)

    html = re.sub('<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*></script>', _js, html)
    html = re.sub('<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>', _css, html)
    return html


def _patch_sandpack_package(files: Dict[str, str]) -> None:
    """Make the generated package.json install & run inside Sandpack's nodebox.

    Nodebox (CodeSandbox's in-browser Node runtime) cannot execute esbuild's
    native binary, so vite falls back to requiring the 'esbuild-wasm' module.
    When that module is missing the whole in-panel preview crashes with
    "Cannot find module 'esbuild-wasm'". Pin build-tool versions to ones that
    work inside nodebox and add esbuild-wasm so the preview always boots.
    """
    key = "main/frontend/package.json"
    raw = files.get(key)
    if not raw:
        return
    try:
        pkg = json.loads(raw)
    except Exception:
        return
    if not isinstance(pkg, dict):
        return
    deps = pkg.setdefault("dependencies", {})
    dev = pkg.setdefault("devDependencies", {})
    if "react" not in deps:
        deps["react"] = "^18.2.0"
    if "react-dom" not in deps:
        deps["react-dom"] = "^18.2.0"
    # Build tools pinned to versions compatible with Sandpack nodebox.
    # - esbuild: nodebox cannot run esbuild's native binary, vite falls back
    #   to 'esbuild-wasm' — without it the preview crashes at startup.
    # - rollup: nodebox's platform (linux-x32) has no native rollup build, so
    #   rollup is aliased to the official WASM build '@rollup/wasm-node', as
    #   rollup itself instructs for unsupported platforms.
    dev["vite"] = "5.4.9"
    dev["@vitejs/plugin-react"] = "^4.3.4"
    dev["typescript"] = "^5.6.3"
    dev["esbuild-wasm"] = "0.21.5"
    # rollup: nodebox has no native build for its platform (linux-x32), and
    # npm aliases ('npm:@rollup/wasm-node@...') are not supported by nodebox.
    # The frontend's makeSandpackSetup therefore strips all build-tool deps
    # before sending them to Sandpack, so nodebox uses the template's own
    # compatible stack. The alias here only helps the LOCAL build if somehow
    # a broken rollup bleeds through — it is ignored by nodebox.
    # (If Sandpack still crashes, see makeSandpackSetup in BuilderFullView.tsx
    # which is the authoritative filter.)
    dev.setdefault("@types/react", "^18.2.0")
    dev.setdefault("@types/react-dom", "^18.2.0")
    files[key] = json.dumps(pkg, ensure_ascii=False, indent=2)


HEAL_SYSTEM = r"""
You are SiteMorph Build Healer — a senior React/TypeScript engineer.

The vite build of a generated website FAILED. Your ONLY job is to fix the
reported build errors so that `npm install && vite build` passes.

- Fix ONLY what the build log reports: broken imports, missing files,
  TypeScript errors, invalid JSX, missing dependencies, wrong versions.
- PRESERVE the existing design, business facts, copy, colors and layout.
  Do not redesign anything.
- Keep every file complete — return the ENTIRE project, not diffs.
- Keep package.json dependencies consistent with the imports.
- Do not add markdown or commentary, JSON only.
"""


def _heal_build_errors(
    model: str,
    data: BuilderInput,
    art_direction: Dict[str, Any],
    files: Dict[str, str],
    meta: Dict[str, Any],
    build_err: str,
) -> Tuple[Optional[Dict[str, str]], Optional[Dict[str, Any]], Optional[str]]:
    """Ask the model to fix a failing vite build; returns a validated project."""
    prompt = f"""ORIGINAL USER PROMPT:
{data.extraPrompt or data.description or ''}

ART DIRECTION (keep it intact):
{json.dumps(art_direction, ensure_ascii=False, indent=2)}

VITE BUILD ERROR — fix exactly this:
{build_err[-4500:]}

CURRENT PROJECT:
{_project_for_review(files, max_chars=120000)}

Return the full corrected project JSON only. `vite build` MUST pass.
"""

    text, err = xkiro_generate_model(
        model,
        HEAL_SYSTEM,
        prompt,
        temperature=0.30,
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
            return None, None, "Heal invalid: " + " | ".join(issues[:5])
        return new_files, new_meta, None
    except Exception as e:
        return None, None, f"Heal parse error: {str(e)[:240]}"


def build_single_file_preview(files: Dict[str, str]) -> Tuple[Optional[str], Optional[str]]:
    """Compile the real React project into ONE self-contained HTML string.
    Returns (html, None) on success, (None, build_error) on failure."""
    npm = _npm_cmd()
    if not npm:
        return None, "node/npm niedostępne na tym backendzie"

    pid = uuid.uuid4().hex[:10]
    proj = BUILD_ROOT / pid / "app"
    proj.mkdir(parents=True, exist_ok=True)
    try:
        for path, content in (files or {}).items():
            rel = _strip_project_prefix(path)
            if not rel or not isinstance(content, str) or "preview.html" in rel:
                continue
            dest = proj / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")

        _ensure_build_essentials(proj)

        rc, log = _run(npm + ["install", "--no-audit", "--no-fund", "--loglevel=error"], proj, 480)
        if rc != 0:
            return None, "npm install:" + log[-2500:]

        vite_js = proj / "node_modules" / "vite" / "bin" / "vite.js"
        if not vite_js.exists():
            return None, "vite nie został zainstalowany"
        rc, log = _run([npm[0], str(vite_js), "build"], proj, 300)
        if rc != 0:
            return None, "vite build:" + log[-2500:]

        dist = proj / "dist"
        index = dist / "index.html"
        if not index.exists():
            return None, "Build OK, ale brak dist/index.html"
        html_str = _inline_assets(dist, index.read_text(encoding="utf-8"))
        if "<html" not in html_str.lower():
            return None, "Nieprawidłowy HTML po buildzie"
        return html_str, None
    except subprocess.TimeoutExpired:
        return None, "Timeout podczas npm install / vite build"
    except Exception as e:
        return None, f"Build exception: {str(e)[:400]}"
    finally:
        if BUILD_ROOT is not None:
            try:
                dirs = sorted(BUILD_ROOT.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
                for d in dirs[MAX_BUILD_DIRS:]:
                    shutil.rmtree(d, ignore_errors=True)
            except OSError:
                pass


def _has_real_react_app(files: Dict[str, str]) -> bool:
    return any(
        k.endswith(("/src/main.tsx", "/src/main.jsx", "/src/App.tsx"))
        for k in (files or {})
    )


def _build_error_page(business: str, log: str) -> str:
    esc = html.escape(log[-1800:])
    return f"""<!doctype html>
<html lang="pl">
<head><meta charset="UTF-8"/><title>{html.escape(business or 'SiteMorph')} — błąd builda</title></head>
<body style="margin:0;background:#0b0e14;color:#e5e7eb;font-family:ui-monospace,Consolas,monospace;padding:32px">
  <h2 style="color:#f87171;font-family:system-ui,sans-serif;font-size:16px">⚠ Błąd kompilacji wygenerowanego projektu React</h2>
  <p style="color:#9ca3af;font-family:system-ui,sans-serif;font-size:13px">Zmień prompt / odpowiedz inaczej i wygeneruj ponownie, albo popraw ten błąd:</p>
  <pre style="white-space:pre-wrap;font-size:12px;line-height:1.5;color:#fbbf24">{esc}</pre>
</body></html>
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
You are SiteMorph Discovery Agent.

You receive:
- the original user prompt
- a factual business brief already extracted by SiteMorph

Ask ONLY questions whose answers would materially improve conversion or design.
Do not ask for facts already present.
Do not force the user to choose a style if the brand brief already gives strong
visual signals; in that case let SiteMorph infer design automatically.

Return 0-4 questions maximum, all in Polish.
If no question is needed, return [].

For design-choice questions, include "Dobierz automatycznie" as the first option.
Never make "Ciemny", "Nowoczesny", "Inter" or any other style the default.

Useful unknowns:
- the primary conversion action when unclear
- a genuinely ambiguous light/dark preference
- a specific requested section that cannot be inferred
- whether user wants to preserve an existing brand color/style
- photo preference when it materially changes the concept

Return ONLY JSON array:
[
  {
    "question": "5-14 words po polsku",
    "placeholder": "",
    "options": ["Dobierz automatycznie", "...", "..."],
    "stateKey": "theme|layout|sections|tone|photos|goal|extras",
    "multi": false
  }
]
"""


@router.post("/generate-questions")
def generate_questions(data: QuestionInput):
    """Cheap compatibility wizard. No AI request is made here.

    Rich prompts go straight to the ONE DeepSeek V4 Pro build. Very short prompts get
    only a couple of optional questions so the UI still feels helpful.
    """
    prompt_text = (data.full_prompt or data.description or data.business_name or "").strip()
    detected = _detect_niche_from_text(prompt_text) or ""

    richness = 0
    if len(prompt_text) >= 180:
        richness += 1
    if re.search(r"\b\d{2}-\d{3}\b|\b(?:ul\.|ulica|aleja|al\.)\b", prompt_text, re.I):
        richness += 1
    if re.search(r"\b\+?48?[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b", prompt_text):
        richness += 1
    if re.search(r"menu|galeri|opin|kontakt|cennik|ofert|rezerw|zamów|zamow", prompt_text, re.I):
        richness += 1
    if re.search(r"kolor|styl|design|jasn|ciem|minimal|elegan|róż|roz|ziel|czarn", prompt_text, re.I):
        richness += 1

    if richness >= 2:
        questions: List[Dict[str, Any]] = []
    else:
        questions = [
            {
                "question": "Czy chcesz wskazać konkretny styl, czy SiteMorph ma dobrać go do marki?",
                "placeholder": "",
                "options": ["Dobierz automatycznie", "Minimalistyczny", "Editorial", "Ciepły i przytulny", "Odważny i energiczny"],
                "stateKey": "layout",
                "multi": False,
            },
            {
                "question": "Które sekcje są najważniejsze?",
                "placeholder": "",
                "options": ["Oferta", "Menu", "Cennik", "Galeria", "Opinie", "O nas", "Kontakt", "FAQ"],
                "stateKey": "sections",
                "multi": True,
            },
        ]

    response: Dict[str, Any] = {
        "questions": questions,
        "source": "local-single-pass",
    }
    if detected:
        response["detected_niche"] = detected
    return response


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
    descriptions = {d.get("url"): str(d.get("name") or d.get("description") or "")[:160]
                    for d in (data.image_details or []) if isinstance(d, dict)}
    return [
        {"query": descriptions.get(url) or "user uploaded asset", "url": url}
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


def _is_retryable_transport_error(err: Optional[str]) -> bool:
    """True when the model call failed at the transport/gateway level (not design).

    XKIRO sits behind Cloudflare which intermittently answers HTTP 524 (origin
    took too long) even for generations that would otherwise succeed. Retrying
    the SAME single generation once is transport resilience — it never adds a
    second design/revision stage.
    """
    if not err:
        return False
    low = err.lower()
    return any(
        token in low
        for token in (
            "http 5", "http 429", "http 409", "duplicate", "response_body_error",
            "timed out", "timeout", "connection", "network", "max retries", "remote end",
        )
    )


def _generate_project_with_retry(
    model: str, generation_prompt: str, max_tokens: Optional[int] = None,
) -> Tuple[Optional[Dict[str, str]], Dict[str, Any], Optional[str]]:
    """Compatibility name; exactly one request, including on HTTP errors."""
    text, err = xkiro_generate_model(
        model, SYSTEM_PROMPT, generation_prompt, temperature=0.58,
        max_tokens=max_tokens or MAX_OUTPUT_TOKENS, timeout=AI_TIMEOUT,
    )
    if not text:
        return None, {}, err or "Pusta odpowiedź modelu"
    try:
        parsed = extract_json(text)
        files = normalize_files(parsed.get("files"))
        files.pop("main/frontend/preview.html", None)
        valid, issues = validate_project(files)
        if not valid:
            return None, {}, " | ".join(issues[:10])
        meta = parsed.get("meta") if isinstance(parsed.get("meta"), dict) else {}
        meta.update(extract_contract(parsed))
        return files, meta, None
    except (ValueError, TypeError, AttributeError):
        return None, {}, "Niekompletny lub niepoprawny JSON projektu."


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
        answers=data.answers or ({"original_extra_prompt": data.extraPrompt} if data.extraPrompt else None),
        full_prompt=data.extraPrompt or data.description or "",
    )


def _generate_design_spec(data: BuilderInput, supplied):
    from app.design.prompt import SYSTEM_PROMPT as spec_prompt
    from app.design.validation import validate_spec
    raw_prompt = (data.extraPrompt or data.description or data.business_name or "").strip()
    request = json.dumps({"original_user_prompt": raw_prompt, "preferences": _explicit_preferences(data),
                          "provided_images": supplied}, ensure_ascii=False, separators=(",", ":"))
    selected_model = MODEL_MAP.get(data.mode or "normal", DEEPSEEK_MODEL)
    text, error = xkiro_generate_model(selected_model, spec_prompt, request,
        temperature=0.58, max_tokens=MAX_OUTPUT_TOKENS, timeout=AI_TIMEOUT)
    if not text:
        return None, [], error or "Pusta odpowiedź modelu."
    try:
        spec, warnings = validate_spec(extract_json(text), [asset["url"] for asset in supplied])
        return spec, warnings, None
    except (ValueError, TypeError, AttributeError, KeyError) as exc:
        # A concise contract error, no additional AI request and no substitute website.
        detail = str(exc).split("\n")
        return None, [], "Niepoprawny plan strony: " + " ".join(detail[:4])[:700]


@router.post("/generate")
def generate_site(data: BuilderInput, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    from app.design.assets import bind_assets
    from app.design.compiler import compile_design, VERSION as design_version
    from app.design.prompt import PROMPT_VERSION as spec_prompt_version
    if not current_user.get("id") or current_user.get("is_anon") or current_user["id"] == "anon":
        raise HTTPException(status_code=401, detail="Zaloguj się, aby wygenerować stronę.")
    if not XKIRO_API_KEY:
        raise HTTPException(status_code=503, detail="Brak konfiguracji modelu (XKIRO_API_KEY).")
    started = time.perf_counter()
    raw_prompt = (data.extraPrompt or data.description or data.business_name or "").strip()
    if not raw_prompt or len(raw_prompt) > 24000:
        raise HTTPException(status_code=400, detail="Prompt musi zawierać od 1 do 24000 znaków.")
    supplied = _user_uploaded_assets(data)
    llm_started = time.perf_counter()
    spec, warnings, error = _generate_design_spec(data, supplied)
    llm_ms = round((time.perf_counter() - llm_started) * 1000)
    if spec is None:
        raise HTTPException(status_code=502, detail="Nie udało się wygenerować poprawnej strony. " + (error or ""))
    asset_started = time.perf_counter()
    resolved, photos, asset_warnings, asset_report = bind_assets(spec, UNSPLASH_ACCESS_KEY)
    asset_ms = round((time.perf_counter() - asset_started) * 1000)
    compile_started = time.perf_counter()
    files, bindings, token_warnings = compile_design(spec, resolved)
    valid, issues = validate_project(files)
    if not valid:
        raise HTTPException(status_code=502, detail="Projekt nie przeszedł walidacji: " + " | ".join(issues[:10]))
    compile_ms = round((time.perf_counter() - compile_started) * 1000, 1)
    background_tasks.add_task(track_selected_photos, photos, UNSPLASH_ACCESS_KEY)
    warnings = warnings + asset_warnings + token_warnings
    hero = resolved["pagePlan"]["sections"][0]["props"]
    ctas = hero.get("ctas") or ([hero["cta"]] if hero.get("cta") else [])
    meta = {"title": spec.businessBrief.name, "headline": hero["headline"],
            "subheadline": hero.get("supportingText") or hero.get("lead") or hero.get("subheadline") or "",
            "ctaText": ctas[0]["label"] if ctas else "", "schemaVersion": "2.0"}
    brief = spec.businessBrief.model_dump()
    selected_model = MODEL_MAP.get(data.mode or "normal", DEEPSEEK_MODEL)
    provider_label = "claude-fable-5" if "fable" in selected_model else "qwen3.8-max" if "qwen" in selected_model else "deepseek-v4-pro"
    return {
        "status": "success", "provider": provider_label, "model": selected_model,
        "ai_calls": 1, "prompt_version": spec_prompt_version,
        "pipeline": "single-deepseek-spec-design-compiler-react",
        "design_compiler_version": design_version,
        "files": files, "meta": meta, "schema_version": "2.0",
        "design_spec": spec.model_dump(), "resolved_design": resolved,
        "design_brief": {**brief, "creative": spec.creative.model_dump(),
                         "semanticProfile": spec.semanticProfile.model_dump()},
        "design_tokens": spec.tokens.model_dump(), "design_bindings": bindings,
        "section_plan": resolved["pagePlan"]["sections"],
        "asset_requests": [asset.model_dump() for asset in spec.assetPlan.requests],
        "asset_report": asset_report,
        "generator_warnings": warnings, "warning": " | ".join(warnings) or None,
        "image_assets": supplied + photos, "refined": False,
        "quality_review": {"source": "deterministic-spec-and-project-validation",
                          "issues": issues, "visual_review_performed": False,
                          "review_input": {"concept": spec.creative.conceptTitle,
                                           "must_keep_working": spec.validationHints.mustKeepWorking}},
        "timings": {"model_and_spec_ms": llm_ms, "model_ms": llm_ms, "assets_ms": asset_ms,
                    "design_compile_ms": compile_ms,
                    "server_total_ms": round((time.perf_counter() - started) * 1000)},
        "business_brief": {**brief, "business": {"name": brief["name"], "category": brief["category"]}},
        "content": {"hero": {"title": meta["headline"], "subtitle": meta["subheadline"],
                             "cta_text": meta["ctaText"]}},
    }

# =============================================================================
# UPLOADS
# =============================================================================


@router.post("/upload")
async def upload_assets(files: List[UploadFile] = File(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("is_anon") or current_user.get("id") == "anon":
        raise HTTPException(status_code=401, detail="Zaloguj się, aby dodać zdjęcia.")
    urls: List[str] = []

    for f in files[:8]:
        raw = await f.read(6_000_001)
        if not raw or len(raw) > 6_000_000:
            raise HTTPException(status_code=422, detail="Zdjęcie musi mieć od 1 bajtu do 6 MB.")

        content_type = ("image/png" if raw.startswith(b"\x89PNG\r\n\x1a\n") else
                        "image/jpeg" if raw.startswith(b"\xff\xd8\xff") else
                        "image/gif" if raw.startswith((b"GIF87a", b"GIF89a")) else
                        "image/webp" if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP" else None)
        if not content_type:
            raise HTTPException(status_code=422, detail="Dodaj zdjęcie PNG, JPG, WebP lub GIF.")

        asset = UploadedAsset(
            id=uuid.uuid4().hex[:16],
            filename=(f.filename or "plik")[:120],
            content_type=content_type,
            data=raw,
            created_at=time.time(),
        )
        db.add(asset)
        urls.append(f"/api/builder/asset/{asset.id}")

    db.commit()
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
