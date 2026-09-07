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


load_dotenv()
router = APIRouter(prefix="/api/builder", tags=["AI Builder"])

# =============================================================================
# CONFIG — ONE MODEL, ONE AI REQUEST PER WEBSITE
# =============================================================================

XKIRO_API_KEY = os.getenv("XKIRO_API_KEY", "").strip()
XKIRO_BASE_URL = os.getenv("XKIRO_BASE_URL", "https://api.xkiro.com/v1").rstrip("/")
DEEPSEEK_MODEL = os.getenv("SITEMORPH_DEEPSEEK_MODEL", "deepseek/deepseek-v4-pro")
MAX_OUTPUT_TOKENS = int(os.getenv("SITEMORPH_MAX_OUTPUT_TOKENS", "32000"))
AI_TIMEOUT = int(os.getenv("SITEMORPH_AI_TIMEOUT", "420"))


class BuilderInput(BaseModel):
    business_name: str = ""
    niche: str = ""
    description: str = ""
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
# ONE-PASS DEEPSEEK SYSTEM PROMPT
# =============================================================================

SITE_GENERATOR_SYSTEM = r"""
You are SiteMorph — an autonomous senior brand strategist, art director,
UX designer, motion designer and React engineer.

You receive raw information about ONE real business. The raw prompt can be messy:
it may contain copied Google Maps UI, reviews, menu text, phone numbers, addresses,
URLs, image URLs and random interface labels.

YOUR JOB IS TO DO ALL THINKING INTERNALLY IN THIS SINGLE RESPONSE:

1. BUSINESS UNDERSTANDING
   - identify the exact business/brand name
   - identify what it sells
   - extract real facts from the prompt
   - ignore Google Maps UI garbage such as “Wyznacz trasę”, “Zapisz”, “Udostępnij”
   - never invent addresses, phone numbers, prices, ratings or testimonials

2. BRAND UNDERSTANDING
   - understand the emotional personality of THIS exact business
   - infer product associations, cultural references, audience and positioning
   - use explicit user preferences as the highest priority
   - if the user does not specify visual design, infer it intelligently

3. ART DIRECTION
   Silently decide:
   - palette
   - typography
   - shape language
   - photography/image direction
   - composition
   - whitespace
   - section rhythm
   - motion language
   - CTA hierarchy
   - mobile behavior

   Every important visual choice must make semantic sense for THIS business.

   Example: a Japanese mochi + matcha shop mentioning sakura should naturally suggest
   a light, tactile, Japanese-inspired visual world — warm cream, sakura pink,
   matcha green, charcoal typography, rounded forms inspired by mochi, bright food
   imagery and soft controlled motion. It should NOT randomly become black/gold,
   yellow/black industrial, corporate-blue SaaS or cyberpunk unless the user asks.

4. WEBSITE ARCHITECTURE
   Decide the best section order and compositions for the supplied business.
   Do not mechanically use the same layout for every project.

5. IMPLEMENT THE COMPLETE WEBSITE IN REACT + TYPESCRIPT.

CRITICAL DESIGN RULES
---------------------
- The finished website must look sellable to a real business owner.
- Do not create a generic AI landing page.
- Do not default to Inter, dark mode, black/gold, blue/purple SaaS, bento grids,
  glassmorphism, gradient text, giant rounded SaaS cards or three identical cards.
- Do not repeat the same section structure twice in a row.
- Use strong visual hierarchy and meaningful whitespace.
- Use large, intentional imagery when the business is image-led.
- Typography must have personality appropriate to the brand.
- Motion must support the brand, not exist just to show off.
- Responsive mobile design is mandatory.
- If the prompt contains real reviews, use those reviews instead of fake ones.
- If the prompt contains real image URLs, use those real image URLs where suitable.
- If supplied user asset URLs exist, use them before inventing generic imagery.

IMPLEMENTATION RULES
--------------------
- React 18 + TypeScript.
- Use normal TSX components.
- Use PLAIN CSS in src/index.css. DO NOT use Tailwind or another CSS framework.
- You may use ONLY these runtime packages:
    react
    react-dom
    framer-motion
    lucide-react
    clsx
- Do not use path aliases such as @/components. Use relative imports only.
- Do not import local image files. Use real remote URLs from the prompt/assets or
  create the visual treatment with CSS.
- No server-only APIs.
- Forms may have local success state, but do not claim they send to a backend.
- Buttons/anchors/navigation should actually work.
- Use semantic HTML and accessible labels.
- Avoid dangerouslySetInnerHTML.
- No TODOs, ellipses, placeholders, lorem ipsum or fake facts.
- Keep all imports coherent.

PROJECT STRUCTURE
-----------------
Return a real Vite/React project with at least:

main/frontend/package.json
main/frontend/index.html
main/frontend/src/main.tsx
main/frontend/src/App.tsx
main/frontend/src/index.css
main/frontend/src/components/... meaningful TSX components

Do NOT create preview.html.
Do NOT create a second HTML representation of the React page.
The React project is the single source of truth.

OUTPUT
------
Return ONLY valid JSON. No markdown fences. No explanation before or after it.

Exact shape:
{
  "files": {
    "main/frontend/package.json": "complete file contents",
    "main/frontend/index.html": "complete file contents",
    "main/frontend/src/main.tsx": "complete file contents",
    "main/frontend/src/App.tsx": "complete file contents",
    "main/frontend/src/index.css": "complete file contents",
    "main/frontend/src/components/Hero.tsx": "complete file contents"
  },
  "meta": {
    "title": "brand/site title",
    "businessName": "exact business name",
    "category": "specific business category",
    "headline": "main hero headline",
    "subheadline": "main supporting line",
    "ctaText": "primary CTA",
    "designConcept": "short name for the visual concept",
    "designSummary": "1-2 sentence summary of the design direction",
    "palette": ["#hex", "#hex", "#hex"]
  }
}

Before returning, silently inspect the full project:
- does it look specific to the business?
- is there a strong hero?
- are all major sections visible and styled?
- are the CSS selectors actually used?
- are imports valid?
- is mobile responsive?
- did you accidentally make a generic template?
If yes, fix it BEFORE returning the JSON.
"""


# =============================================================================
# HELPERS
# =============================================================================

def _raw_prompt(data: BuilderInput) -> str:
    return (data.extraPrompt or data.description or data.business_name or "").strip()


def _explicit_preferences(data: BuilderInput) -> Dict[str, Any]:
    return {
        "business_name_hint": (data.business_name or "").strip(),
        "niche_hint": (data.niche or "").strip(),
        "style": (data.style or "").strip(),
        "colors": (data.colors or "").strip(),
        "accent_color": (data.accent_color or "").strip(),
        "layout": (data.layout or "").strip(),
        "fonts": (data.fonts or "").strip(),
        "photo_style": (data.photo_style or "").strip(),
        "sections": data.sections or [],
        "answers": data.answers or {},
        "user_asset_urls": data.image_urls or [],
    }


def _extract_json(text: str) -> dict:
    if not text or not text.strip():
        raise ValueError("DeepSeek zwrócił pustą odpowiedź")

    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.I | re.S)
    if fence:
        cleaned = fence.group(1).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("Brak poprawnego obiektu JSON w odpowiedzi DeepSeek")
    return json.loads(cleaned[start : end + 1])


def _deepseek_once(user_prompt: str) -> Tuple[Optional[str], Optional[str]]:
    """Exactly one AI request. No critic, no parser agent, no preview agent, no AI retry."""
    if not XKIRO_API_KEY:
        return None, "Brak XKIRO_API_KEY"

    try:
        r = requests.post(
            f"{XKIRO_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {XKIRO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": DEEPSEEK_MODEL,
                "temperature": 0.68,
                "max_tokens": MAX_OUTPUT_TOKENS,
                "messages": [
                    {"role": "system", "content": SITE_GENERATOR_SYSTEM},
                    {"role": "user", "content": user_prompt},
                ],
            },
            timeout=AI_TIMEOUT,
        )
        print(f"[SiteMorph][ONE PASS] {DEEPSEEK_MODEL} -> HTTP {r.status_code}", flush=True)

        if r.status_code != 200:
            return None, f"{DEEPSEEK_MODEL}: HTTP {r.status_code} - {r.text[:500]}"

        payload = r.json()
        choices = payload.get("choices") or []
        if not choices:
            return None, f"{DEEPSEEK_MODEL}: brak choices"

        content = choices[0].get("message", {}).get("content", "")
        if isinstance(content, list):
            content = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )

        if not str(content).strip():
            return None, f"{DEEPSEEK_MODEL}: pusta odpowiedź"
        return str(content), None
    except Exception as exc:
        return None, f"{DEEPSEEK_MODEL}: {str(exc)[:400]}"


def _normalize_files(raw_files: Dict[str, Any]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for raw_path, content in (raw_files or {}).items():
        if not isinstance(raw_path, str) or not isinstance(content, str):
            continue

        path = raw_path.replace("\\", "/").lstrip("/")
        for prefix in ("main/frontend/", "frontend/"):
            if path.startswith(prefix):
                path = path[len(prefix) :]
                break

        # preview.html is intentionally forbidden. React is the source of truth.
        if path.lower().endswith("preview.html"):
            continue

        out[f"main/frontend/{path}"] = content
    return out


REQUIRED_FILES = {
    "main/frontend/package.json",
    "main/frontend/index.html",
    "main/frontend/src/main.tsx",
    "main/frontend/src/App.tsx",
    "main/frontend/src/index.css",
}

ALLOWED_EXTERNAL_PACKAGES = {
    "react",
    "react-dom",
    "framer-motion",
    "lucide-react",
    "clsx",
}


def _external_package_root(spec: str) -> str:
    if spec.startswith("@"):
        parts = spec.split("/")
        return "/".join(parts[:2]) if len(parts) >= 2 else spec
    return spec.split("/")[0]


def _validate_project(files: Dict[str, str]) -> List[str]:
    issues: List[str] = []
    missing = sorted(REQUIRED_FILES - set(files.keys()))
    if missing:
        issues.append("Brak wymaganych plików: " + ", ".join(missing))

    if any(path.lower().endswith("preview.html") for path in files):
        issues.append("Projekt nie może zawierać preview.html")

    app = files.get("main/frontend/src/App.tsx", "")
    css = files.get("main/frontend/src/index.css", "")
    all_code = "\n".join(files.values())

    if len(app.strip()) < 120:
        issues.append("App.tsx jest podejrzanie krótki")
    if len(css.strip()) < 1200:
        issues.append("index.css jest zbyt krótki jak na kompletną, dopracowaną stronę")
    if len(all_code) < 9000:
        issues.append("Projekt jest zbyt mały jak na kompletną stronę biznesową")

    if "@tailwind" in all_code or "tailwindcss" in all_code:
        issues.append("Tailwind jest wyłączony — użyj zwykłego CSS")

    banned = ["lorem ipsum", "TODO", "example.com", "adres do uzupełnienia", "telefon do uzupełnienia"]
    low = all_code.lower()
    for token in banned:
        if token.lower() in low:
            issues.append(f"Wykryto placeholder: {token}")

    # Check bare JS/TS imports. Local imports and full URLs are fine.
    import_patterns = [
        r"(?:from\s+|import\s*)['\"]([^'\"]+)['\"]",
        r"import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)",
    ]
    specs = set()
    for path, code in files.items():
        if not path.endswith((".ts", ".tsx", ".js", ".jsx")):
            continue
        for pattern in import_patterns:
            specs.update(re.findall(pattern, code))

    for spec in sorted(specs):
        if spec.startswith((".", "/", "http://", "https://")):
            continue
        root = _external_package_root(spec)
        if root not in ALLOWED_EXTERNAL_PACKAGES:
            issues.append(f"Nieobsługiwana zależność w preview: {spec}")

    try:
        package = json.loads(files.get("main/frontend/package.json", "{}"))
        deps = set((package.get("dependencies") or {}).keys())
        # Unknown dependencies can break browser preview even if currently unused.
        for dep in sorted(deps):
            if dep not in ALLOWED_EXTERNAL_PACKAGES:
                issues.append(f"Nieobsługiwana dependency w package.json: {dep}")
    except Exception:
        issues.append("package.json nie jest poprawnym JSON-em")

    return issues


def _generation_prompt(data: BuilderInput) -> str:
    raw = _raw_prompt(data)
    prefs = _explicit_preferences(data)
    return f"""ORIGINAL USER PROMPT — SOURCE OF TRUTH:
{raw}

EXPLICIT APP PREFERENCES — use only non-empty values and never let empty defaults override the raw prompt:
{json.dumps(prefs, ensure_ascii=False, indent=2)}

Generate the COMPLETE production-quality React website now.
Remember: one final React project only. No preview.html. JSON only.
"""


# =============================================================================
# COMPATIBILITY ENDPOINTS — NO EXTRA AI CALLS
# =============================================================================

@router.post("/generate-questions")
def generate_questions(_: QuestionInput):
    # The single DeepSeek request handles business understanding + design internally.
    # Keeping this endpoint prevents older frontends from breaking, but it never calls AI.
    return {
        "questions": [],
        "source": "single-pass-v4-pro",
        "detected_niche": "",
    }


@router.post("/design-agent")
def run_design_agent(_: DesignAgentInput):
    # Design Agent is intentionally embedded in the one DeepSeek generation request.
    return {
        "status": "embedded",
        "source": "single-pass-v4-pro",
        "message": "Brand strategy and art direction are performed internally by the single DeepSeek V4 Pro generation request.",
    }


# =============================================================================
# GENERATE — EXACTLY ONE DEEPSEEK REQUEST
# =============================================================================

@router.post("/generate")
def generate_site(data: BuilderInput):
    raw = _raw_prompt(data)
    if not raw:
        raise HTTPException(status_code=400, detail="Prompt jest pusty")

    text, err = _deepseek_once(_generation_prompt(data))
    if not text:
        raise HTTPException(status_code=502, detail=f"DeepSeek V4 Pro nie wygenerował strony: {err}")

    try:
        parsed = _extract_json(text)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"DeepSeek V4 Pro zwrócił nieprawidłowy JSON: {str(exc)[:400]}",
        )

    files = _normalize_files(parsed.get("files") or {})
    meta = parsed.get("meta") if isinstance(parsed.get("meta"), dict) else {}
    issues = _validate_project(files)
    if issues:
        raise HTTPException(
            status_code=502,
            detail="Projekt React został odrzucony przez validator: " + " | ".join(issues[:8]),
        )

    title = str(meta.get("title") or meta.get("businessName") or data.business_name or "Strona").strip()
    business_name = str(meta.get("businessName") or title).strip()
    category = str(meta.get("category") or data.niche or "").strip()

    return {
        "status": "success",
        "provider": "deepseek-v4-pro-single-pass",
        "model": DEEPSEEK_MODEL,
        "warning": None,
        "quality_score": None,
        "quality_review": None,
        "refined": False,
        "files": files,
        "meta": meta,
        "business_brief": {
            "business": {
                "name": business_name,
                "category": category,
                "subcategory": category,
            }
        },
        "content": {
            "hero": {
                "title": meta.get("headline") or business_name,
                "subtitle": meta.get("subheadline") or "",
                "cta_text": meta.get("ctaText") or "",
            },
            "services": [],
            "pricing": [],
        },
        "design_guidelines": {
            "concept": meta.get("designConcept") or "",
            "summary": meta.get("designSummary") or "",
            "palette": meta.get("palette") or [],
        },
    }


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
    asset = db.query(UploadedAsset).filter(UploadedAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Nie ma takiego pliku")

    return Response(
        content=asset.data,
        media_type=asset.content_type or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
