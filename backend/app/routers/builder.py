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
    """Fallback when AI fails — generates a good-looking standalone HTML."""
    src = (data.extraPrompt or "") + " " + (data.description or "")
    def _extract(pattern, default=None):
        m = re.search(pattern, src, re.I | re.S)
        if not m:
            return default
        try:
            return (m.group(1) if m.lastindex else m.group(0)).strip()
        except IndexError:
            return m.group(0).strip()

    # Extract business name
    m2 = re.search(r'dla firmy\s*["„"]([^"""]+)[""""]', src, re.I)
    if m2 and len(m2.group(1).strip()) > 2 and "Branż" not in m2.group(1):
        bn = m2.group(1).strip()
    else:
        bn = data.business_name or "Twoja Firma"
        if bn.lower() in ("restauracja","kawiarnia","piekarnia","barber","salon","siłownia","warsztat"):
            extra_first = (data.extraPrompt or "").split("\n")[0][:60] if data.extraPrompt else ""
            if extra_first and len(extra_first) > 3:
                bn = extra_first

    # Extract address/phone
    parsed_addr = _extract(r'(?:ul\.?\s*)?[A-ZĄ-ź][a-zą-ź\s]+\s+\d+[a-z]?[/\s]*\d*-?\d*\s*[Łódź]')
    if not parsed_addr:
        parsed_addr = _extract(r'\d{2}-\d{3}\s+[A-ZĄ-ź][a-zą-ź]+')
    parsed_phone = _extract(r'(?:\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}')

    niche = data.niche or "Usługi lokalne"
    desc = data.description[:300] if data.description else f"{bn} — sprawdź naszą ofertę."
    headline = bn
    title = f"{bn} - {niche}"
    year = time.strftime("%Y")
    safe_bn = (bn or "Site").strip()[:30] or "Site"

    # Template colors
    try:
        tpl = pick_template(bn)
        accent = tpl.get("accent", "#2563eb")
    except:
        accent = "#2563eb"

    addr_display = parsed_addr or "Adres do uzupełnienia"
    phone_display = parsed_phone or "+48 000 000 000"

    # Niche-specific content
    niche_lower = (niche or "").lower()
    is_restaurant = any(k in niche_lower for k in ["restaurac", "gastronom", "bistro", "pizzeria", "bar ", "kebab", "kurczaki", "ziemniaki"])
    is_barber = any(k in niche_lower for k in ["barber", "fryzjer", "strzyż", "salon fryzj"])
    is_beauty = any(k in niche_lower for k in ["beauty", "kosmetolog", "salon urod", "spa", "manicure"])
    is_gym = any(k in niche_lower for k in ["siłowni", "fitness", "gym", "crossfit"])

    if is_restaurant:
        hero_img = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80"
        sections = """
        <section class="py-20 px-6"><div class="max-w-6xl mx-auto"><h2 class="reveal text-4xl md:text-5xl font-bold mb-12 text-center" style="font-family:'Instrument Serif',serif">Nasze menu</h2>
        <div class="reveal grid md:grid-cols-3 gap-6">
          <div class="bg-white rounded-2xl p-6 shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-gray-100"><div class="text-3xl mb-3">🍗</div><h3 class="text-lg font-bold mb-2">Kurczaki</h3><p class="text-gray-600 text-sm mb-3">Smażone, grillowane, w panierce — zawsze świeże i chrupkie.</p><span class="font-bold" style="color:${accent}">od 18 zł</span></div>
          <div class="bg-white rounded-2xl p-6 shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-gray-100"><div class="text-3xl mb-3">🥔</div><h3 class="text-lg font-bold mb-2">Ziemniaki</h3><p class="text-gray-600 text-sm mb-3">Pieczona, smażone, w varyingach — idealny dodatek do każdego dania.</p><span class="font-bold" style="color:${accent}">od 12 zł</span></div>
          <div class="bg-white rounded-2xl p-6 shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-gray-100"><div class="text-3xl mb-3">🥙</div><h3 class="text-lg font-bold mb-2">Kebab</h3><p class="text-gray-600 text-sm mb-3">Klasyczny, w bułce, na talerzu — z surówką i sosem.</p><span class="font-bold" style="color:${accent}">od 20 zł</span></div>
        </div></div></section>
        <section class="py-20 px-6 bg-gray-50"><div class="max-w-6xl mx-auto"><h2 class="reveal text-4xl md:text-5xl font-bold mb-12 text-center" style="font-family:'Instrument Serif',serif">Cennik</h2>
        <div class="reveal grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <div class="bg-white rounded-2xl p-5 flex justify-between items-center shadow-sm border border-gray-100"><span class="font-medium">Kurczak smażony + ziemniaki</span><span class="font-bold text-lg" style="color:${accent}">25 zł</span></div>
          <div class="bg-white rounded-2xl p-5 flex justify-between items-center shadow-sm border border-gray-100"><span class="font-medium">Kebab w bułce</span><span class="font-bold text-lg" style="color:${accent}">22 zł</span></div>
          <div class="bg-white rounded-2xl p-5 flex justify-between items-center shadow-sm border border-gray-100"><span class="font-medium">Kurczak grillowany + sałatka</span><span class="font-bold text-lg" style="color:${accent}">28 zł</span></div>
          <div class="bg-white rounded-2xl p-5 flex justify-between items-center shadow-sm border border-gray-100"><span class="font-medium">Zestaw rodzinny (4 os.)</span><span class="font-bold text-lg" style="color:${accent}">89 zł</span></div>
        </div></div></section>
        <section class="py-20 px-6"><div class="max-w-6xl mx-auto"><h2 class="reveal text-4xl md:text-5xl font-bold mb-12 text-center" style="font-family:'Instrument Serif',serif">Opinie klientów</h2>
        <div class="reveal grid md:grid-cols-3 gap-6">
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"><div class="flex items-center gap-1 text-yellow-400 mb-3">★★★★★</div><p class="text-gray-700 text-sm mb-4">"Najlepszy kebak w okolicy! Kurczaki soczyste, ziemniaki chrupkie. Polecam!"</p><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-sm" style="color:${accent}">MK</div><div><p class="font-bold text-sm">Marek K.</p><p class="text-xs text-gray-500">Lokalny przewodnik</p></div></div></div>
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"><div class="flex items-center gap-1 text-yellow-400 mb-3">★★★★★</div><p class="text-gray-700 text-sm mb-4">"Chodzę tu co tydzień. Porcje duże, ceny przystępne, obsługa miła."</p><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-sm" style="color:${accent}">AN</div><div><p class="font-bold text-sm">Anna N.</p><p class="text-xs text-gray-500">Stały klient</p></div></div></div>
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"><div class="flex items-center gap-1 text-yellow-400 mb-3">★★★★☆</div><p class="text-gray-700 text-sm mb-4">"Dobra lokalizacja, szybka obsługa. Kurczak zasmażany to_hit!"</p><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-bold text-sm" style="color:${accent}">JP</div><div><p class="font-bold text-sm">Jan P.</p><p class="text-xs text-gray-500">Google Reviews</p></div></div></div>
        </div></div></section>"""
    else:
        hero_img = "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80"
        sections = """
        <section class="py-20 px-6"><div class="max-w-6xl mx-auto"><h2 class="reveal text-4xl md:text-5xl font-bold mb-12 text-center" style="font-family:'Instrument Serif',serif">Co oferujemy</h2>
        <div class="reveal grid md:grid-cols-3 gap-6">
          <div class="bg-white rounded-2xl p-6 shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-gray-100"><div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl" style="background:${accent}15;color:${accent}">⚡</div><h3 class="text-lg font-bold mb-2">Szybko</h3><p class="text-gray-600 text-sm">Realizacja w 48h, poprawki bez dopłat.</p></div>
          <div class="bg-white rounded-2xl p-6 shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-gray-100"><div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl" style="background:${accent}15;color:${accent}">✨</div><h3 class="text-lg font-bold mb-2">Dopracowane</h3><p class="text-gray-600 text-sm">Każdy detal przemyślany i dopieszczony.</p></div>
          <div class="bg-white rounded-2xl p-6 shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-gray-100"><div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl" style="background:${accent}15;color:${accent}">🤝</div><h3 class="text-lg font-bold mb-2">Wsparcie</h3><p class="text-gray-600 text-sm">Jesteśmy obok — kontakt direct, aktualizacje w cenie.</p></div>
        </div></div></section>
        <section class="py-20 px-6 bg-gray-50"><div class="max-w-6xl mx-auto"><h2 class="reveal text-4xl md:text-5xl font-bold mb-12 text-center" style="font-family:'Instrument Serif',serif">Cennik</h2>
        <div class="reveal max-w-2xl mx-auto space-y-4">
          <div class="bg-white rounded-2xl p-5 flex justify-between items-center shadow-sm border border-gray-100"><span class="font-medium">Podstawowy pakiet</span><span class="font-bold text-lg" style="color:${accent}">od 500 zł</span></div>
          <div class="bg-white rounded-2xl p-5 flex justify-between items-center shadow-sm border border-gray-100"><span class="font-medium">Rozbudowany pakiet</span><span class="font-bold text-lg" style="color:${accent}">od 1200 zł</span></div>
          <div class="bg-white rounded-2xl p-5 flex justify-between items-center shadow-sm border border-gray-100"><span class="font-medium">Premium pakiet</span><span class="font-bold text-lg" style="color:${accent}">od 2500 zł</span></div>
        </div></div></section>
        <section class="py-20 px-6"><div class="max-w-6xl mx-auto"><h2 class="reveal text-4xl md:text-5xl font-bold mb-12 text-center" style="font-family:'Instrument Serif',serif">Opinie</h2>
        <div class="reveal grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"><div class="flex items-center gap-1 text-yellow-400 mb-3">★★★★★</div><p class="text-gray-700 text-sm mb-4">"Profesjonalne podejście i szybka realizacja. Polecam!"</p><p class="font-bold text-sm">— Klient</p></div>
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"><div class="flex items-center gap-1 text-yellow-400 mb-3">★★★★★</div><p class="text-gray-700 text-sm mb-4">"Współpraca na najwyższym poziomie. Na pewno wrócę."</p><p class="font-bold text-sm">— Klient</p></div>
        </div></div></section>"""

    # Build the full standalone HTML
    preview_html = f'''<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={{theme:{{extend:{{fontFamily:{{serif:["Instrument Serif","serif"],sans:["Inter","sans-serif"]}}}}}}}}</script>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; scroll-behavior:smooth; }}
body {{ font-family:'Inter',sans-serif; background:#fff; color:#1a1a1a; }}
.reveal {{ opacity:0; transform:translateY(30px); transition:all 0.6s cubic-bezier(0.16,1,0.3,1); }}
.reveal.visible {{ opacity:1; transform:translateY(0); }}
.hero-gradient {{ background:linear-gradient(135deg, {accent}08 0%, {accent}15 50%, {accent}05 100%); }}
@keyframes float {{ 0%,100%{{transform:translateY(0)}} 50%{{transform:translateY(-12px)}} }}
.float {{ animation:float 6s ease-in-out infinite; }}
</style>
</head>
<body>

<!-- HEADER -->
<header class="fixed top-0 w-full bg-white/80 backdrop-blur-xl z-50 border-b border-gray-100">
  <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
    <div class="flex items-center gap-2.5">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm" style="background:{accent}">{safe_bn[0]}</div>
      <span class="font-semibold text-base">{safe_bn}</span>
    </div>
    <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
      <a href="#oferta" class="hover:text-gray-900 transition-colors">Oferta</a>
      <a href="#cennik" class="hover:text-gray-900 transition-colors">Cennik</a>
      <a href="#opinie" class="hover:text-gray-900 transition-colors">Opinie</a>
      <a href="#kontakt" class="hover:text-gray-900 transition-colors">Kontakt</a>
    </nav>
    <a href="tel:{phone_display}" class="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:scale-105" style="background:{accent}">Zadzwoń</a>
  </div>
</header>

<!-- HERO -->
<section class="hero-gradient min-h-screen flex items-center pt-16">
  <div class="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
    <div class="reveal">
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-gray-100 text-xs font-semibold mb-6">
        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        {niche} · {addr_display}
      </div>
      <h1 class="text-5xl md:text-7xl font-bold leading-[0.95] mb-6" style="font-family:'Instrument Serif',serif;letter-spacing:-0.02em">{headline}</h1>
      <p class="text-lg text-gray-600 mb-8 max-w-lg leading-relaxed">{desc}</p>
      <div class="flex flex-wrap gap-4">
        <a href="#kontakt" class="px-8 py-4 rounded-xl text-white font-semibold text-sm transition-all hover:scale-105 hover:shadow-lg" style="background:{accent}">Skontaktuj się</a>
        <a href="#oferta" class="px-8 py-4 rounded-xl border-2 border-gray-200 font-semibold text-sm transition-all hover:border-gray-400 hover:bg-gray-50">Zobacz ofertę</a>
      </div>
      <div class="flex items-center gap-4 mt-8">
        <div class="flex -space-x-2">
          <div class="w-8 h-8 rounded-full bg-yellow-400 border-2 border-white flex items-center justify-center text-xs text-white">★</div>
          <div class="w-8 h-8 rounded-full bg-gray-800 border-2 border-white flex items-center justify-center text-xs text-white">4.5</div>
        </div>
        <span class="text-sm text-gray-600"><strong>4.5</strong> na Google · 196 opinii</span>
      </div>
    </div>
    <div class="reveal float">
      <div class="rounded-3xl overflow-hidden shadow-2xl">
        <img src="{hero_img}" alt="{safe_bn}" class="w-full h-[400px] object-cover">
        <div class="p-4 bg-white flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500 font-medium">{addr_display}</p>
            <p class="text-sm font-bold mt-1">{phone_display}</p>
          </div>
          <span class="px-4 py-2 rounded-full bg-green-500 text-white text-xs font-bold">Otwarte</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- OFERTA -->
{sections}

<!-- KONTAKT -->
<section id="kontakt" class="py-20 px-6">
  <div class="max-w-6xl mx-auto">
    <h2 class="reveal text-4xl md:text-5xl font-bold mb-12 text-center" style="font-family:'Instrument Serif',serif">Skontaktuj się</h2>
    <div class="reveal grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      <div class="bg-gray-900 text-white rounded-3xl p-8">
        <h3 class="text-2xl font-bold mb-4">Napisz do nas</h3>
        <p class="text-gray-400 mb-6 text-sm">{addr_display}</p>
        <a href="tel:{phone_display}" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm transition-all hover:scale-105">📞 Zadzwoń: {phone_display}</a>
        <div class="mt-6 pt-6 border-t border-gray-700">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Godziny otwarcia</p>
          <p class="text-sm">Pon-Sob: 10:00 - 22:00</p>
          <p class="text-sm text-gray-400">Niedziela: 12:00 - 20:00</p>
        </div>
      </div>
      <div class="bg-gray-50 rounded-3xl p-8">
        <form class="space-y-4">
          <input type="text" placeholder="Twoje imię" class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0" style="focus:ring-color:{accent}">
          <input type="email" placeholder="Email" class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0">
          <input type="tel" placeholder="Telefon" class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0">
          <textarea rows="4" placeholder="Wiadomość..." class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-offset-0"></textarea>
          <button type="submit" class="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:scale-[1.02] hover:shadow-lg" style="background:{accent}">Wyślij wiadomość</button>
        </form>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer class="border-t border-gray-100 py-8 px-6">
  <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
    <p class="text-sm text-gray-500">© {year} {safe_bn}. Wszelkie prawa zastrzeżone.</p>
    <div class="flex items-center gap-6 text-sm text-gray-500">
      <a href="#oferta" class="hover:text-gray-900 transition-colors">Oferta</a>
      <a href="#cennik" class="hover:text-gray-900 transition-colors">Cennik</a>
      <a href="#kontakt" class="hover:text-gray-900 transition-colors">Kontakt</a>
    </div>
  </div>
</footer>

<script>
const observer = new IntersectionObserver((entries) => {{
  entries.forEach(e => {{ if(e.isIntersecting) {{ e.target.classList.add('visible'); observer.unobserve(e.target); }} }});
}}, {{threshold: 0.1}});
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
</script>
</body>
</html>'''

    return {
        "files": {
            "main/frontend/preview.html": preview_html,
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
                if any(k.endswith(("index.html", "App.tsx", "main.tsx")) for k in ofiles):
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
                    if any(k.endswith(("index.html", "App.tsx", "main.tsx")) for k in pfiles):
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



