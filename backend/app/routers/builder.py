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


SYSTEM_PROMPT = """Jesteś SiteMorph AI — generator premium stron dla lokalnych firm.

ZADANIE: Wygeneruj JEDEN plik HTML (standalone, z Tailwind CDN) dla podanej firmy.
To jest strona podglądu — musi wyglądać GOTOWO i PIĘKNIE jak profesjonalna strona.

FORMAT ODPOWIEDZI — TYLKO POPRAWNY JSON, zero markdown:
{
  "files": {
    "main/frontend/preview.html": "TUTAJ PEŁNY KOD HTML"
  },
  "meta": {
    "title": "Nazwa Firmy — tytuł SEO",
    "headline": "Główny nagłówek hero",
    "subheadline": "Podtytuł hero",
    "ctaText": "Tekst CTA"
  }
}

KLUCZOWE ZASADY DLA preview.html:

1. JEDEN PLIK HTML z wbudowanym <style> i Tailwind CDN + Google Fonts (Inter + Instrument Serif).
   Absolutnie MINIMUM 200 linii kodu HTML. Nie skracaj. Pełna strona.

2. STRUKTURA strony (kolejność sekcji):
   - Sticky header z logo firmy, nawigacją i przyciskiem CTA
   - Hero: DUŻY nagłówek (Instrument Serif, 56-80px), podtytuł,2 przyciski CTA, zdjęcie z Unsplash
   - Oferta: 3-6 kart z usługami (ikony Lucide lub emoji, nagłówki, opisy)
   - Cennik: tabela lub karty z cenami (jeśli podano ceny w danych)
   - Opinie: 2-3 opinie klientów z imionami i gwiazdkami
   - Kontakt: adres, telefon (klikalny tel:), mapa, formularz kontaktowy
   - Stopka:© rok, nazwa firmy, linki

3. ANIMACJE (wbudowane w <style>):
   - Scroll reveal: elements start opacity:0 + translateY(30px), animate to visible on scroll
   - Hover na kartach: translateY(-6px) + shadow
   - Hover na przyciskach: scale(1.02) + ciemniejszy kolor
   - Płynne scrollowanie (smooth scroll)
   - Gradient animations w hero (subtelne)
   Użyj IntersectionObserver w <script> do scroll reveal

4. TYPOGRAFIA:
   - Nagłówki: font-family: 'Instrument Serif', serif (lub 'Playfair Display')
   - Body: font-family: 'Inter', sans-serif
   - H1: 56-80px, letter-spacing: -0.02em, line-height: 0.95
   - H2: 36-48px, letter-spacing: -0.01em

5. KOLORY i DESIGN:
   - Jeśli podano kolory → użyj ich jako accent
   - Jeśli nie → niebieski #2563eb jako główny akcent
   - Białe tło, dużo przestrzeni, rounded-2xl na kartach
   - Gradient w hero (np. accent→white)
   - Cienie: 0 4px 24px rgba(0,0,0,0.08)

6. ZDJĘCIA: Unsplash src z konkretnymi frazami branżowymi:
   - Restauracja: "cozy restaurant interior", "gourmet food plating"
   - Barber: "barber shop interior", "men haircut"
   - Kwiaciarnia: "flower shop interior", "bouquet"
   - Itd. — dobieraj pod branżę

7. DANE KLIENTA: Wyciągnij WSZYSTKO z opisu:
   - Nazwa firmy → header, hero, footer
   - Telefon → klikalny tel: w hero i kontakcie
   - Adres → sekcja kontakt
   - Godziny → sekcja kontakt
   - Ceny → cennik
   - Opinie → sekcja opinie
   - Menu/oferty → sekcja oferta
   - Ocena → badge social proof w hero

8. RESPONSYWNOŚĆ: mobile-first. Na mobile: stacked layout, smaller fonts, full-width cards.

9. MINIMALNA DŁUGOŚĆ: preview.html MUSI mieć MINIMUM 200 linii kodu. Nie rób "placeholderów".
   Każda sekcja musi mieć REALNĄ treść (nazwa firmy, konkretne usługi, ceny, adres, telefon).

10. JĘZYK: po polsku. Pisz jak człowiek, nie jak marketingowiec.
    ZAKAZ: "profesjonalny", "kompleksowy", "innowacyjny", "premium", "ekspert", "lider"
    ZAMIAST: konkretne opisy, lata doświadczenia, nazwy ulic, imiona klientów

11. NIGDY nie zadawaj pytań. Nie pisz "...". Nie skracaj. Pełny kod HTML.

12. SCROLL REVEAL IMPLEMENTACJA — dodaj w <script>:
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }});
    }, {threshold: 0.1});
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    W <style>: .reveal { opacity: 0; transform: translateY(30px); transition: all 0.6s cubic-bezier(0.16,1,0.3,1); }
    .reveal.visible { opacity: 1; transform: translateY(0); }
"""


def fallback_content(data: BuilderInput):
    """Fallback — rich standalone HTML with SVG icons, varied layouts, always has form."""
    src = (data.extraPrompt or "") + " " + (data.description or "")
    def _extract(pattern, default=None):
        m = re.search(pattern, src, re.I | re.S)
        if not m: return default
        try: return (m.group(1) if m.lastindex else m.group(0)).strip()
        except: return m.group(0).strip()

    m2 = re.search(r'dla firmy\s*["„"]([^"""]+)[""""]', src, re.I)
    if m2 and len(m2.group(1).strip()) > 2 and "Branż" not in m2.group(1):
        bn = m2.group(1).strip()
    else:
        bn = data.business_name or "Twoja Firma"
        if bn.lower() in ("restauracja","kawiarnia","piekarnia","barber","salon","siłownia","warsztat"):
            ef = (data.extraPrompt or "").split("\n")[0][:60] if data.extraPrompt else ""
            if ef and len(ef) > 3: bn = ef

    parsed_addr = _extract(r'(?:ul\.?\s*)?[A-ZĄ-ź][a-zą-ź\s]+\s+\d+[a-z]?[/\s]*\d*-?\d*\s*[Łódź]')
    if not parsed_addr: parsed_addr = _extract(r'\d{2}-\d{3}\s+[A-ZĄ-ź][a-zą-ź]+')
    parsed_phone = _extract(r'(?:\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}')
    rating_m = re.search(r'(\d[,\.]\d)\s*\((\d+)\)', src)
    rating = rating_m.group(1).replace(',','.') if rating_m else "4.8"
    reviews = rating_m.group(2) if rating_m else "127"
    niche = data.niche or "Usługi lokalne"
    desc = data.description[:300] if data.description else f"{bn} — sprawdź naszą ofertę."
    title = f"{bn} - {niche}"
    year = time.strftime("%Y")
    safe = (bn or "Site").strip()[:30] or "Site"
    addr = parsed_addr or "Adres do uzupełnienia"
    phone = parsed_phone or "+48 000 000 000"
    accent = "#2563eb"

    niche_l = (niche or "").lower()
    is_rest = any(k in niche_l for k in ["restaurac","kebab","kurczaki","ziemniaki","jedzenie","food","pizzeria","bistro"])
    is_barber = any(k in niche_l for k in ["barber","fryzjer","strzyż","salon fryzj"])
    is_beauty = any(k in niche_l for k in ["beauty","kosmetolog","salon urod","spa","manicure","paznokci"])
    is_gym = any(k in niche_l for k in ["siłowni","fitness","gym","crossfit"])

    # SVG icon helpers (inline, no external deps)
    ICONS = {
        "utensils": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
        "scissors": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>',
        "star": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
        "phone": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
        "map_pin": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
        "clock": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        "send": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
        "arrow_right": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
        "dumbbell": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>',
        "sparkles": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
        "heart": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
        "zap": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        "shield": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
        "flame": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
        "smile": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>',
    }

    if is_rest:
        hero_img = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80"
        food1 = "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80"
        food2 = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80"
        food3 = "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80"
        icon1, icon2, icon3 = ICONS["utensils"], ICONS["flame"], ICONS["star"]
        svc = [
            ("Kurczaki", "Smażone, grillowane, w panierce — zawsze świeże i chrupkie.", "od 18 zł", food1, "Bestseller"),
            ("Ziemniaki", "Pieczona, smażone, w varyingach — idealny dodatek.", "od 12 zł", food2, "Popularne"),
            ("Kebab", "Klasyczny, w bułce, na talerzu — z surówką i sosem.", "od 20 zł", food3, "Polecamy"),
        ]
        prices = [("Kurczak + ziemniaki", "25 zł"), ("Kebab w bułce", "22 zł"), ("Kurczak grillowany + sałatka", "28 zł"), ("Zestaw rodzinny (4 os.)", "89 zł"), ("Ziemniaki pieczone + sos", "15 zł"), ("Napój / Surówka", "5-8 zł")]
    elif is_barber:
        hero_img = "https://images.unsplash.com/photo-1585747860019-024afab6236e?w=1200&q=80"
        food1 = "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&q=80"
        food2 = "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&q=80"
        food3 = "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80"
        icon1, icon2, icon3 = ICONS["scissors"], ICONS["sparkles"], ICONS["star"]
        svc = [
            ("Strzyżenie", "Klasyczne i nowoczesne fryzury. Doradztwo w cenie.", "od 50 zł", food1, "45 min"),
            ("Golenie brody", "Golenie brzytwą, balsam, ręcznik gorący. Pełny rytuał.", "od 40 zł", food2, "30 min"),
            ("Pakiet complete", "Strzyżenie + golenie + stylizacja. Wyjdziesz jak nowy.", "od 80 zł", food3, "75 min"),
        ]
        prices = [("Strzyżenie męskie", "50 zł"), ("Golenie brody brzytwą", "40 zł"), ("Strzyżenie + golenie", "80 zł"), ("Trymowanie brody", "30 zł")]
    else:
        hero_img = "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80"
        food1 = "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80"
        food2 = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80"
        food3 = "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&q=80"
        icon1, icon2, icon3 = ICONS["zap"], ICONS["sparkles"], ICONS["shield"]
        svc = [
            ("Szybka realizacja", "Projekt gotowy w 48h. Poprawki bez dopłat.", "od 500 zł", food1, "48h"),
            ("Kompleksowa obsługa", "Od pomysłu do gotowego produktu. Jeden kontakt.", "od 1 200 zł", food2, "1 tydzień"),
            ("Premium pakiet", "Wszystko + wsparcie techniczne przez rok.", "od 2 500 zł", food3, "2 tygodnie"),
        ]
        prices = [("Pakiet podstawowy", "500 zł"), ("Pakiet rozbudowany", "1 200 zł"), ("Pakiet premium", "2 500 zł"), ("Konsultacja (1h)", "150 zł")]

    svc_cards = ""
    for i, (nm, ds, pr, img, tag) in enumerate(svc):
        ic = [icon1, icon2, icon3][i]
        svc_cards += f'''<div class="group relative bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100">
        <div class="h-52 overflow-hidden relative"><img src="{img}" alt="{nm}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"><div class="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur text-xs font-bold shadow">{tag}</div></div>
        <div class="p-6"><div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-2xl flex items-center justify-center" style="background:{accent}15;color:{accent}">{ic}</div><h3 class="text-xl font-bold">{nm}</h3></div>
        <p class="text-gray-500 text-sm mb-4 leading-relaxed">{ds}</p>
        <div class="flex items-center justify-between"><span class="font-bold text-lg" style="color:{accent}">{pr}</span><a href="#kontakt" class="text-xs font-semibold flex items-center gap-1 hover:gap-2 transition-all" style="color:{accent}">Zamów {ICONS["arrow_right"][:50]}</a></div></div></div>'''

    price_rows = ""
    for nm, pr in prices:
        price_rows += f'<div class="bg-white rounded-2xl p-5 flex justify-between items-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow"><span class="font-medium text-gray-700">{nm}</span><span class="font-bold text-lg" style="color:{accent}">{pr}</span></div>'

    reviews_html = ""
    names = [("Marek K.", "MK", "#10b981"), ("Anna N.", "AN", accent), ("Jan P.", "JP", "#8b5cf6")]
    texts = [
        '"Najlepsze w okolicy! Jedzenie świeże, porcje duże, obsługa super. Polecam każdemu!"',
        '"Chodzę tu co tydzień. Ceny przystępne, jakość zawsze na najwyższym poziomie."',
        '"Szybko, smacznie i w dobrej cenie. Jedyny minus — brakuje miejsc w piątek!"'
    ]
    stars = ["★★★★★", "★★★★★", "★★★★☆"]
    for i, ((nm, ini, cl), txt, st) in enumerate(zip(names, texts, stars)):
        reviews_html += f'''<div class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
        <div class="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-5" style="background:{accent}"></div>
        <div class="flex items-center gap-1 text-yellow-400 text-lg mb-4">{st}</div>
        <p class="text-gray-700 text-sm leading-relaxed mb-6 italic">{txt}</p>
        <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md" style="background:linear-gradient(135deg,{cl},{cl}cc)">{ini}</div>
        <div><p class="font-bold text-sm">{nm}</p><p class="text-xs text-gray-400">Google Reviews</p></div></div></div>'''

    # Rating badge HTML
    stars_html = '<div class="flex items-center gap-1 text-yellow-400">' + ICONS["star"] + f'</div><span class="font-bold">{rating}</span><span class="text-gray-400 text-sm">· {reviews} opinii</span>'

    html = f'''<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={{theme:{{extend:{{fontFamily:{{display:["Playfair Display","serif"],sans:["Inter","sans-serif"]}}}}}}}}</script>
<style>
*{{margin:0;padding:0;box-sizing:border-box;scroll-behavior:smooth}}
body{{font-family:'Inter',sans-serif;background:#fafafa;color:#1a1a1a;overflow-x:hidden}}
.reveal{{opacity:0;transform:translateY(40px);transition:all 0.7s cubic-bezier(0.16,1,0.3,1)}}
.reveal.visible{{opacity:1;transform:translateY(0)}}
.reveal-d1{{transition-delay:0.1s}}.reveal-d2{{transition-delay:0.2s}}.reveal-d3{{transition-delay:0.3s}}
@keyframes gradient-shift{{0%,100%{{background-position:0% 50%}}50%{{background-position:100% 50%}}}}
.hero-grad{{background:linear-gradient(135deg,{accent}10 0%,{accent}20 30%,{accent}08 60%,{accent}18 100%);background-size:400% 400%;animation:gradient-shift 12s ease infinite}}
.glass{{background:rgba(255,255,255,0.8);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}}
</style>
</head>
<body>
<header class="fixed top-0 w-full glass z-50 border-b border-white/20">
<div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
<div class="flex items-center gap-3">
<div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-lg" style="background:linear-gradient(135deg,{accent},{accent}aa)">{safe[0:2]}</div>
<span class="font-bold text-base">{safe}</span></div>
<nav class="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
<a href="#oferta" class="hover:text-gray-900 transition-colors">Oferta</a>
<a href="#cennik" class="hover:text-gray-900 transition-colors">Cennik</a>
<a href="#opinie" class="hover:text-gray-900 transition-colors">Opinie</a>
<a href="#kontakt" class="hover:text-gray-900 transition-colors">Kontakt</a></nav>
<a href="tel:{phone}" class="px-6 py-2.5 rounded-2xl text-white text-sm font-semibold transition-all hover:scale-105 shadow-lg flex items-center gap-2" style="background:linear-gradient(135deg,{accent},{accent}aa)">{ICONS["phone"][:80]} Zadzwoń</a>
</div></header>

<section class="hero-grad min-h-screen flex items-center relative overflow-hidden">
<div class="absolute top-10 right-20 w-96 h-96 rounded-full blur-3xl opacity-10" style="background:{accent}"></div>
<div class="absolute bottom-10 left-10 w-72 h-72 rounded-full blur-3xl opacity-5" style="background:{accent}"></div>
<div class="max-w-7xl mx-auto px-6 py-32 grid md:grid-cols-2 gap-16 items-center relative z-10">
<div class="reveal">
<div class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur shadow-sm border border-white/50 text-xs font-semibold mb-8">
<span class="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
<span style="color:{accent}">{niche}</span>
<span class="text-gray-300">·</span><span>{addr}</span></div>
<h1 class="text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.9] mb-8" style="font-family:'Playfair Display',serif;letter-spacing:-0.03em">{bn}</h1>
<p class="text-lg md:text-xl text-gray-600 mb-10 max-w-lg leading-relaxed">{desc}</p>
<div class="flex flex-wrap gap-4 mb-10">
<a href="#kontakt" class="px-8 py-4 rounded-2xl text-white font-semibold text-base transition-all hover:scale-105 hover:shadow-xl shadow-lg flex items-center gap-2" style="background:linear-gradient(135deg,{accent},{accent}aa)">Skontaktuj się {ICONS["arrow_right"][:60]}</a>
<a href="#oferta" class="px-8 py-4 rounded-2xl border-2 border-gray-200 font-semibold text-base transition-all hover:border-gray-400 hover:bg-white/50">Zobacz ofertę</a></div>
<div class="flex items-center gap-5">
<div class="flex items-center gap-1 text-yellow-400">{ICONS["star"]}</div>
<div class="flex items-center gap-2">{stars_html}</div></div></div>
<div class="reveal reveal-d2 relative">
<div class="absolute -inset-4 rounded-3xl opacity-20 blur-xl" style="background:linear-gradient(135deg,{accent}40,transparent)"></div>
<div class="relative rounded-3xl overflow-hidden shadow-2xl group">
<img src="{hero_img}" alt="{safe}" class="w-full h-[420px] md:h-[480px] object-cover group-hover:scale-105 transition-transform duration-700">
<div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
<div class="flex items-center justify-between">
<div><p class="text-white/80 text-xs font-medium">{addr}</p><p class="text-white font-bold mt-1 flex items-center gap-2">{ICONS["phone"][:50]} {phone}</p></div>
<span class="px-4 py-2 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg">Otwarte</span>
</div></div></div></div></div></section>

<section id="oferta" class="py-24 px-6 bg-white">
<div class="max-w-7xl mx-auto">
<div class="text-center mb-16 reveal"><p class="text-xs uppercase tracking-[0.2em] font-bold mb-4" style="color:{accent}">Nasza oferta</p>
<h2 class="text-4xl md:text-6xl font-bold" style="font-family:'Playfair Display',serif;letter-spacing:-0.02em">Co mamy dla Ciebie</h2></div>
<div class="reveal grid md:grid-cols-3 gap-8">{svc_cards}</div></div></section>

<section id="cennik" class="py-24 px-6" style="background:linear-gradient(180deg,#f8fafc,#fff)">
<div class="max-w-7xl mx-auto">
<div class="text-center mb-16 reveal"><p class="text-xs uppercase tracking-[0.2em] font-bold mb-4" style="color:{accent}">Cennik</p>
<h2 class="text-4xl md:text-6xl font-bold" style="font-family:'Playfair Display',serif;letter-spacing:-0.02em">Ile to kosztuje</h2></div>
<div class="reveal max-w-2xl mx-auto space-y-3">{price_rows}</div></div></section>

<section id="opinie" class="py-24 px-6 bg-white">
<div class="max-w-7xl mx-auto">
<div class="text-center mb-16 reveal"><p class="text-xs uppercase tracking-[0.2em] font-bold mb-4" style="color:{accent}">Opinie</p>
<h2 class="text-4xl md:text-6xl font-bold" style="font-family:'Playfair Display',serif;letter-spacing:-0.02em">Co mówią klienci</h2></div>
<div class="reveal grid md:grid-cols-3 gap-8">{reviews_html}</div></div></section>

<section id="kontakt" class="py-24 px-6" style="background:linear-gradient(180deg,#f8fafc,#fff)">
<div class="max-w-7xl mx-auto">
<div class="text-center mb-16 reveal"><p class="text-xs uppercase tracking-[0.2em] font-bold mb-4" style="color:{accent}">Kontakt</p>
<h2 class="text-4xl md:text-6xl font-bold" style="font-family:'Playfair Display',serif;letter-spacing:-0.02em">Porozmawiajmy</h2></div>
<div class="reveal grid md:grid-cols-2 gap-10 max-w-5xl mx-auto">
<div class="rounded-3xl p-10 text-white relative overflow-hidden" style="background:linear-gradient(135deg,#111,#333)">
<div class="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-30" style="background:{accent}"></div>
<h3 class="text-2xl font-bold mb-6 relative z-10">Dane kontaktowe</h3>
<div class="space-y-5 relative z-10">
<div class="flex items-start gap-4"><div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:{accent}30">{ICONS["map_pin"][:70]}</div><div><p class="font-medium">{addr}</p><p class="text-white/50 text-sm mt-1">Dojazd: mapa poniżej</p></div></div>
<div class="flex items-start gap-4"><div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:{accent}30">{ICONS["phone"][:70]}</div><div><a href="tel:{phone}" class="font-medium hover:underline">{phone}</a><p class="text-white/50 text-sm mt-1">Zadzwoń — odbierzemy</p></div></div>
<div class="flex items-start gap-4"><div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:{accent}30">{ICONS["clock"][:70]}</div><div><p class="font-medium">Pon-Sob: 10:00 - 22:00</p><p class="text-white/50 text-sm mt-1">Niedziela: 12:00 - 20:00</p></div></div>
</div></div>
<div class="bg-white rounded-3xl p-10 shadow-lg border border-gray-100">
<h3 class="text-xl font-bold mb-6">Napisz do nas</h3>
<form class="space-y-4">
<input type="text" placeholder="Twoje imię" class="w-full px-5 py-3.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all" style="--tw-ring-color:{accent}">
<input type="email" placeholder="Email" class="w-full px-5 py-3.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all" style="--tw-ring-color:{accent}">
<input type="tel" placeholder="Telefon" class="w-full px-5 py-3.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all" style="--tw-ring-color:{accent}">
<textarea rows="4" placeholder="Jak możemy pomóc?" class="w-full px-5 py-3.5 rounded-2xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all" style="--tw-ring-color:{accent}"></textarea>
<button type="submit" class="w-full py-4 rounded-2xl text-white font-semibold text-sm transition-all hover:scale-[1.02] hover:shadow-xl shadow-lg flex items-center justify-center gap-2" style="background:linear-gradient(135deg,{accent},{accent}aa)">Wyślij wiadomość {ICONS["send"][:50]}</button>
</form></div></div></div></div></section>

<footer class="border-t border-gray-100 py-10 px-6 bg-white">
<div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
<div class="flex items-center gap-3"><div class="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs" style="background:linear-gradient(135deg,{accent},{accent}aa)">{safe[0]}</div><span class="font-semibold text-sm">{safe}</span></div>
<p class="text-sm text-gray-400">© {year} {safe}. Wszelkie prawa zastrzeżone.</p>
<div class="flex items-center gap-6 text-sm text-gray-500">
<a href="#oferta" class="hover:text-gray-900 transition-colors">Oferta</a>
<a href="#cennik" class="hover:text-gray-900 transition-colors">Cennik</a>
<a href="#kontakt" class="hover:text-gray-900 transition-colors">Kontakt</a></div></div></footer>

<script>
const o=new IntersectionObserver(e=>{{e.forEach(x=>{{if(x.isIntersecting){{x.target.classList.add('visible');o.unobserve(x.target)}}}})}},{{threshold:.1}});
document.querySelectorAll('.reveal').forEach(el=>o.observe(el));
</script>
</body></html>'''

    return {"files": {"main/frontend/preview.html": html}, "meta": {"title": title, "headline": bn, "subheadline": desc[:120], "ctaText": "Skontaktuj się"}}

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
                        if len(ph) < 5000:
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
                            if len(ph) < 5000:
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



