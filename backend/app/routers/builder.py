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
    last_err: str = "brak dostępnych modeli"
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

EDITORIAL_RULES = """Jesteś senior editorial designerem (poziom Linear, Stripe Docs, Relay) — Twoje strony wyglądają jak z papierowego atelier, nie jak z generatora AI.

ZASADY PAPIEROWEGO ATELIER:
- Papier #fcfcF9, tusz #131412, szałwia #d8e4bc tylko jako cienka linia/podkreślenie, glina #e8ddd3 na ciepłe tła. ZAKAZ niebieskiego #3b82f6, fioletów i tęczowych gradientów.
- Typografia: Instrument Serif 400 dla H1/H2 (nie kursywa, chyba że <em>), SF Pro 400/500 dla body. H1 48-72px, H2 28-36px, body 15px, mono 11px uppercase dla mety. Jeden ciężar, nie font-black wszędzie.
- Promień: 10-12px dla kart, 8px dla inputów, brak pełnych pigułek (poza mini tagami). Cienie max 0 1px 2px rgba(0,0,0,0.04) lub brak + 1px border #e7e5e0.
- Układ: asymetryczna siatka 12 kolumn (np. 7/5, 8/4), hojne białe przestrzenie 80-120px między sekcjami, wyrównanie do lewej, dozwolone nachodzenie. Zakaz centrowania wszystkiego.
- Ikony: cienki stroke 1.2px, 14-16px, NIGDY w wypełnionych kółkach. Numery 01 mono, nie ikonki.
- Motion: tylko opacity + y 12px, 150-300ms ease, bez blur/rotate/scale. Brak infinite pulse.
- Treść: prawdziwe teksty z danych klienta, zero lorem, użyj opinii z imionami.
- Brzydkie AI-tells do usunięcia: zaokrąglone 2xl wszędzie, fioletowe cienie, backdrop-blur, gradientowe tytuły, Lucide w kółeczkach, glassmorphism, karuzele logo, glow na przyciskach, 3 kafelki w rzędzie.
"""

IMPECCABLE_DESIGN_RULES = EDITORIAL_RULES

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
- WYCIĄGNIJ z takiego tekstu WSZYSTKIE fakty i użyj ich na stronie: nazwa firmy jako brand, adres i telefon w sekcji Kontakt, zakres cen w Cenniku, opinie klientów (z imionami autorów!) jako sekcja Opinie/Testimoniale, pozycje menu/oferty jako karty usług, ocena gwiazdkowa jako badge social proof.
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

=== PROCES PROJEKTOWANIA (wymagany) ===

1. PRZETWÓRZ DANE WEJŚCIOWE — zanim napisz jakikolwiek kod:
   - Przeczytaj uważnie: BUSINESS_NAME, NICHE, DESCRIPTION, STYLE, COLORS, SECTIONS, EXTRA
   - Z DESCRIPTION/EXTRA wyciągnij WSZYSTKIE fakty: adres, telefon, godziny, opinie z imionami, ceny, nazwy usług/dań, ocenę, stronę www
   - Zrozum branżę z NICHE i DESCRIPTION — to determinuje ton, układ, typ hero, sekcje
   - Jeśli COLORS podano — użyj TYLKO tych kolorów. Jeśli nie — dobeż paletę pod branżę i STYLE
   - Jeśli STYLE podano ("nowoczesny, minimalistyczny", "rustykalny, ciepły", "elegancki, premium") — to determinuje typografię, odstępy, kształty, animacje
   - SECTIONS mówi jakie sekcje mają być — ale KOLEJNOŚĆ i UKŁAD decydujesz sam na podstawie branży

2. ZAPROJEKTUJ UNIKALNĄ STRONĘ — na podstawie przeanalizowanych danych:
   - KAŻDA strona MUSI wyglądać inaczej. Nie ma szablonów "restauracja = X", "barber = Y". 
   - Branża + styl + dane = unikalny layout. AI sama decyduje:
     * Jak wygląda hero (zdjęcie na pół ekranu? full-screen z nakładką? portret? produkt? mapa?)
     * Jaka kolejność sekcji (Menu przed Opiniami? Zespół przed Cennikiem? Atrakcje przed Kontaktem?)
     * Jaki układ sekcji (grid 3-kolumnowy? asymetryczny 7/5? full-width zdjęcie z nakładką? tabela? karty?)
     * Jakie zdjęcia z Unsplash (konkretne zapytania: "cozy restaurant interior lodz", "barber cutting hair closeup", "auto repair shop lift")
     * Jakie ikony, kształty przycisków, typ animacji
   - Jeśli w danych jest adres "ul. Piotrkowska 123, Łódź" → hero: "Serdecznie zapraszamy na Piotrkowską 123 w centrum Łodzi", mapa w kontakcie ustawiona na ten punkt
   - Jeśli są godziny "Pon-Pt 8:00-20:00" → w hero "Otwarte dzisiaj do 20:00", w stopce, w sekcji Kontakt
   - Jeśli opinie z imionami "Jan K.: Super!" → jedna w hero jako social proof, reszta w sekcji Opinie z avatarami/inicjałami
   - Jeśli ceny "Strzyżenie 50-80 zł" → konkretne przedziały w Cenniku, nie "ceny od X zł"
   - Telefon → klikalny tel: w hero, nagłówku, stopce, kontakcie
   - Ocena 4.7 (120 opinii) → badge w hero, w Opiniach, w stopce

3. PISZ JAK CZŁOWIEK, NIE JAK MARKETINGOWIEC
   - Zamiast "Profesjonalne usługi najwyższej jakości" → "Od 15 lat strzyżemy mężczyzn z Łodzi. Znamy każdą brodę."
   - Zamiast "Kompleksowe rozwiązania gastronomiczne" → "Robimy pizzę na cienkim cieście, tak jak w Neapolu. Ciasto chodzi 48h."
   - Zamiast "Nowoczesne podejście do klienta" → "Przyjdziecie, usiądziecie, zapijecie kawę. Reszta nasza sprawa."
   - Konkretne: lata doświadczenia, nazwiska mistrzów, nazwa ulicy, dzielnicy, punkty orientacyjne ("przed Biedronką", "za kościołem", "przy rondzie")
   - ZAKAZ słów: "profesjonalny", "kompleksowy", "nowoczesny", "innowacyjny", "premium", "jakość", "ekspert", "lider", "rozwiązania", "partner", "pasja", "misja", "wizja"

4. LAYOUT — ASYMETRIA I ODDECH
   - Hero: nie zawsze centrowany. Zdjęcie 50/50 z tekstem, full-screen z nakładką, portret po lewej, produkt na tle — decydujesz na podstawie branży
   - Sekcje: nie 3 kolumny wszędzie. Używaj 7/5, 8/4, 2/1, full-width zdjęcia z nakładką tekstu, tabele, listy, kafelki — co pasuje do treści
   - Białe przestrzenie: 80-120px między sekcjami. Nie tłocz treści.
   - Zdjęcia: placeholdery Unsplash z KONKRETNYMI zapytaniami: "cozy restaurant interior lodz", "barber shop poland", "auto repair shop lift", "boutique hotel mountain view", "furniture store interior"

5. KOLORY — DYSCYPLINA
   - Jeśli COLORS podano → TYLKO te kolory. Akcent = pierwszy kolor, tusz = czarny/ciemny, tło = biały/papier
   - Jeśli NIE podano → dobeż paletę pod branżę i STYLE (ciepła dla gastronomii, męska/ciemna dla barbiera, pastelowa dla spa, nowoczesna/niebieska dla tech)
   - NIE dodawaj "ułatwień" (szarości, niebieskie linki, czerwone błędy). Wszystko w palecie.
   - Hover/active/focus = ciemniejszy odcień akcentu lub czarny

6. TYPOGRAFIA — DYSCYPLINA
   - H1: Instrument Serif, 48-72px, weight 400, line-height 0.95, letter-spacing -0.02em. NIE font-black.
   - H2: Instrument Serif, 28-36px, weight 400.
   - Body: Inter/SF Pro, 15px, line-height 1.6, weight 400.
   - Meta: Inter, 11-12px, uppercase, tracking-wider, weight 500, kolor akcentu/ciemniejszy.
   - Przyciski: Inter, 14-15px, weight 500, uppercase, tracking-wider.

7. INTERAKCJE — SUBTELNE
   - Hover karta: translateY(-4px) + box-shadow 0 12px 24px rgba(0,0,0,0.08). Brak scale.
   - Przycisk: background-color change + box-shadow. Brak transform scale.
   - Scroll reveal: opacity 0→1 + translateY(12px→0), 300ms ease-out. Raz na element.
   - ZAKAZ: infinite pulse, bounce, rotate, blur, parallax, floating elements.

8. FORMULARZ KONTAKTOWY (jeśli potrzebny)
   - Pola: Imię, Email, Telefon, Wiadomość (textarea). Opcjonalnie: Data (date), Usługa (select).
   - Walidacja klienta (required, type=email, pattern tel).
   - Submit: fetch('/api/contact', {method:'POST', body: JSON.stringify(data)}).
   - Stan: loading (spinner), success (toast), error (czerwona ramka).
   - Backend: FastAPI POST /api/contact.

9. SEO I META
   - <title> = meta.title (max 60 zn.)
   - <meta name="description"> = meta.subheadline (max 160 zn.)
   - OG tags: title, description, image (Unsplash placeholder), type=website
   - JSON-LD LocalBusiness: name, address, phone, openingHours, priceRange, aggregateRating, url, image

PAMIĘTAJ: Twoim celem — klient po otwarciu pomyśli: "To wygląda jak strona, którą zrobiłby dobry freelancer po 2 tygodniach pracy", a NIE "wygenerowane przez AI w 30 sekund".

NOW PRZECZYTAJ DANE WEJŚCIOWE, PRZENALIZUJ JE I WYGENERUJ UNIKALNĄ STRONĘ.
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
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>:root{--paper:#fcfcF9;--ink:#131412;--line:#e7e5e0;--sage:#d8e4bc} body{font-family:'Inter',system-ui,sans-serif;background:var(--paper);color:var(--ink)} h1,h2{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.02em}</style>
</head>
<body>
<header class="max-w-[1120px] mx-auto px-6 py-6 flex items-center justify-between border-b border-[var(--line)]">
  <span class="font-serif text-xl tracking-tight" style="font-family:'Instrument Serif',serif">__BN__</span>
  <a href="#kontakt" class="px-5 py-2 rounded-[10px] bg-[var(--ink)] text-white text-sm font-medium">Kontakt</a>
</header>
<section class="max-w-[1120px] mx-auto px-6 pt-16 pb-12 grid md:grid-cols-12 gap-8 items-start">
  <div class="md:col-span-7">
    <p class="text-[11px] tracking-[0.12em] uppercase border border-[var(--line)] inline-block px-2.5 py-1 rounded-full">Dostępne od ręki</p>
    <h1 class="text-[48px] md:text-[64px] leading-[0.9] mt-6">__HEAD__</h1>
    <p class="mt-6 text-[15px] leading-relaxed opacity-70 max-w-[42ch]">__DESC__</p>
    <a href="#kontakt" class="inline-block mt-8 px-6 py-3 rounded-[10px] bg-[var(--ink)] text-white text-sm font-medium">Umów bezpłatną wycenę — odpowiadamy dziś</a>
  </div>
  <div class="md:col-span-5 pt-4">
    <div class="border border-[var(--line)] rounded-[12px] p-6 bg-white">
      <div class="text-sm font-medium">Bez zobowiązań. Zadzwoń i zapytaj o wycenę w 15 minut.</div>
      <div class="mt-4 flex items-center gap-3 text-xs"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Dostępni dziś do 18:00</div>
    </div>
  </div>
</section>
<section class="max-w-[1120px] mx-auto px-6 pb-16 grid sm:grid-cols-3 gap-6 border-t border-[var(--line)] pt-10">
  <div class="border-t border-[var(--line)] pt-4"><div class="text-[11px] tracking-wide uppercase opacity-60">01 — Szybko</div><h3 class="font-medium mt-2">Realizacja 48h</h3><p class="text-sm opacity-70 mt-1">Projekt gotowy do akceptacji w dwa dni od briefu.</p></div>
  <div class="border-t border-[var(--line)] pt-4 mt-6 sm:mt-12"><div class="text-[11px] tracking-wide uppercase opacity-60">02 — Dopracowane</div><h3 class="font-medium mt-2">Redakcyjny szlif</h3><p class="text-sm opacity-70 mt-1">Każdy nagłówek i akapit pisany pod Twoją branżę.</p></div>
  <div class="border-t border-[var(--line)] pt-4"><div class="text-[11px] tracking-wide uppercase opacity-60">03 — Wsparcie</div><h3 class="font-medium mt-2">Jesteśmy obok</h3><p class="text-sm opacity-70 mt-1">Poprawki i wdrożenie bez dodatkowych kosztów.</p></div>
</section>
<section id="kontakt" class="max-w-[720px] mx-auto px-6 pb-20">
  <div class="border border-[var(--line)] rounded-[12px] p-8 bg-white">
    <h2 class="text-2xl" style="font-family:'Instrument Serif',serif">Porozmawiajmy o Twojej stronie</h2>
    <p class="mt-2 text-sm opacity-70">Zadzwoń lub napisz — odpowiadamy tego samego dnia, bez formularzy.</p>
    <a href="tel:+48000000000" class="inline-block mt-6 px-6 py-3 rounded-[10px] bg-[var(--sage)] text-[var(--ink)] text-sm font-medium border border-[var(--line)]">Zadzwoń teraz</a>
  </div>
</section>
<footer class="border-t border-[var(--line)] py-8 text-center text-sm opacity-60">© __YEAR__ __BN__ — Marszałkowska 1, Warszawa · kontakt@sitemorph.pl</footer>
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

Wygeneruj stronę zgodnie z SYSTEM_PROMPT: JEDEN samowystarczalny plik main/frontend/index.html (Tailwind CDN + style/JS inline), polskie treści, premium design.
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
