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

0. TWÓJ GŁÓWNY OBOWIĄZEK: WYMYŚL KREATYWNE, UNIKALNE TEKSTY! 
   - KAŻDA strona musi mieć INNY headline, INNE opisy, INNE teksty CTA
   - NIE używaj fraz typu "Profesjonalne usługi" "Kompleksowe rozwiązania" "Najlepsza jakość"
   - ZAMIAST tego: chwytliwe, konkretne, emocjonalne teksty pasujące do branży
   - Przykłady dobrych headline: "Jemy piątki w trzy minuty" (kebab), "Twoja broda zasługuje na mistrza" (barber), "Tu się nie czeka — tu się żyje" (restauracja)
   - Podtytuł: konkretny benefit, nie buzzword. Np. "30 lat doświadczenia w jednym kęsie" a nie "Najwyższa jakość"
   - Opisy usług: opisz CO klient dostaje, nie CO oferujesz. "Soczysty kurczak z frytkami i surówką" a nie "Oferujemy usługi gastronomiczne"
   - CTA: "Zamów teraz" "Rezerwuj stolik" "Zadzwoń — odbierzemy" zamiast "Skontaktuj się"

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
    """Fallback — EVERYTHING from random pools. Zero hardcoded content."""
    import random

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

    # Dynamic accent color
    accents = ["#2563eb","#111827","#d97706","#059669","#7c3aed","#dc2626","#0891b2","#c026d3"]
    accent = random.choice(accents)

    # Dynamic hero background
    hero_bgs = [
        f"background:{accent}08",
        f"background:linear-gradient(135deg,{accent}06,white,{accent}04)",
        f"background:white",
    ]
    hero_bg = random.choice(hero_bgs)

    # Dynamic animation style
    anim_styles = [
        "@keyframes morph{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}50%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}} .morph{animation:morph 8s ease-in-out infinite}",
        "@keyframes pulse-glow{0%,100%{box-shadow:0 0 0 0 "+accent+"40}50%{box-shadow:0 0 20px 4px "+accent+"20}} .pulse-glow{animation:pulse-glow 3s ease-in-out infinite}",
        "@keyframes slide-up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}} .slide-up{animation:slide-up .8s ease forwards}",
    ]
    anim_css = random.choice(anim_styles)

    # Dynamic layout style
    layouts = ["split","centered","full"]
    layout = random.choice(layouts)

    niche_l = (niche or "").lower()
    is_rest = any(k in niche_l for k in ["restaurac","kebab","kurczaki","ziemniaki","jedzenie","food","pizzeria","bistro","kawiarni","cafe"])
    is_barber = any(k in niche_l for k in ["barber","fryzjer","strzyż","salon fryzj"])
    is_beauty = any(k in niche_l for k in ["beauty","kosmetolog","salon urod","spa","manicure","paznokci"])

    # ===== POOLS OF CONTENT =====
    if is_rest:
        hero_imgs = ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80","https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80","https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80","https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&q=80"]
        food_imgs = ["https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80","https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80","https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80","https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&q=80","https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=600&q=80"]
        svc_pool = [
            ("Danie dnia","Świeże, sezonowe składniki. Zmienia się codziennie — zawsze jest w czym wybierać.","od 18 zł","utensils"),
            ("Kurczaki","Smażone na złoto, z surówką i pieczywem. Porcja, po której nie wstaniesz od stołu.","od 16 zł","flame"),
            ("Kebab","Klasyczny, w bułce lub na talerzu. Trzy sosy do wyboru — każdy inny, każdy dobry.","od 22 zł","star"),
            ("Zestaw rodzinny","Cztery dania, surówki, napoje. Rodzinny obiad bez gotowania — w cenę wliczony spokój.","od 79 zł","heart"),
            ("Desery","Domowe ciasta i lody. Słodkie zakończenie, które zapamiętasz.","od 12 zł","sparkles"),
        ]
        price_pool = [("Danie dnia","18-22 zł"),("Kebab w bułce","22 zł"),("Kurczak + frytki","25 zł"),("Zestaw rodzinny","79-99 zł"),("Surówka","5-8 zł"),("Napój","4-6 zł"),("Deser","12-18 zł")]
        headline_pool = ["Jedzenie, do którego się wraca","Smak, który zapamiętasz","Tu się je inaczej","Prawdziwy smak, prawdziwe ceny","Gdzie apetyt rośnie z każdym kęsem","Stawiamy na smak, nie na marketing"]
        sub_pool = ["Od 15 lat karmimy mieszkańców. Duże porcje, ceny bez niespodzianek.","Świeże składniki codziennie. Zero mrożonek. Przyjdź i sprawdź.","Duże porcje w cenach, które nie przerażają. Rodzina znajdzie tu coś dla siebie.","Tu nie ma kompromisów — jest smak, świeżość i uczciwa cena."]
    elif is_barber:
        hero_imgs = ["https://images.unsplash.com/photo-1585747860019-024afab6236e?w=1200&q=80","https://images.unsplash.com/photo-1593702288056-7927b442d0fa?w=1200&q=80","https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1200&q=80"]
        food_imgs = ["https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&q=80","https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&q=80","https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80","https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&q=80"]
        svc_pool = [
            ("Strzyżenie","Dobierzemy fryzurę do Twojej twarzy i stylu życia. Doradztwo gratis.","od 50 zł","scissors"),
            ("Golenie brzytwą","Gorący ręcznik, balsam, brzytwa. Rytuał, który pokochasz.","od 40 zł","sparkles"),
            ("Trymowanie brody","Każdy włosek na swoim miejscu. Precyzja i styl.","od 30 zł","star"),
            ("Pakiet full","Strzyżenie + golenie + modelowanie. Wyjdziesz nowy człowiek.","od 90 zł","heart"),
            ("Malowanie włosów","Koloryzacja, pasemka, odrosty. Doświadczony kolorysta.","od 120 zł","flame"),
        ]
        price_pool = [("Strzyżenie męskie","50-65 zł"),("Golenie brzytwą","40-55 zł"),("Trymowanie brody","30-40 zł"),("Strzyżenie + golenie","80-95 zł"),("Koloryzacja","120-180 zł"),("Pakiet VIP","90-130 zł")]
        headline_pool = ["Fryzura, która robi wrażenie","Twoja broda zasługuje na mistrza","Tu się strzyże inaczej","Wyjdź nowy człowiek","Styl zaczyna się od fryzura","Broda jak z katalogu"]
        sub_pool = ["Od 12 lat strzyżemy mężczyzn. Znamy się na trendach i na brodach.","Brzytwa, gorący ręcznik i mistrz fachu. Twój barber zna się na rzeczy.","Strzyżenie to nie tylko włosy — to Twój styl. Dobierzemy coś idealnego."]
    elif is_beauty:
        hero_imgs = ["https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80","https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1200&q=80","https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80"]
        food_imgs = ["https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80","https://images.unsplash.com/photo-1457972729786-0411a3b2b626?w=600&q=80","https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80","https://images.unsplash.com/photo-1604654894610-df83d6d64ba5?w=600&q=80"]
        svc_pool = [
            ("Manicure hybrydowy","200+ odcieni. Trwałość 3 tygodnie. Twoje dłonie będą mówić same za siebie.","od 80 zł","sparkles"),
            ("Zabieg na twarz","Oczyszczanie, nawilżenie, odmładzanie. Dobieramy pod typ Twojej skóry.","od 150 zł","heart"),
            ("Depilacja woskiem","Szybko, na długo, bez podrażnień. Stosujemy wosk premium.","od 60 zł","star"),
            ("Pakiet SPA","Manicure + pedicure + zabieg na twarz. Dzień tylko dla Ciebie.","od 280 zł","flame"),
            ("Przedłużanie rzęs","Naturalne, objętościowe, mega volume. Obudzisz się piękna.","od 150 zł","scissors"),
        ]
        price_pool = [("Manicure hybrydowy","80-100 zł"),("Manicure + pedicure","140-180 zł"),("Zabieg na twarz","150-250 zł"),("Depilacja nóg","100-150 zł"),("Pakiet SPA","280-400 zł"),("Przedłużanie rzęs","150-200 zł")]
        headline_pool = ["Twoje dłonie zasługują na piękno","Zadbaj o siebie — my zadbamy o detale","Tu piękno spotyka precyzję","Manicure, który robi wrażenie","Dzień tylko dla Ciebie","Piękno to nie luksus — to norma"]
        sub_pool = ["Salon urody, w którym jakość spotyka się z dbałością o każdy szczegół.","Ponad 200 odcieni, trwałość 3 tygodnie. Hybrydy, które nie odpryskują.","Zabiegi na twarz, dłonie i ciało. Dobieramy pod Twój typ skóry."]
    else:
        hero_imgs = ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80","https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80","https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1200&q=80"]
        food_imgs = ["https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80","https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80","https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&q=80","https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80"]
        svc_pool = [
            ("Strategia","Analizujemy rynek, konkurencję i Twoje cele. Plan, który przynosi kasę.","od 3 000 zł","zap"),
            ("Realizacja","Od pomysłu po produkt. Jeden zespół, zero chaosu, termin jak w zegarku.","od 8 000 zł","sparkles"),
            ("Wsparcie","Po wdrożeniu nie zostawiamy Cię. Aktualizacje, optymalizacja, pomoc 24/7.","od 1 500 zł/mies.","shield"),
            ("Audyt","Sprawdzimy co nie działa i powiemy jak to naprawić. Bez ściemy.","od 2 000 zł","star"),
            ("Szkolenia","Nauczymy Twój zespół narzędzi, które zwiększają sprzedaż.","od 3 500 zł","heart"),
        ]
        price_pool = [("Pakiet startowy","3 000-5 000 zł"),("Pakiet business","8 000-15 000 zł"),("Pakiet premium","15 000-30 000 zł"),("Konsultacja","500-1 000 zł"),("Wsparcie miesięczne","1 500-3 000 zł/mies."),("Audyt","2 000-4 000 zł")]
        headline_pool = ["Twój biznes zasługuje na więcej","Nie czekaj na klienta — przyciągnij go","Strategia, która przynosi rezultaty","Od pomysłu do pieniędzy","Bądź o krok przed konkurencją","Twój Next Level zaczyna się tutaj"]
        sub_pool = ["Pomagamy firmom rosnąć. Strategia, projektowanie, realizacja — wszystko pod jednym dachem.","Nie daj się konkurencji. Zbudujemy narzędzia, które sprzedają za Ciebie.","Widzimy trendy, zanim staną się mainstreamem. Twój biznes też może być do przodu."]

    # Random pick from pools
    hero_img = random.choice(hero_imgs)
    hero_headline = random.choice(headline_pool)
    hero_sub = random.choice(sub_pool)
    chosen_svc = random.sample(svc_pool, min(3, len(svc_pool)))
    chosen_prices = random.sample(price_pool, min(4, len(price_pool)))

    # Build service cards
    svc_cards = ""
    for i, (nm, ds, pr, icon) in enumerate(chosen_svc):
        img = food_imgs[i % len(food_imgs)]
        svc_cards += f'''<div class="group">
        <div class="aspect-[4/3] rounded-xl overflow-hidden mb-4"><img src="{img}" alt="{nm}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"></div>
        <div class="flex items-center gap-2.5 mb-2"><i data-lucide="{icon}" class="w-5 h-5" style="color:{accent}"></i><h3 class="font-semibold text-[15px]">{nm}</h3></div>
        <p class="text-gray-500 text-sm leading-relaxed mb-2">{ds}</p>
        <span class="text-sm font-semibold" style="color:{accent}">{pr}</span></div>'''

    price_rows = ""
    for n, p in chosen_prices:
        price_rows += f'<div class="flex justify-between items-center py-4 border-b border-gray-100 last:border-0"><span class="text-gray-600 text-[15px]">{n}</span><span class="font-semibold" style="color:{accent}">{p}</span></div>'

    # Dynamic reviews
    review_pool = [
        ("Najlepsze w okolicy! Polecam każdemu, kto szuka jakości.","Marek K.","MK"),
        ("Stały klient od roku. Ceny OK, obsługa super, zero zastrzeżeń.","Anna N.","AN"),
        ("Pierwszy raz — i na pewno nie ostatni. Wrócę tu jeszcze!","Tomek R.","TR"),
        ("Super atmosfera, szybka obsługa, efekt przechodzi oczekiwania.","Kasia W.","KW"),
        ("Mój znajomy polecił — i miał rację. To miejsce ma klimat.","Piotr S.","PS"),
        ("Szukałam czegoś dobrego w okolicy — i znalazłam. Brawo!","Ola M.","OM"),
    ]
    chosen_reviews = random.sample(review_pool, 3)
    rev_cards = ""
    for txt, nm, ini in chosen_reviews:
        rev_cards += f'''<div class="bg-gray-50 rounded-xl p-6">
        <div class="flex items-center gap-0.5 text-amber-400 mb-3"><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i></div>
        <p class="text-gray-600 text-sm leading-relaxed mb-4">"{txt}"</p>
        <div class="flex items-center gap-3"><div class="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">{ini}</div><div><p class="text-sm font-medium">{nm}</p><p class="text-xs text-gray-400">Klient</p></div></div></div>'''

    # Hero section layout
    if layout == "centered":
        hero_section = f'''<section class="pt-24 pb-16 md:pt-32 md:pb-24" style="{hero_bg}">
<div class="max-w-4xl mx-auto px-6 text-center fade-up">
<div class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-5"><i data-lucide="map-pin" class="w-3.5 h-3.5" style="color:{accent}"></i>{niche} · {addr}</div>
<h1 class="text-4xl md:text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-5">{hero_headline}</h1>
<p class="text-gray-500 text-base md:text-lg leading-relaxed mb-8 max-w-2xl mx-auto">{hero_sub}</p>
<div class="flex flex-wrap gap-3 justify-center mb-8">
<a href="#kontakt" class="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white text-sm font-medium transition-all hover:shadow-lg" style="background:{accent}">Skontaktuj się<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
<a href="#oferta" class="px-6 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors">Zobacz ofertę</a></div>
<div class="flex items-center gap-2.5 text-sm justify-center"><div class="flex items-center gap-0.5 text-amber-400"><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i></div><span class="font-medium">{rating}</span><span class="text-gray-400">· {reviews} opinii</span></div>
<div class="mt-10 aspect-video rounded-2xl overflow-hidden max-w-2xl mx-auto"><img src="{hero_img}" alt="{safe}" class="w-full h-full object-cover"></div></div></section>'''
    elif layout == "full":
        hero_section = f'''<section class="relative min-h-[80vh] flex items-center overflow-hidden">
<img src="{hero_img}" alt="{safe}" class="absolute inset-0 w-full h-full object-cover"><div class="absolute inset-0 bg-black/50"></div>
<div class="max-w-6xl mx-auto px-6 relative z-10 fade-up text-white">
<div class="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 mb-5"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i>{niche} · {addr}</div>
<h1 class="text-4xl md:text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-5">{hero_headline}</h1>
<p class="text-white/80 text-base md:text-lg leading-relaxed mb-8 max-w-xl">{hero_sub}</p>
<div class="flex flex-wrap gap-3 mb-8">
<a href="#kontakt" class="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-black text-sm font-medium bg-white hover:bg-gray-100 transition-all">Skontaktuj się<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
<a href="#oferta" class="px-6 py-3 rounded-lg border border-white/30 text-sm font-medium hover:bg-white/10 transition-colors">Zobacz ofertę</a></div>
<div class="flex items-center gap-2.5 text-sm"><div class="flex items-center gap-0.5 text-amber-400"><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i></div><span class="font-medium">{rating}</span><span class="text-white/60">· {reviews} opinii</span></div></div></section>'''
    else:
        hero_section = f'''<section class="pt-24 pb-16 md:pt-32 md:pb-24" style="{hero_bg}">
<div class="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
<div class="fade-up">
<div class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-5"><i data-lucide="map-pin" class="w-3.5 h-3.5" style="color:{accent}"></i>{niche} · {addr}</div>
<h1 class="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-5">{hero_headline}</h1>
<p class="text-gray-500 text-base md:text-lg leading-relaxed mb-8 max-w-md">{hero_sub}</p>
<div class="flex flex-wrap gap-3 mb-8">
<a href="#kontakt" class="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-white text-sm font-medium transition-all hover:shadow-lg" style="background:{accent}">Skontaktuj się<i data-lucide="arrow-right" class="w-4 h-4"></i></a>
<a href="#oferta" class="px-5 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors">Zobacz ofertę</a></div>
<div class="flex items-center gap-2.5 text-sm"><div class="flex items-center gap-0.5 text-amber-400"><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i></div><span class="font-medium">{rating}</span><span class="text-gray-400">· {reviews} opinii</span></div></div>
<div class="fade-up relative"><div class="aspect-[4/5] rounded-2xl overflow-hidden"><img src="{hero_img}" alt="{safe}" class="w-full h-full object-cover"></div></div></div></section>'''

    html = f'''<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<style>
*{{margin:0;padding:0;box-sizing:border-box;scroll-behavior:smooth}}
body{{font-family:'Inter',system-ui,sans-serif;color:#111827;line-height:1.6}}
.fade-up{{opacity:0;transform:translateY(20px);transition:opacity .5s ease,transform .5s ease}}
.fade-up.visible{{opacity:1;transform:translateY(0)}}
{anim_css}
</style>
</head>
<body>
<header class="fixed top-0 w-full bg-white/90 backdrop-blur-sm z-50 border-b border-gray-100">
<div class="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
<div class="flex items-center gap-2.5">
<div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style="background:{accent}">{safe[0]}</div>
<span class="font-semibold text-sm">{safe}</span></div>
<nav class="hidden md:flex items-center gap-7 text-sm text-gray-500">
<a href="#oferta" class="hover:text-gray-900 transition-colors">Oferta</a>
<a href="#cennik" class="hover:text-gray-900 transition-colors">Cennik</a>
<a href="#opinie" class="hover:text-gray-900 transition-colors">Opinie</a>
<a href="#kontakt" class="hover:text-gray-900 transition-colors">Kontakt</a></nav>
<a href="tel:{phone}" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors" style="background:{accent}"><i data-lucide="phone" class="w-3.5 h-3.5"></i>Zadzwoń</a></div></header>

{hero_section}

<section id="oferta" class="py-16 md:py-24 bg-gray-50">
<div class="max-w-6xl mx-auto px-6">
<div class="fade-up mb-12"><h2 class="text-3xl md:text-4xl font-bold tracking-tight">Nasza oferta</h2><p class="text-gray-500 mt-2">{random.choice(["Sprawdź co dla Ciebie przygotowaliśmy.","Każda usługa zaprojektowana z myślą o Tobie.","Zobacz, co możemy dla Ciebie zrobić.","Nasza oferta — bez ściemy, same konkrety."])}</p></div>
<div class="fade-up grid sm:grid-cols-2 lg:grid-cols-3 gap-8">{svc_cards}</div></div></section>

<section id="cennik" class="py-16 md:py-24">
<div class="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-start">
<div class="fade-up"><h2 class="text-3xl md:text-4xl font-bold tracking-tight">Cennik</h2><p class="text-gray-500 mt-2 mb-6">{random.choice(["Jasne ceny — bez niespodzianek.","Przejrzysty cennik.","Co ile kosztuje? Sprawdź poniżej.","Ceny bez ukrytych kosztów."])}</p>
<div class="flex items-center gap-3 text-sm text-gray-500"><i data-lucide="phone" class="w-4 h-4" style="color:{accent}"></i><span>Pytaj o wycenę: <a href="tel:{phone}" class="font-medium" style="color:{accent}">{phone}</a></span></div></div>
<div class="fade-up bg-gray-50 rounded-2xl p-6 md:p-8">{price_rows}</div></div></section>

<section id="opinie" class="py-16 md:py-24 bg-gray-50">
<div class="max-w-6xl mx-auto px-6">
<div class="fade-up mb-12"><h2 class="text-3xl md:text-4xl font-bold tracking-tight">{random.choice(["Co mówią nasi klienci","Opinie","Co mówią o nas ludzie","Klienci polecają nas dalej"])}</h2><p class="text-gray-500 mt-2">{reviews} zadowolonych klientów nie kłamie.</p></div>
<div class="fade-up grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{rev_cards}</div></div></section>

<section id="kontakt" class="py-16 md:py-24">
<div class="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12">
<div class="fade-up"><h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-4">Kontakt</h2><p class="text-gray-500 mb-8">{random.choice(["Napisz lub zadzwoń — odpowiadamy szybko.","Masz pytanie? Dzwoń śmiało.","Czekamy na Ciebie — napisz lub zadzwoń."])}</p>
<div class="space-y-5">
<div class="flex items-start gap-4"><div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><i data-lucide="map-pin" class="w-5 h-5 text-gray-600"></i></div><div><p class="font-medium text-sm">{addr}</p><p class="text-gray-400 text-xs mt-0.5">Dojazd samochodem i komunikacją</p></div></div>
<div class="flex items-start gap-4"><div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><i data-lucide="phone" class="w-5 h-5 text-gray-600"></i></div><div><a href="tel:{phone}" class="font-medium text-sm hover:underline" style="color:{accent}">{phone}</a><p class="text-gray-400 text-xs mt-0.5">Pon-Pt 8:00-18:00</p></div></div>
<div class="flex items-start gap-4"><div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><i data-lucide="clock" class="w-5 h-5 text-gray-600"></i></div><div><p class="font-medium text-sm">Pon-Sob: 10:00 - 22:00</p><p class="text-gray-400 text-xs mt-0.5">Niedziela: 12:00 - 20:00</p></div></div></div></div>
<div class="fade-up"><form class="bg-gray-50 rounded-2xl p-6 md:p-8 space-y-4">
<div><label class="block text-xs font-medium text-gray-600 mb-1.5">Imię</label><input type="text" placeholder="Jan Kowalski" class="w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0" style="--tw-ring-color:{accent}"></div>
<div class="grid grid-cols-2 gap-4"><div><label class="block text-xs font-medium text-gray-600 mb-1.5">Email</label><input type="email" placeholder="jan@firma.pl" class="w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0" style="--tw-ring-color:{accent}"></div>
<div><label class="block text-xs font-medium text-gray-600 mb-1.5">Telefon</label><input type="tel" placeholder="+48 123 456 789" class="w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0" style="--tw-ring-color:{accent}"></div></div>
<div><label class="block text-xs font-medium text-gray-600 mb-1.5">Wiadomość</label><textarea rows="4" placeholder="W czym możemy pomóc?" class="w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-offset-0" style="--tw-ring-color:{accent}"></textarea></div>
<button type="submit" class="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-colors" style="background:{accent}">Wyślij wiadomość</button></form></div></div></section>

<footer class="border-t border-gray-100 py-8">
<div class="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
<p class="text-sm text-gray-400">© {year} {safe}. Wszelkie prawa zastrzeżone.</p>
<div class="flex items-center gap-5 text-sm text-gray-400">
<a href="#oferta" class="hover:text-gray-700 transition-colors">Oferta</a>
<a href="#cennik" class="hover:text-gray-700 transition-colors">Cennik</a>
<a href="#kontakt" class="hover:text-gray-700 transition-colors">Kontakt</a></div></div></footer>

<script>
lucide.createIcons();
const o=new IntersectionObserver(e=>{{e.forEach(x=>{{if(x.isIntersecting){{x.target.classList.add('visible');o.unobserve(x.target)}}}})}},{{threshold:.15}});
document.querySelectorAll('.fade-up').forEach(el=>o.observe(el));
</script>
</body></html>'''

    return {"files": {"main/frontend/preview.html": html}, "meta": {"title": title, "headline": hero_headline, "subheadline": desc[:120], "ctaText": "Skontaktuj się"}}

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



