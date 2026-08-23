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
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "poolsideai/laguna-s-2.1:free")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "SiteMorph")

# Google (Gemini) — glowny provider
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
# Preferowana kolejnosc modeli — resolver sam sprawdzi co realnie jest dostepne dla klucza
GEMINI_PREFERRED = [
    m.strip() for m in os.getenv(
        "GEMINI_MODELS",
        # gemini-2.5-flash / 2.0-flash sa juz wycofane dla nowych kluczy (404)
        "gemini-3.7-flash,gemini-flash-latest,gemini-3-flash-preview,gemini-3.1-flash-lite,gemini-2.5-flash-lite",
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
            timeout=20,
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
    # Nie udalo sie ustalic — probuj po kolei nazw preferowanych przy wywolaniu
    _gemini_model_cache = GEMINI_PREFERRED[0] if GEMINI_PREFERRED else None
    return _gemini_model_cache


def gemini_generate(system_prompt: str, user_prompt: str, temperature: float = 0.85, max_tokens: int = 32768):
    """Zwroc (tekst, None) albo (None, opis_bledu). Probuje kilka nazw modeli.
    Uzywa natywnego trybu JSON (responseMimeType) — odpowiedz jest zawsze
    kompletnym JSON-em, bez markdown i bez obcinania."""
    if not GEMINI_API_KEY:
        return None, "Brak GEMINI_API_KEY"
    primary = resolve_gemini_model()
    candidates: List[str] = []
    for m in [primary] + GEMINI_PREFERRED:
        if m and m not in candidates:
            candidates.append(m)
    errs: List[str] = []
    for mdl in candidates[:5]:
        # wariant A: tryb JSON; wariant B: zwykly tekst (gdyby model nie wspieral mime)
        for use_json_mime in (True, False):
            gen_cfg: dict = {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
            if use_json_mime:
                gen_cfg["responseMimeType"] = "application/json"
            try:
                # 5xx bywa chwilowe (przeciazenie Google) — 3 proby z czekaniem
                data = None
                for attempt in range(3):
                    r = requests.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{mdl}:generateContent",
                        params={"key": GEMINI_API_KEY},
                        json={
                            "systemInstruction": {"parts": [{"text": system_prompt}]},
                            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                            "generationConfig": gen_cfg,
                        },
                        timeout=300,
                    )
                    print(f"[SiteMorph][Gemini] {mdl} mime={use_json_mime} proba={attempt+1} -> HTTP {r.status_code}", flush=True)
                    if r.status_code >= 500:
                        time.sleep(2 + attempt * 3)
                        continue
                    break
                if r is None:
                    last_err = f"{mdl}: brak odpowiedzi"
                    errs.append(last_err)
                    break
                if r.status_code >= 500:
                    last_err = f"{mdl}: HTTP {r.status_code} po 3 probach (przeciazenie)"
                    errs.append(last_err)
                    break
                if r.status_code == 404:
                    last_err = f"{mdl}: model niedostepny (404)"
                    errs.append(f"{mdl}:404")
                    break  # kolejny model, nie wariant
                if r.status_code == 400 and use_json_mime:
                    errs.append(f"{mdl}(mime):400:{r.text[:100]}")
                    last_err = f"{mdl}: 400 przy responseMimeType — probuje bez trybu JSON"
                    continue  # wariant B
                if r.status_code in (400, 403):
                    errs.append(f"{mdl}:HTTP{r.status_code}:{r.text[:120]}")
                    last_err = f"{mdl}: HTTP {r.status_code}: {r.text[:180]}"
                    break
                r.raise_for_status()
                data = r.json()
                cands = data.get("candidates") or []
                if not cands:
                    errs.append(f"{mdl}: brak candidates")
                    last_err = f"{mdl}: brak candidates"
                    break
                parts = cands[0].get("content", {}).get("parts", []) or []
                text = "".join(p.get("text", "") for p in parts)
                finish = (cands[0].get("finishReason") or "").upper()
                if not text.strip():
                    errs.append(f"{mdl}: pusta (finish={finish})")
                    last_err = f"{mdl}: pusta odpowiedz (finish={finish})"
                    break
                return text, None
            except Exception as e:
                errs.append(f"{mdl}: EXC {str(e)[:100]}")
                last_err = f"{mdl}: {str(e)[:150]}"
                break
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

IMPECCABLE_DESIGN_RULES = """Impeccable — reguły projektowe

Jesteś doświadczonym dyrektorem kreatywnym, senior product designerem i typografem. Twoje zadanie to projektowanie interfejsów i stron na poziomie impeccable — bezbłędnych, premium, ponadczasowych.

ZASADY NACZELNE:
- Prostota ponad dekorację. Każdy piksel ma uzasadnienie. Usuń wszystko zbędne. Białe przestrzenie to luksus.
- Hierarchia wizualna jest święta: nagłówek H1 dominuje, H2 wspiera, body jest ciche. Kontrast wielkości 1.6x–2.5x między poziomami.
- Typografia: SF Pro Display / Inter, antyaliasing, tracking -0.015em dla nagłówków, line-height 1.05 dla hero, 1.6 dla body. Nigdy nie łam zasad rytmu pionowego (8px grid).
- Paleta: neutralne tła (biały, #fafafa, #0a0a0a) + jeden akcent limonkowy #bef264 / #a3e635 / #34d399. Akcent używaj oszczędnie: CTA, aktywne stany, małe detale. 60-30-10.
- Zaokrąglenia 16–28px dla kart, 9999px dla pigułek. Cienie miękkie, rozproszone (0 8px 32px rgba(0,0,0,0.06)), nigdy ostre.
- Motion: spring 350/25 dla mikrointerakcji, stagger 0.08 dla list. Blur + scale + y dla wejść cinematic. Nigdy liniowo.
- Dostępność: kontrast AA, focus visible (ring 2px), hit area min 44px, stany hover/pressed/disabled jawne.
- Content first: prawdziwe teksty, nie lorem ipsum. Nagłówki sprzedażowe, konkretne liczby, CTA z czasownikiem.
- Spójność: ten sam radius, ten sam border, ta sama siatka na całej stronie. Brak wyjątków.
- Detale decydują: wyrównanie do pixela, równe paddingi, ikony optycznie wycentrowane, brak sierot typograficznych.
- Mobile first: dotyk, kciuk, 16px min font, brak hover-only.
- Zasada końcowa: jeśli coś wygląda „ładnie” ale nie pomaga użytkownikowi — usuń. Wybieraj zaangażowanie, nie ozdobę. Wybieraj konwersję, nie efekt. Wybieraj spokój, nie krzyk. Wybieraj impeccable. Wybieraj zaangażowanie.
"""

INDEX_HTML_RULE = """- GŁÓWNY PLIK STRONY to "main/frontend/index.html" — JEDEN samowystarczalny plik z CAŁĄ stroną:
  * <script src="https://cdn.tailwindcss.com"></script> w <head> (Tailwind CDN),
  * WSZYSTKIE style w <style>, cały JS inline na dole body,
  * ZERO importów lokalnych, ZERO /src/..., ZERO plików zewnętrznych poza CDN-ami (Google Fonts OK),
  * ikony jako inline SVG (nie lucide-react!), zakaz emoji — tylko SVG,
  * strona MUSI w pełni renderować się po prostu otwarciu pliku w przeglądarce (to z niej robimy podgląd i link demo).
  Możesz użyć czystego HTML/CSS + małego vanilla JS (tabs, akordeon, smooth scroll) — bez Reacta. To preferowane.
"""

SYSTEM_PROMPT = IMPECCABLE_DESIGN_RULES + """

Jesteś SiteMorph AI — generator premium stron dla lokalnych firm.
ZADANIE: Wygeneruj kompletny projekt strony w DOKŁADNIE tej strukturze folderów:

  main/
  ├── frontend/
  │   └── index.html        <- CAŁA strona, jeden samowystarczalny plik
  ├── backend/main.py       <- OPCJONALNIE: tylko jeśli strona potrzebuje backendu
  ├── package.json
  └── README.md

""" + INDEX_HTML_RULE + """
ZASADY BEZWZGLĘDNE:
- NIGDY nie zadawaj pytań zwrotnych i NIE prosisz o doprecyzowanie. Masz wystarczająco danych — działasz od razu.
- Użytkownik często wkleja SUROWY tekst skopiowany z wizytówki Google Maps (nazwa, ocena, liczba opinii, przedział cen, kategoria, adres, telefon, strona, godziny otwarcia, fragmenty opinii klientów, nazwy dań/usług).
- WYCIĄGNIJ z takiego tekstu wszystkie fakty i użyj ich na stronie: nazwa firmy jako brand, adres i telefon w sekcji Kontakt, zakres cen w Cenniku, opinie klientów (z imionami autorów!) jako sekcja Opinie/Testimoniale, pozycje menu/oferty jako karty usług, ocena gwiazdkowa jako badge social proof.
- Czegokolwiek brakuje — uzupełnij realistycznymi wartościami domyślnymi pasującymi do branży. NIGDY o to nie pytaj.
- Twoja odpowiedź to ZAWSZE od razu kompletny JSON z plikami. Żaden inny format.

FORMAT ODPOWIEDZI — tylko poprawny JSON, bez markdown:
{
  "files": {
    "main/frontend/index.html": "<!doctype html>...CAŁA strona...",
    "main/backend/main.py": "# FastAPI — TYLKO jeśli strona potrzebuje backendu (np. formularz kontaktowy); inaczej POMIŃ ten klucz",
    "main/package.json": "{...}",
    "main/README.md": "# Nazwa — krótki opis projektu i jak uruchomić"
  },
  "meta": {
    "title": "Nazwa Firmy — krótki tytuł SEO",
    "headline": "Główny nagłówek hero (max 8 słów, sprzedażowy)",
    "subheadline": "Podtytuł hero (1 zdanie, benefity)",
    "ctaText": "Tekst przycisku CTA np. Umów wizytę"
  }
}
- main/backend/main.py: twórz TYLKO gdy jest realnie potrzebny (formularz kontaktowy, rezerwacja). Wtedy prosty FastAPI z endpointem POST /api/contact i komentarzem jak uruchomić. Frontend w index.html woła fetch('/api/contact', {method:'POST'}).
- DESIGN: premium, konwersyjny, responsywny (mobile-first), font systemowy/Google Fonts, akcent wg COLORS użytkownika, dużo światła, zaokrąglenia 16-24px, miękkie cienie.
- TREŚCI: po polsku, realistyczne dla branży; sekcje dokładnie wg SECTIONS użytkownika (domyślnie Hero, Oferta, Cennik, Opinie, Kontakt).
- NIE używaj "lorem ipsum". Zwróć PEŁNE pliki — nie skracaj, nie pisz "...".
"""

def extract_json(text: str) -> dict:
    # Usuń ```json fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    # Znajdź pierwszy { i ostatni }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end+1]
    return json.loads(text)

def fallback_content(data: BuilderInput):
    title = f"{data.business_name or 'Twoja Firma'} - {data.niche or 'Uslugi lokalne'}"
    headline = (data.description[:80] if data.description else f"Nowoczesne {data.niche or 'uslugi'} dla wymagajacych")
    bn = data.business_name or "Twoja Firma"
    niche = data.niche or "Usługi lokalne"
    desc = data.description or f"Profesjonalne usługi {niche}. Skontaktuj się i umów bezpłatną wycenę."
    year = time.strftime("%Y")
    html = """<!doctype html>
<html lang="pl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>""" + title + """</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
<style>body{font-family:'Inter',system-ui,sans-serif}</style>
</head>
<body class="bg-white text-neutral-900">
<header class="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
  <span class="font-black text-xl tracking-tight">__BN__</span>
  <a href="#kontakt" class="bg-neutral-900 text-white px-5 py-2 rounded-full text-sm font-bold">Kontakt</a>
</header>
<section class="max-w-6xl mx-auto px-6 py-20 text-center">
  <h1 class="text-4xl sm:text-6xl font-black tracking-tight leading-tight">__HEAD__</h1>
  <p class="mt-5 text-lg text-neutral-600 max-w-2xl mx-auto">__DESC__</p>
  <a href="#kontakt" class="inline-block mt-8 bg-lime-300 text-black px-8 py-4 rounded-full font-black hover:brightness-95 transition">Umów bezpłatną wycenę</a>
</section>
<section class="max-w-6xl mx-auto px-6 pb-16 grid sm:grid-cols-3 gap-5">
  <div class="p-7 rounded-2xl bg-neutral-50 border border-neutral-200"><div class="text-3xl mb-2">&#9889;</div><h3 class="font-black">Szybka realizacja</h3><p class="text-sm text-neutral-600 mt-1">Strona gotowa nawet w 48h od akceptacji projektu.</p></div>
  <div class="p-7 rounded-2xl bg-neutral-50 border border-neutral-200"><div class="text-3xl mb-2">&#128142;</div><h3 class="font-black">Premium jakość</h3><p class="text-sm text-neutral-600 mt-1">Nowoczesny design dopasowany do Twojej marki.</p></div>
  <div class="p-7 rounded-2xl bg-neutral-50 border border-neutral-200"><div class="text-3xl mb-2">&#128222;</div><h3 class="font-black">Pełne wsparcie</h3><p class="text-sm text-neutral-600 mt-1">Jesteśmy z Tobą także po wdrożeniu strony.</p></div>
</section>
<section id="kontakt" class="max-w-3xl mx-auto px-6 pb-24">
  <div class="rounded-3xl bg-neutral-900 text-white p-10 text-center">
    <h2 class="text-3xl font-black">Porozmawiajmy o Twojej stronie</h2>
    <p class="mt-3 text-neutral-300">Zadzwoń lub napisz — odpowiadamy tego samego dnia.</p>
    <a href="tel:+48000000000" class="inline-block mt-6 bg-lime-300 text-black px-8 py-3.5 rounded-full font-black">Zadzwoń teraz</a>
  </div>
</section>
<footer class="border-t py-8 text-center text-sm text-neutral-500">&copy; __YEAR__ __BN__ — Wszystkie prawa zastrzeżone.</footer>
</body>
</html>"""
    html = (html.replace("__BN__", bn).replace("__HEAD__", headline)
                .replace("__DESC__", desc).replace("__YEAR__", year))
    pkg = json.dumps({
        "name": "sitemorph-site",
        "private": True,
        "scripts": {
            "dev": "python -m http.server 8080 --directory frontend",
            "backend": "uvicorn main:app --app-dir backend --port 8000"
        }
    }, ensure_ascii=False, indent=2)
    readme = (
        "# " + title + "\n\n"
        "Strona wygenerowana przez SiteMorph AI.\n\n"
        "## Uruchomienie\n"
        "Otwórz `frontend/index.html` w przeglądarce albo:\n"
        "```\ncd main && python -m http.server 8080 --directory frontend\n```\n"
        "Backend (jeśli istnieje backend/main.py):\n"
        "```\nuvicorn main:app --app-dir backend --port 8000\n```"
    )
    return {
        "files": {
            "main/frontend/index.html": html,
            "main/package.json": pkg,
            "main/README.md": readme,
        },
        "meta": {
            "title": title,
            "headline": headline,
            "subheadline": (data.description[:120] if data.description else "Strona stworzona przez SiteMorph AI"),
            "ctaText": "Skontaktuj się"
        }
    }

@router.post("/generate")
def generate_site(data: BuilderInput):
    sections_str = ", ".join(data.sections or [])
    user_prompt = f"""Dane firmy / instrukcja od użytkownika:
---
BUSINESS_NAME: {data.business_name}
NICHE: {data.niche}
DESCRIPTION: {data.description}
STYLE: {data.style}
COLORS: {data.colors}
SECTIONS: {sections_str}
EXTRA: {data.extraPrompt or ''}
---

Wygeneruj stronę zgodnie z SYSTEM_PROMPT. Pamiętaj: Vite + React + Tailwind, polskie treści, premium design.
Jeśli w DESCRIPTION/EXTRA jest wklejony surowy tekst z Google Maps — wyciągnij z niego fakty i użyj ich na stronie.
NIE zadawaj pytań. Zwróć od razu kompletny JSON."""

    warning = None
    provider = "fallback"
    parsed_files = None
    parsed_meta = None

    # 1) Gemini (glowny provider)
    if GEMINI_API_KEY:
        text, err = gemini_generate(SYSTEM_PROMPT, user_prompt, max_tokens=60000)
        if text:
            try:
                parsed = extract_json(text)
                pfiles = parsed.get("files") or {}
                if any(k.endswith("index.html") for k in pfiles):
                    parsed_files = pfiles
                    parsed_meta = parsed.get("meta", {})
                    provider = "gemini"
                else:
                    warning = "Gemini nie zwrócił plików — próbuje zapasowego dostawcy"
            except Exception as e:
                warning = f"Gemini: nieparsowalna odpowiedź ({str(e)[:120]})"
        else:
            warning = f"Gemini niedostępny: {err}"

    # 2) OpenRouter (zapas)
    if parsed_files is None and OPENROUTER_API_KEY:
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
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.85,
                    "max_tokens": 8000,
                },
                timeout=90,
            )
            resp.raise_for_status()
            content_text = resp.json()["choices"][0]["message"]["content"]
            parsed = extract_json(content_text)
            ofiles = parsed.get("files") or {}
            if any(k.endswith("index.html") for k in ofiles):
                parsed_files = ofiles
                parsed_meta = parsed.get("meta", {})
                provider = "openrouter"
            elif warning is None:
                warning = "OpenRouter nie zwrócił plików"
        except Exception as e:
            if warning is None:
                warning = f"OpenRouter błąd: {str(e)[:150]}"

    # 3) Fallback lokalny
    fb = fallback_content(data)
    if parsed_files is None:
        parsed_files = fb["files"]
        parsed_meta = fb["meta"]
        provider = "fallback"
        if warning is None:
            warning = "Brak dostępnego dostawcy AI — pokazuję szablon awaryjny"

    meta = parsed_meta or fb["meta"]
    hero = {"title": meta.get("headline", data.business_name), "subtitle": meta.get("subheadline", data.description), "cta_text": meta.get("ctaText", "Kontakt")}
    return {"status": "success", "provider": provider, "warning": warning, "gemini_key_loaded": bool(GEMINI_API_KEY), "gemini_model": resolve_gemini_model(), "content": {"hero": hero, "services": [], "pricing": []}, "files": parsed_files, "meta": meta}
