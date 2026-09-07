from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
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
from pathlib import Path

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

# Vercel Hobby terminates functions after 300s (fluid compute), so the whole
# pipeline (prompt parser + brand strategist + art director + main generation +
# critic + preview) must fit inside that budget. We default to tighter, faster
# budgets on Vercel and generous ones on a local/self-hosted backend. Every
# value can still be overridden via env vars.
_IS_VERCEL = os.getenv("VERCEL") == "1"

MAX_OUTPUT_TOKENS = int(os.getenv("SITEMORPH_MAX_OUTPUT_TOKENS", "8000" if _IS_VERCEL else "32000"))
AI_TIMEOUT = int(os.getenv("SITEMORPH_AI_TIMEOUT", "280" if _IS_VERCEL else "450"))
FAST_AI_TIMEOUT = int(os.getenv("SITEMORPH_FAST_AI_TIMEOUT", "120" if _IS_VERCEL else "180"))
PREVIEW_MAX_TOKENS = int(os.getenv("SITEMORPH_PREVIEW_MAX_TOKENS", "4000" if _IS_VERCEL else "16000"))
# Retry only once locally; on Vercel a second full regeneration would blow the
# 300s function budget.
GENERATION_ATTEMPTS = int(os.getenv("SITEMORPH_GENERATION_ATTEMPTS", "1" if _IS_VERCEL else "2"))

# One DeepSeek model powers every AI stage in SiteMorph.
# Keep the mode names for frontend/pricing compatibility, but they all resolve
# to the same model. Quality differences can still come from refinement policy.
DEEPSEEK_MODEL = os.getenv("SITEMORPH_DEEPSEEK_MODEL", "deepseek/deepseek-v4-pro")

MODEL_MAP = {
    "normal": DEEPSEEK_MODEL,
    "ultra": DEEPSEEK_MODEL,
    "ultra+": DEEPSEEK_MODEL,
}

PROMPT_PARSER_MODEL = DEEPSEEK_MODEL
BRAND_STRATEGIST_MODEL = DEEPSEEK_MODEL
ART_DIRECTOR_MODEL = DEEPSEEK_MODEL
CRITIC_MODEL = DEEPSEEK_MODEL
QUESTIONS_MODEL = DEEPSEEK_MODEL
PREVIEW_MODEL = DEEPSEEK_MODEL

# One automatic critique/revision pass gives a large quality improvement, but costs
# another generation request. Disable with SITEMORPH_ENABLE_REFINEMENT=0 if needed.
# Refinement costs one more full generation. Keep it locally (quality), skip it
# on Vercel (the 300s function budget cannot fit a second full regeneration).
ENABLE_REFINEMENT = os.getenv("SITEMORPH_ENABLE_REFINEMENT", "0" if _IS_VERCEL else "1") == "1"
REFINE_NORMAL = os.getenv("SITEMORPH_REFINE_NORMAL", "1") == "1"
REFINE_PREMIUM = os.getenv("SITEMORPH_REFINE_PREMIUM", "1") == "1"
QUALITY_TARGET = float(os.getenv("SITEMORPH_QUALITY_TARGET", "8.6"))

# When True an AI model rewrites the React project into a self-contained
# preview.html replica (only needed where a real Vite build cannot run, e.g.
# Vercel serverless). When False (default, local backend has node/npm) the REAL
# React project is compiled with Vite and inlined into preview.html, so the live
# preview shows exactly what was generated — no AI-made copy, no extra AI call.
GENERATE_STANDALONE_PREVIEW = os.getenv(
    "SITEMORPH_STANDALONE_PREVIEW",
    "0" if not os.getenv("VERCEL") else "1",
) == "1"

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
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.72,
    max_tokens: int = MAX_OUTPUT_TOKENS,
    timeout: Optional[int] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Call an OpenAI-compatible XKIRO model with safe output-token retries.

    XKIRO/model gateways may reject an otherwise valid request when max_tokens is
    above the model's real output ceiling. SiteMorph therefore starts at a safe
    ceiling and automatically retries smaller values on request-size/token errors.
    """
    if not XKIRO_API_KEY:
        return None, "Brak XKIRO_API_KEY"

    requested = max(512, min(int(max_tokens or MAX_OUTPUT_TOKENS), MAX_OUTPUT_TOKENS, 32000))
    token_attempts = []
    for candidate in (requested, 24000, 16000, 12000):
        candidate = min(candidate, requested)
        if candidate >= 512 and candidate not in token_attempts:
            token_attempts.append(candidate)

    last_error = None
    for output_tokens in token_attempts:
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
                    "max_tokens": output_tokens,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=timeout or AI_TIMEOUT,
            )

            print(
                f"[SiteMorph][XKIRO] {model} max_tokens={output_tokens} -> HTTP {r.status_code}",
                flush=True,
            )

            if r.status_code != 200:
                last_error = f"{model}: HTTP {r.status_code} - {r.text[:400]}"
                # Retry smaller output limits for the common gateway/model limit failures.
                if r.status_code in {400, 413, 422}:
                    continue
                return None, last_error

            data = r.json()
            choices = data.get("choices") or []
            if not choices:
                last_error = f"{model}: brak choices"
                continue

            content = choices[0].get("message", {}).get("content", "")
            if isinstance(content, list):
                content = "".join(
                    part.get("text", "") if isinstance(part, dict) else str(part)
                    for part in content
                )

            if not str(content).strip():
                last_error = f"{model}: pusta odpowiedz"
                continue

            return str(content), None

        except Exception as e:
            last_error = f"{model}: {str(e)[:240]}"
            # Network/timeout exceptions are not fixed by changing max_tokens.
            break

    return None, last_error or f"{model}: nieznany blad"



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
# PROMPT PARSER -> BRAND STRATEGIST -> ART DIRECTOR
# =============================================================================


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
    business_brief = parse_business_prompt(data)
    brand_strategy = create_brand_strategy(data, business_brief)
    art, source = create_art_direction(data, business_brief, brand_strategy)
    return {
        "status": "success",
        "business_brief": business_brief,
        "brand_strategy": brand_strategy,
        "art_direction": art,
        "design_guidelines": art,
        "source": source,
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
2) FACTUAL BUSINESS BRIEF
3) BRAND STRATEGY
4) ART DIRECTION / PAGE BLUEPRINT
5) Correct, production-quality implementation
6) Restraint and polish
7) Library convenience

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
    business_brief: Dict[str, Any],
    brand_strategy: Dict[str, Any],
    art_direction: Dict[str, Any],
    image_assets: List[Dict[str, str]],
) -> str:
    return f"""ORIGINAL USER PROMPT — SOURCE OF TRUTH:
{data.extraPrompt or data.description or ''}

FACTUAL BUSINESS BRIEF — DO NOT CONTRADICT:
{json.dumps(business_brief, ensure_ascii=False, indent=2)}

BRAND STRATEGY — WHY THE DESIGN SHOULD FEEL THIS WAY:
{json.dumps(brand_strategy, ensure_ascii=False, indent=2)}

ART DIRECTION / PAGE BLUEPRINT — IMPLEMENT THIS, DO NOT REDESIGN:
{json.dumps(art_direction, ensure_ascii=False, indent=2)}

EXPLICIT APP/WIZARD PREFERENCES:
{json.dumps(_explicit_preferences(data), ensure_ascii=False, indent=2)}

APPROVED IMAGE ASSETS:
{json.dumps(image_assets, ensure_ascii=False, indent=2) if image_assets else '[]'}

IMPLEMENTATION RULES:
- User facts beat everything.
- Explicit user design preferences beat inferred design.
- The Brand Strategy explains the semantic world; the Art Direction is the final design spec.
- You are the IMPLEMENTER, not a second art director.
- Do not introduce a different palette, font, shape language or generic trend.
- Use real products, reviews, rating, address, phone and links from the brief when available.
- If user-uploaded assets exist, prioritize them.
- Otherwise use approved image assets in contexts matching their query.
- Do not repeat one image across unrelated sections unless specified.
- Do not invent random external image URLs.
- Build the complete React website and return JSON only.
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

    # A well-architected App.tsx can be intentionally tiny when the real design
    # lives in meaningful components. Reject only genuinely empty/broken entry files.
    if len(app.strip()) < 120:
        issues.append("App.tsx is missing or suspiciously empty")

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

    tsx_files = [k for k in files if k.endswith((".tsx", ".jsx"))]
    has_component_structure = len(tsx_files) >= 2 or len(app) >= 900
    if not has_component_structure:
        issues.append("React project has too little component structure")

    hard_fail = (
        bool(missing)
        or len(app.strip()) < 120
        or total_chars < 6500
        or not has_component_structure
    )
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
    prompt_text = data.full_prompt or data.description or data.business_name or ""
    business_brief = parse_business_prompt(data)
    business = business_brief.get("business") or {}
    detected = (
        business.get("subcategory")
        or business.get("category")
        or _detect_niche_from_text(prompt_text)
        or ""
    )

    if XKIRO_API_KEY:
        user_msg = f"""ORIGINAL USER PROMPT:
{prompt_text}

FACTUAL BUSINESS BRIEF:
{json.dumps(business_brief, ensure_ascii=False, indent=2)}

Ask only questions that would materially improve the final site.
If the prompt is already rich enough, return [].
JSON only.
"""
        text, err = xkiro_generate_model(
            QUESTIONS_MODEL,
            QUESTIONS_SYSTEM_PROMPT,
            user_msg,
            temperature=0.28,
            max_tokens=2400,
            timeout=FAST_AI_TIMEOUT,
        )
        if text:
            try:
                arr = extract_json_array(text)
                valid = [
                    q for q in arr
                    if isinstance(q, dict) and q.get("question") and q.get("stateKey")
                ][:4]
                resp = {
                    "questions": valid,
                    "source": QUESTIONS_MODEL,
                    "business_brief": business_brief,
                }
                if detected:
                    resp["detected_niche"] = detected
                return resp
            except Exception as e:
                print(f"[Questions] parse error: {e}", flush=True)

    # Safe fallback: never imposes a visual style.
    fallback_questions = [
        {
            "question": "Co ma być główną akcją na stronie?",
            "placeholder": "",
            "options": ["Dobierz automatycznie", "Zamów", "Zarezerwuj", "Zadzwoń", "Napisz", "Odwiedź lokal"],
            "stateKey": "goal",
            "multi": False,
        },
        {
            "question": "Czy chcesz wskazać najważniejsze sekcje?",
            "placeholder": "",
            "options": ["Oferta", "Menu", "Galeria", "Opinie", "O nas", "Kontakt", "FAQ"],
            "stateKey": "sections",
            "multi": True,
        },
    ]

    resp = {
        "questions": fallback_questions,
        "source": "fallback",
        "business_brief": business_brief,
    }
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


def _generate_project_with_retry(
    model: str,
    generation_prompt: str,
) -> Tuple[Optional[Dict[str, str]], Dict[str, Any], Optional[str]]:
    """Generate the React project, retrying once when JSON/project validation fails."""
    last_error = None
    retry_note = ""

    for attempt in range(GENERATION_ATTEMPTS):
        user_prompt = generation_prompt
        temperature = 0.54 if attempt == 0 else 0.30
        if attempt == 1:
            user_prompt += f"""

RETRY AFTER A FAILED GENERATION.
The previous response could not be accepted by SiteMorph.
Reason: {last_error or 'invalid or incomplete project'}

Return ONLY one valid JSON object with a COMPLETE React/Vite project.
Do not omit App.tsx, main.tsx, index.css, index.html or package.json.
If App.tsx is small because it composes components, that is fine, but every imported
component must be included in files. Do not output markdown or commentary.
"""

        text, err = xkiro_generate_model(
            model,
            SYSTEM_PROMPT,
            user_prompt,
            temperature=temperature,
            max_tokens=MAX_OUTPUT_TOKENS,
            timeout=AI_TIMEOUT,
        )
        if not text:
            last_error = err or "empty model response"
            continue

        try:
            parsed = extract_json(text)
            candidate_files = normalize_files(parsed.get("files") or {})
            candidate_meta = parsed.get("meta") or {}
            valid, issues = validate_project(candidate_files)
            if valid:
                return candidate_files, candidate_meta, None
            last_error = " | ".join(issues[:6])
        except Exception as e:
            last_error = f"parse error: {str(e)[:220]}"

    return None, {}, last_error or "generation failed"


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


@router.post("/generate")
def generate_site(data: BuilderInput):
    warning_parts: List[str] = []

    try:
        mode = (data.mode or "normal").lower().strip()
        selected_model = DEEPSEEK_MODEL
        print(f"[SiteMorph] mode={mode} model={selected_model}", flush=True)

        art_input = _make_art_input(data)

        # ---------------------------------------------------------------------
        # 1) PROMPT PARSER — raw prompt -> factual business brief
        # ---------------------------------------------------------------------
        business_brief = parse_business_prompt(art_input)
        business = business_brief.get("business") or {}

        # Improve compatibility with legacy fallback/meta code without inventing data.
        inferred_name = str(business.get("name") or "").strip()
        inferred_niche = str(
            business.get("subcategory")
            or business.get("category")
            or data.niche
            or ""
        ).strip()
        if inferred_name and not (data.business_name or "").strip():
            data.business_name = inferred_name
        if inferred_niche and not (data.niche or "").strip():
            data.niche = inferred_niche

        print(
            f"[SiteMorph] Parsed brand={data.business_name or '?'} niche={data.niche or '?'}",
            flush=True,
        )

        # ---------------------------------------------------------------------
        # 2) BRAND STRATEGIST — facts -> semantic brand world
        # ---------------------------------------------------------------------
        brand_strategy = create_brand_strategy(art_input, business_brief)

        # ---------------------------------------------------------------------
        # 3) ART DIRECTOR — strategy -> exact visual system + page blueprint
        # ---------------------------------------------------------------------
        art_direction, art_source = create_art_direction(
            art_input,
            business_brief,
            brand_strategy,
        )
        print(f"[SiteMorph] Art Director: {art_source}", flush=True)

        # ---------------------------------------------------------------------
        # 4) IMAGE DIRECTION -> REAL ASSETS
        # ---------------------------------------------------------------------
        image_assets = _user_uploaded_assets(data)

        # URLs contained in the original prompt are also trusted user-supplied assets.
        if not image_assets:
            prompt_images = business_brief.get("image_urls_from_prompt") or []
            image_assets = [
                {"query": "image from original user prompt", "url": str(url)}
                for url in prompt_images[:8]
                if isinstance(url, str) and url.startswith(("http://", "https://"))
            ]

        if not image_assets:
            queries = _art_image_queries(art_direction)
            image_assets = collect_design_images(queries, max_total=8)

        # ---------------------------------------------------------------------
        # 5) DEEPSEEK V4 PRO — implement the art direction in real React
        # ---------------------------------------------------------------------
        generation_prompt = _build_generation_prompt(
            data,
            business_brief,
            brand_strategy,
            art_direction,
            image_assets,
        )

        parsed_files: Optional[Dict[str, str]] = None
        parsed_meta: Dict[str, Any] = {}
        provider = "fallback"

        if XKIRO_API_KEY:
            generated_files, generated_meta, generation_err = _generate_project_with_retry(
                selected_model,
                generation_prompt,
            )
            if generated_files:
                parsed_files = generated_files
                parsed_meta = generated_meta
                provider = f"deepseek-v4-pro ({mode})"
            else:
                warning_parts.append(f"DeepSeek generation failed: {generation_err}")

        # ---------------------------------------------------------------------
        # 6) LOCAL EMERGENCY FALLBACK
        # ---------------------------------------------------------------------
        fb = fallback_content(data)
        if parsed_files is None:
            parsed_files = normalize_files(fb.get("files") or {})
            parsed_meta = fb.get("meta") or {}
            provider = "fallback"
            warning_parts.append("DeepSeek generation failed; local emergency fallback used")

        # ---------------------------------------------------------------------
        # 7) STATIC VALIDATION + DEEPSEEK DESIGN CRITIC
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
        # 8) ONE DEEPSEEK REVISION PASS WHEN QUALITY IS BELOW TARGET
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
        # 9) EXPORT HTML FOR THE EXISTING /api/publish ONLY.
        #    The Builder UI renders the REAL React project with Sandpack.
        #    This preview.html is no longer the design/live-preview source.
        # ---------------------------------------------------------------------
        if not GENERATE_STANDALONE_PREVIEW and _has_real_react_app(parsed_files):
            built_html, build_err = build_single_file_preview(parsed_files)
            if built_html:
                parsed_files["main/frontend/preview.html"] = built_html
            elif build_err:
                parsed_files["main/frontend/preview.html"] = _build_error_page(
                    parsed_meta.get("title") or data.business_name, build_err
                )
                warning_parts.append("React export build failed: " + build_err.replace("\n", " | ")[:240])
            else:
                ensure_preview_entry(
                    parsed_files,
                    parsed_meta.get("title") or data.business_name,
                )
        else:
            export_html, export_err = make_standalone_preview(
                data,
                art_direction,
                parsed_files,
            )
            if export_html:
                parsed_files["main/frontend/preview.html"] = export_html
            else:
                ensure_preview_entry(
                    parsed_files,
                    parsed_meta.get("title") or data.business_name,
                )
                if export_err not in {None, "disabled"}:
                    warning_parts.append(f"HTML export fallback: {export_err}")

        meta = parsed_meta or fb.get("meta") or {}
        if not meta.get("title"):
            meta["title"] = data.business_name or "Strona"
        hero = {
            "title": meta.get("headline", data.business_name),
            "subtitle": meta.get("subheadline", business.get("description") or data.description),
            "cta_text": meta.get("ctaText", "Kontakt"),
        }

        return {
            "status": "success",
            "provider": provider,
            "model": selected_model if provider != "fallback" else None,
            "warning": " | ".join(warning_parts) if warning_parts else None,
            "quality_score": round(review_score, 1),
            "quality_review": review,
            "refined": refined,
            "content": {"hero": hero, "services": [], "pricing": []},
            "files": parsed_files,
            "meta": meta,
            "business_brief": business_brief,
            "brand_strategy": brand_strategy,
            "design_guidelines": art_direction,
            "art_director": art_source,
            "image_assets": image_assets,
            # Compatibility fields used by older UI/debug panels.
            "gemini_key_loaded": False,
            "gemini_model": None,
            "openrouter_model": selected_model if provider != "fallback" else None,
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
                "gemini_key_loaded": False,
                "gemini_model": None,
                "openrouter_model": None,
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
