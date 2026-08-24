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
    # Nie udalo sie ustalic — probuj po kolei nazw preferowanych przy wywolaniu
    _gemini_model_cache = GEMINI_PREFERRED[0] if GEMINI_PREFERRED else None
    return _gemini_model_cache


def gemini_generate(system_prompt: str, user_prompt: str, temperature: float = 0.85, max_tokens: int = 32768):
    """Zwroc (tekst, None) albo (None, opis_bledu). Vercel Hobby limit 10s:
    JEDEN szybki call na flash-lite (najszybszy model), timeout 9s, zero retry/resolve."""
    if not GEMINI_API_KEY:
        return None, "Brak GEMINI_API_KEY"
    # Kolejność od najszybszego — flash-lite ma najniższy latency (~2-4s na 8k tokens)
    candidates = ["gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-3.1-flash-lite"]
    errs: List[str] = []
    last_err: str = "brak dostępnych modeli"
    for mdl in candidates[:3]:
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
                timeout=9,
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

INDEX_HTML_RULE = """- STRUKTURA PROJEKTU: React + Vite + TypeScript + Tailwind CSS
  main/
  ├── frontend/
  │   ├── index.html                    # Vite entry HTML
  │   ├── package.json                  # zależy: react, react-dom, vite, tailwindcss, postcss, autoprefixer, lucide-react
  │   ├── tsconfig.json                 # TypeScript config
  │   ├── vite.config.ts                # Vite config z React plugin
  │   ├── tailwind.config.js            # Tailwind config
  │   ├── postcss.config.js             # PostCSS config
  │   ├── public/
  │   │   └── favicon.svg
  │   ├── src/
  │   │   ├── main.tsx                  # React entry point
  │   │   ├── App.tsx                   # Główny komponent - CAŁA STRONA TUTAJ
  │   │   ├── index.css                 # Tailwind directives + custom styles
  │   │   ├── components/               # Komponenty sekcji (Hero, Offer, Pricing, Testimonials, Contact, Footer)
  │   │   │   ├── Hero.tsx
  │   │   │   ├── Offer.tsx
  │   │   │   ├── Pricing.tsx
  │   │   │   ├── Testimonials.tsx
  │   │   │   ├── Contact.tsx
  │   │   │   └── Footer.tsx
  │   │   ├── ui/                       # UI primitives (Button, Card, Container, Section)
  │   │   │   ├── Button.tsx
  │   │   │   ├── Card.tsx
  │   │   │   ├── Container.tsx
  │   │   │   └── Section.tsx
  │   │   ├── hooks/                    # Custom hooks (useScrollReveal, useMobile)
  │   │   │   └── useScrollReveal.ts
  │   │   ├── lib/                      # Utilities (cn, formatters)
  │   │   │   └── utils.ts
  │   │   └── types.ts                  # TypeScript interfaces
  │   ├── package.json
  │   └── README.md

ZASADY GENEROWANIA:
- App.tsx to GŁÓWNY PLIK STRONY — importuje wszystkie sekcje, składa layout
- Każda sekcja = osobny komponent w components/ (Hero, Offer, Pricing, Testimonials, Contact, Footer)
- UI primitives w ui/ (Button, Card, Container, Section) — wielokrotnego użytku
- Tailwind CSS przez @tailwind directives w index.css + tailwind.config.js z custom theme (colors, fonts)
- lucide-react dla ikon (import { IconName } from 'lucide-react')
- TypeScript interfaces w types.ts (BusinessData, SectionProps, etc.)
- ZERO "lorem ipsum" — same prawdziwe dane z inputu
- Komponenty muszą być gotowe do użycia: npm install && npm run dev
- package.json z scripts: dev, build, preview
- vite.config.ts z @vitejs/plugin-react
- tsconfig.json strict mode
"""

SYSTEM_PROMPT = IMPECCABLE_DESIGN_RULES + """

Jesteś SiteMorph AI — generator premium stron dla lokalnych firm.
ZADANIE: Wygeneruj kompletny projekt strony w DOKŁADNIE tej strukturze folderów (React + Vite + TypeScript + Tailwind):

  main/
  ├── frontend/
  │   ├── index.html
  │   ├── package.json
  │   ├── tsconfig.json
  │   ├── vite.config.ts
  │   ├── tailwind.config.js
  │   ├── postcss.config.js
  │   ├── public/favicon.svg
  │   ├── src/
  │   │   ├── main.tsx
  │   │   ├── App.tsx                    # GŁÓWNY KOMPONENT STRONY
  │   │   ├── index.css
  │   │   ├── components/
  │   │   │   ├── Hero.tsx
  │   │   │   ├── Offer.tsx
  │   │   │   ├── Pricing.tsx
  │   │   │   ├── Testimonials.tsx
  │   │   │   ├── Contact.tsx
  │   │   │   └── Footer.tsx
  │   │   ├── ui/
  │   │   │   ├── Button.tsx
  │   │   │   ├── Card.tsx
  │   │   │   ├── Container.tsx
  │   │   │   └── Section.tsx
  │   │   ├── hooks/useScrollReveal.ts
  │   │   ├── lib/utils.ts
  │   │   └── types.ts
  │   ├── package.json
  │   └── README.md
  ├── backend/main.py       <- OPCJONALNIE: tylko jeśli strona potrzebuje backendu (formularz kontaktowy/rezerwacja)
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
    "main/frontend/src/App.tsx": "...",
    "main/frontend/src/main.tsx": "...",
    "main/frontend/src/index.css": "...",
    "main/frontend/src/components/Hero.tsx": "...",
    "main/frontend/src/components/Offer.tsx": "...",
    "main/frontend/src/components/Pricing.tsx": "...",
    "main/frontend/src/components/Testimonials.tsx": "...",
    "main/frontend/src/components/Contact.tsx": "...",
    "main/frontend/src/components/Footer.tsx": "...",
    "main/frontend/src/ui/Button.tsx": "...",
    "main/frontend/src/ui/Card.tsx": "...",
    "main/frontend/src/ui/Container.tsx": "...",
    "main/frontend/src/ui/Section.tsx": "...",
    "main/frontend/src/hooks/useScrollReveal.ts": "...",
    "main/frontend/src/lib/utils.ts": "...",
    "main/frontend/src/types.ts": "...",
    "main/frontend/index.html": "...",
    "main/frontend/package.json": "...",
    "main/frontend/tsconfig.json": "...",
    "main/frontend/vite.config.ts": "...",
    "main/frontend/tailwind.config.js": "...",
    "main/frontend/postcss.config.js": "...",
    "main/frontend/public/favicon.svg": "...",
    "main/frontend/package.json": "...",
    "main/frontend/README.md": "...",
    "main/backend/main.py": "# FastAPI — TYLKO jeśli strona potrzebuje backendu (formularz kontaktowy/rezerwacja); inaczej POMIŃ",
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
- main/backend/main.py: twórz TYLKO gdy jest realnie potrzebny (formularz kontaktowy, rezerwacja). Wtedy prosty FastAPI z endpointem POST /api/contact i komentarzem jak uruchomić. Frontend w App.tsx woła fetch('/api/contact', {method:'POST'}).
- DESIGN: premium, konwersyjny, responsywny (mobile-first), font systemowy/Google Fonts, akcent wg COLORS użytkownika, dużo światła, zaokrąglenia 16-24px, miękkie cienie.
- TREŚCI: po polsku, realistyczne dla branży; sekcje dokładnie wg SECTIONS użytkownika (domyślnie Hero, Oferta, Cennik, Opinie, Kontakt).
- NIE używaj "lorem ipsum". Zwróć PEŁNE pliki — nie skracaj, nie pisz "...".

=== SKALOWANIE PROMPTU WG PAKIETU KREDYTÓW ===
Użytkownik ma PAKIET: {package_name} ({credits} kredytów).
- PAKIET STARTER (10-25 kr): Podstawowa strona — Hero, Oferta, Kontakt. Prosty layout, podstawowe animacje.
- PAKIET PRO (50-100 kr): Rozbudowana strona — Hero, Oferta, Cennik, Opinie, Galeria, Kontakt. Animacje scroll-reveal, hover effects, lepsze SEO.
- PAKIET BUSINESS (200-500 kr): Pełna strona biznesowa — wszystkie sekcje + Team, FAQ, Blog/News, Case Studies, Multi-step forms, A/B test variants, Analytics setup, Performance optimization.
- PAKIET AGENCJA (500+ kr): Enterprise-grade — wszystko z Business + CMS-ready components, Storybook, E2E tests, CI/CD config, Multi-language, Advanced SEO schema, Custom design system tokens.

IMPLEMENTUJ FUNKCJE WG PAKIETU — nie generuj funkcji Business/Agencja dla Startera.

=== PROCES PROJEKTOWANIA (wymagany) ===

1. PRZETWÓRZ DANE WEJŚCIOWE — zanim napisz jakikolwiek kod:
   - Przeczytaj uważnie: BUSINESS_NAME, NICHE, DESCRIPTION, STYLE, COLORS, SECTIONS, EXTRA, PACKAGE
   - Z DESCRIPTION/EXTRA wyciągnij WSZYSTKIE fakty: adres, telefon, godziny, opinie z imionami, ceny, nazwy usług/dań, ocenę, stronę www
   - Zrozum branżę z NICHE i DESCRIPTION — to determinuje ton, układ, typ hero, sekcje
   - Jeśli COLORS podano — użyj TYLKO tych kolorów. Jeśli nie — dobeż paletę pod branżę i STYLE
   - Jeśli STYLE podano ("nowoczesny, minimalistyczny", "rustykalny, ciepły", "elegancki, premium") — to determinuje typografię, odstępy, kształty, animacje
   - SECTIONS mówi jakie sekcje mają być — ale KOLEJNOŚĆ i UKŁAD decydujesz sam na podstawie branży
   - DOSTOSUJ ZAKRES DO PAKIETU — Starter = 3-4 sekcje, Pro = 5-6, Business = 7-9, Agencja = 10+

2. ZAPROJEKTUJ UNIKALNĄ STRONĘ — na podstawie przeanalizowanych danych + PAKIETU:
   - KAŻDA strona MUSI wyglądać inaczej. Nie ma szablonów "restauracja = X", "barber = Y". 
   - Branża + styl + dane + PAKIET = unikalny layout. AI sama decyduje:
     * Jak wygląda hero (zdjęcie na pół ekranu? full-screen z nakładką? portret? produkt? mapa? wideo background?)
     * Jaka kolejność sekcji (Menu przed Opiniami? Zespół przed Cennikiem? Atrakcje przed Kontaktem?)
     * Jaki układ sekcji (grid 3-kolumnowy? asymetryczny 7/5? full-width zdjęcie z nakładką? tabela? karty? masonry?)
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
   - Hero: nie zawsze centrowany. Zdjęcie 50/50 z tekstem, full-screen z nakładką, portret po lewej, produkt na tle, wideo background — decydujesz na podstawie branży + pakietu
   - Sekcje: nie 3 kolumny wszędzie. Używaj 7/5, 8/4, 2/1, full-width zdjęcia z nakładką tekstu, tabele, karty, masonry, carousel — co pasuje do treści + pakietu
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

7. INTERAKCJE — SUBTELNE (rozszerzane wg pakietu)
   - Hover karta: translateY(-4px) + box-shadow 0 12px 24px rgba(0,0,0,0.08). Brak scale.
   - Przycisk: background-color change + box-shadow. Brak transform scale.
   - Scroll reveal: opacity 0→1 + translateY(12px→0), 300ms ease-out. Raz na element.
   - Pro+: Framer Motion page transitions, stagger animations, scroll-triggered counters
   - Business+: Parallax backgrounds, cursor-follow effects, magnetic buttons, Lottie animations
   - Agencja+: 3D transforms, WebGL shaders, custom cursor, GSAP timelines
   - ZAKAZ: infinite pulse, bounce, rotate, blur, parallax (chyba że pakiet to pozwala), floating elements.

8. FORMULARZ KONTAKTOWY (jeśli potrzebny / pakiet Pro+)
   - Pola: Imię, Email, Telefon, Wiadomość (textarea). Opcjonalnie: Data (date), Usługa (select), Multi-step (Business+)
   - Walidacja klienta (required, type=email, pattern tel, Zod schema Business+)
   - Submit: fetch('/api/contact', {method:'POST', body: JSON.stringify(data)}).
   - Stan: loading (spinner), success (toast), error (czerwona ramka).
   - Backend: FastAPI POST /api/contact.

9. SEO I META (rozszerzane wg pakietu)
   - <title> = meta.title (max 60 zn.)
   - <meta name="description"> = meta.subheadline (max 160 zn.)
   - OG tags: title, description, image (Unsplash placeholder), type=website
   - JSON-LD LocalBusiness: name, address, phone, openingHours, priceRange, aggregateRating, url, image
   - Pro+: Article/BlogPosting schema, FAQPage schema
   - Business+: Product/Service schema, Review schema, Sitemap.xml, robots.txt
   - Agencja+: Full technical SEO audit config, hreflang, AMP variants

PAMIĘTAJ: Twoim celem — klient po otwarciu pomyśli: "To wygląda jak strona, którą zrobiłby dobry freelancer/agencja po 2 tygodniach pracy", a NIE "wygenerowane przez AI w 30 sekund".

NOW PRZECZYTAJ DANE WEJŚCIOWE (W TYM PAKIET), PRZENALIZUJ JE I WYGENERUJ UNIKALNĄ STRONĘ DOPASOWANĄ DO PAKIETU.
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
    safe_bn = re.sub(r'[^a-zA-Z0-9]', '', bn)[:16] or "Site"
    # Minimalist Vite + React + TS structure - fallback when AI fails
    index_html = f"""<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>"""
    main_tsx = """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)"""
    index_css = """@tailwind base;
@tailwind components;
@tailwind utilities;
:root{--paper:#fcfcf9;--ink:#131412;--line:#e7e5e0;--sage:#d8e4bc}
body{font-family:'Inter',system-ui,sans-serif;background:var(--paper);color:var(--ink)}
h1,h2{font-family:'Instrument Serif',Georgia,serif;letter-spacing:-.02em}"""
    utils_ts = """export function cn(...c:(string|boolean|undefined)[]){return c.filter(Boolean).join(' ')}"""
    types_ts = """export interface BusinessData{name:string;niche:string;description:string}"""
    hook_ts = """import {useEffect,useRef,useState} from 'react'
export function useScrollReveal(){const ref=useRef<HTMLDivElement>(null);const [v,setV]=useState(false);useEffect(()=>{const o=new IntersectionObserver(([e])=>e.isIntersecting&&setV(true),{threshold:.15});if(ref.current)o.observe(ref.current);return()=>o.disconnect()},[]);return {ref,visible:v}}"""
    button_tsx = """import {cn} from '../lib/utils'
export function Button({children,className,...p}:React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'ghost'}){return <button className={cn('px-5 py-2.5 rounded-xl font-medium text-sm',p.variant==='primary'?'bg-black text-white':'border',className)} {...p}>{children}</button>}"""
    card_tsx = """export function Card({children,className}:{children:React.ReactNode;className?:string}){return <div className={'rounded-2xl border bg-white p-6 '+ (className||'')}>{children}</div>}"""
    container_tsx = """export function Container({children}:{children:React.ReactNode}){return <div className="max-w-[1120px] mx-auto px-6">{children}</div>}"""
    section_tsx = """export function Section({children,id,className}:{children:React.ReactNode;id?:string;className?:string}){return <section id={id} className={'py-16 '+ (className||'')}>{children}</section>}"""
    hero_tsx = f"""import {{Container}} from '../ui/Container'
import {{Section}} from '../ui/Section'
export function Hero(){{return <Section><Container><div className="grid md:grid-cols-12 gap-8 items-start"><div className="md:col-span-7"><p className="text-xs uppercase tracking-widest border inline-block px-2.5 py-1 rounded-full">Dostępne od ręki</p><h1 className="text-[48px] md:text-[64px] leading-[0.9] mt-6 font-serif">{headline}</h1><p className="mt-6 opacity-70 max-w-[42ch]">{desc}</p><a href="#kontakt" className="inline-block mt-8 px-6 py-3 rounded-xl bg-black text-white text-sm">Umów wycenę — odpowiadamy dziś</a></div><div className="md:col-span-5"><div className="rounded-2xl border p-6 bg-white"><p className="text-sm font-medium">Bez zobowiązań. Zapytaj o wycenę w 15 min.</p><p className="mt-3 text-xs flex gap-2 items-center"><span className="w-2 h-2 rounded-full bg-emerald-500"/> Dostępni dziś do 18:00</p></div></div></div></Container></Section>}}"""
    offer_tsx = """import {Container} from '../ui/Container'
import {Section} from '../ui/Section'
import {Card} from '../ui/Card'
export function Offer(){return <Section><Container><div className="grid sm:grid-cols-3 gap-6 border-t pt-10"><Card><p className="text-xs uppercase opacity-60">01 — Szybko</p><h3 className="font-medium mt-2">Realizacja 48h</h3><p className="text-sm opacity-70">Projekt gotowy w dwa dni.</p></Card><Card><p className="text-xs uppercase opacity-60">02 — Dopracowane</p><h3 className="font-medium mt-2">Redakcyjny szlif</h3><p className="text-sm opacity-70">Każdy nagłówek pod branżę.</p></Card><Card><p className="text-xs uppercase opacity-60">03 — Wsparcie</p><h3 className="font-medium mt-2">Jesteśmy obok</h3><p className="text-sm opacity-70">Poprawki bez dopłat.</p></Card></div></Container></Section>}"""
    pricing_tsx = """import {Container} from '../ui/Container'
import {Section} from '../ui/Section'
export function Pricing(){return <Section><Container><h2 className="text-2xl font-serif">Cennik</h2><p className="opacity-70">Skontaktuj się po wycenę dopasowaną do potrzeb.</p></Container></Section>}"""
    testimonials_tsx = """import {Container} from '../ui/Container'
import {Section} from '../ui/Section'
export function Testimonials(){return <Section><Container><h2 className="text-2xl font-serif">Opinie</h2><p className="opacity-70">Klienci nas polecają.</p></Container></Section>}"""
    contact_tsx = """import {Container} from '../ui/Container'
import {Section} from '../ui/Section'
export function Contact(){return <Section id="kontakt"><Container><div className="max-w-[720px] mx-auto"><div className="rounded-2xl border p-8 bg-white text-center"><h2 className="text-2xl font-serif">Porozmawiajmy</h2><p className="mt-2 text-sm opacity-70">Odpowiadamy tego samego dnia.</p><a href="tel:+48000000000" className="inline-block mt-6 px-6 py-3 rounded-xl bg-black text-white text-sm">Zadzwoń teraz</a></div></div></Container></Section>}"""
    footer_tsx = f"""export function Footer(){{return <footer className="border-t py-8 text-center text-sm opacity-60">© {year} {bn} — Marszałkowska 1, Warszawa · kontakt@sitemorph.pl</footer>}}"""
    app_tsx = f"""import {{Hero}} from './components/Hero'
import {{Offer}} from './components/Offer'
import {{Pricing}} from './components/Pricing'
import {{Testimonials}} from './components/Testimonials'
import {{Contact}} from './components/Contact'
import {{Footer}} from './components/Footer'
export default function App(){{return <><header className="max-w-[1120px] mx-auto px-6 py-6 flex justify-between border-b"><span className="font-serif text-xl">{safe_bn}</span><a href="#kontakt" className="px-5 py-2 rounded-xl bg-black text-white text-sm">Kontakt</a></header><Hero/><Offer/><Pricing/><Testimonials/><Contact/><Footer/></>}}"""
    pkg = json.dumps({"name": f"{safe_bn.lower()}-site","private": True,"type": "module","scripts": {"dev": "vite","build": "tsc && vite build","preview": "vite preview"},"dependencies": {"react": "^18.2.0","react-dom": "^18.2.0","lucide-react": "^0.300.0"},"devDependencies": {"@types/react": "^18.2.0","@types/react-dom": "^18.2.0","@vitejs/plugin-react": "^4.2.0","autoprefixer": "^10.4.0","postcss": "^8.4.0","tailwindcss": "^3.4.0","typescript": "^5.3.0","vite": "^5.0.0"}}, ensure_ascii=False, indent=2)
    tsconfig = json.dumps({"compilerOptions": {"target": "ES2020","useDefineForClassFields": True,"lib": ["ES2020","DOM","DOM.Iterable"],"module": "ESNext","skipLibCheck": True,"moduleResolution": "bundler","allowImportingTsExtensions": True,"resolveJsonModule": True,"isolatedModules": True,"noEmit": True,"jsx": "react-jsx","strict": True,"noUnusedLocals": True,"noUnusedParameters": True,"noFallthroughCasesInSwitch": True},"include": ["src"],"references": [{"path": "./tsconfig.node.json"}]}, indent=2)
    tsconfig_node = json.dumps({"compilerOptions": {"composite": True,"skipLibCheck": True,"module": "ESNext","moduleResolution": "bundler","allowSyntheticDefaultImports": True},"include": ["vite.config.ts"]}, indent=2)
    vite_config = """import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({plugins:[react()]})"""
    tailwind_config = """/** @type {import('tailwindcss').Config} */
export default {content:["./index.html","./src/**/*.{ts,tsx}"],theme:{extend:{fontFamily:{serif:['Instrument Serif','serif']}}},plugins:[]}"""
    postcss_config = """export default {plugins:{tailwindcss:{},autoprefixer:{}}}"""
    # Preview-friendly standalone HTML (dla iframe srcDoc) — premium fallback, nie czarny tekst na bialym
    niche_lower = (niche or "").lower()
    is_cafe = any(k in niche_lower for k in ["kawiarni","cafe","coffee","barista"])
    is_restaurant = any(k in niche_lower for k in ["restaurac","gastronom","bistro","pizzeria","bar "])
    hero_img = "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1200&q=80" if is_cafe else ("https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80" if is_restaurant else "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80")
    hero_kicker = "Kawa specialty • Warszawa" if is_cafe else (bn + " • Warszawa")
    # dopracowany fallback: hero z obrazem + 3 filary + oferta + kontakt
    preview_html = f"""<!doctype html><html lang="pl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{title}</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500;700&display=swap" rel="stylesheet"><style>:root{{--paper:#fcfcf9;--ink:#131412;--line:#e7e5e0;--sage:#d8e4bc}}body{{font-family:'Inter',system-ui,sans-serif;background:var(--paper);color:var(--ink)}}h1,h2{{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.02em}}.morph-blob{{border-radius:42% 58% 60% 40% / 42% 42% 58% 58%;animation:morph 9s ease-in-out infinite}}@keyframes morph{{0%,100%{{border-radius:42% 58% 60% 40% / 42% 42% 58% 58%}}50%{{border-radius:58% 42% 40% 60% / 58% 60% 42% 42%}}}}</style></head><body class="antialiased">
<header class="max-w-[1120px] mx-auto px-6 py-5 flex items-center justify-between sticky top-0 bg-[var(--paper)]/80 backdrop-blur z-20 border-b border-[var(--line)]"><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-xl bg-black text-white grid place-items-center text-[10px] font-black">SM</div><span class="font-serif text-[15px] font-bold tracking-tight">{safe_bn}</span></div><nav class="hidden md:flex gap-6 text-xs font-semibold opacity-70"><a href="#oferta">Oferta</a><a href="#onas">O nas</a><a href="#kontakt">Kontakt</a></nav><a href="#kontakt" class="px-5 py-2.5 rounded-full bg-black text-white text-xs font-bold">Umów wizytę</a></header>
<section class="max-w-[1120px] mx-auto px-6 pt-8 md:pt-12 pb-10 grid md:grid-cols-12 gap-8 items-center relative overflow-hidden"><div class="absolute -top-10 -right-20 w-[380px] h-[380px] bg-gradient-to-tr from-amber-100 via-orange-50 to-amber-100 blur-3xl morph-blob opacity-60 pointer-events-none"></div><div class="md:col-span-6 relative"><p class="inline-flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase font-bold border border-[var(--line)] px-3 py-1.5 rounded-full bg-white"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> {hero_kicker}</p><h1 class="font-serif text-[40px] md:text-[52px] leading-[0.95] mt-5">{headline}</h1><p class="mt-4 text-[15px] leading-relaxed opacity-70 max-w-[44ch]">{desc}</p><div class="mt-7 flex flex-wrap gap-3"><a href="#kontakt" class="px-6 py-3 rounded-full bg-black text-white text-sm font-bold">Odwiedź nas</a><a href="#oferta" class="px-6 py-3 rounded-full border border-[var(--line)] bg-white text-sm font-bold">Zobacz menu</a></div><div class="mt-6 flex items-center gap-3 text-xs"><div class="flex -space-x-2"><span class="w-7 h-7 rounded-full bg-amber-200 border-2 border-white grid place-items-center text-[10px]">★</span><span class="w-7 h-7 rounded-full bg-neutral-800 text-white border-2 border-white grid place-items-center text-[10px]">5.0</span></div><span class="font-semibold">5,0 na Google • 1 opinia • Czynne całą dobę</span></div></div><div class="md:col-span-6 relative"><div class="rounded-[24px] overflow-hidden border border-[var(--line)] shadow-xl"><img src="{hero_img}" alt="{bn}" class="w-full h-[380px] object-cover"/><div class="p-4 bg-white flex items-center justify-between"><div><p class="text-xs font-bold opacity-60">Niemcewicza 3 • Warszawa</p><p class="text-sm font-bold">90-273 Łódź — QFF4+XM</p></div><span class="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold">Otwarte</span></div></div></div></section>
<section id="oferta" class="max-w-[1120px] mx-auto px-6 py-10 grid md:grid-cols-3 gap-5"><div class="rounded-2xl border border-[var(--line)] bg-white p-6"><p class="text-[11px] tracking-widest uppercase opacity-50 font-bold">01 — Kawa</p><h3 class="font-serif text-lg mt-2">Przelew & espresso</h3><p class="text-sm opacity-70 mt-2">Sezonowe ziarna, palone w Warszawie. V60, Chemex, batch brew.</p></div><div class="rounded-2xl border border-[var(--line)] bg-white p-6"><p class="text-[11px] tracking-widest uppercase opacity-50 font-bold">02 — Przestrzeń</p><h3 class="font-serif text-lg mt-2">Cisza w centrum</h3><p class="text-sm opacity-70 mt-2">Stolik do pracy, półka z książkami, szybkie Wi-Fi.</p></div><div class="rounded-2xl border border-[var(--line)] bg-white p-6"><p class="text-[11px] tracking-widest uppercase opacity-50 font-bold">03 — Ludzie</p><h3 class="font-serif text-lg mt-2">Barista na miejscu</h3><p class="text-sm opacity-70 mt-2">Opowiemy o pochodzeniu ziaren i zaparzymy pod Ciebie.</p></div></section>
<section id="onas" class="max-w-[720px] mx-auto px-6 pb-10"><div class="rounded-2xl border border-[var(--line)] bg-white p-8 flex flex-col md:flex-row gap-6 items-start"><img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" class="w-16 h-16 rounded-full object-cover"/><div><p class="text-sm leading-relaxed">„Moim zdaniem ta kawiarnia mi się bardzo podoba, bo można wypić różne kawy i miło spędzić czas.”</p><p class="text-xs font-bold mt-3 opacity-60">— Damian Żołądek • Lokalny przewodnik • 5.0 ★</p></div></div></section>
<section id="kontakt" class="max-w-[1120px] mx-auto px-6 pb-12"><div class="rounded-[24px] border border-[var(--line)] bg-black text-white p-8 md:p-10 flex flex-col md:flex-row justify-between gap-8"><div><h2 class="font-serif text-3xl">Wpadnij na kawę</h2><p class="opacity-70 mt-3 text-sm max-w-[36ch]">Niemcewicza 3, 00-336 Warszawa. Czynne całą dobę. Zadzwoń lub wpadnij bez rezerwacji.</p><a href="tel:+48220000000" class="inline-block mt-6 px-6 py-3 rounded-full bg-white text-black text-sm font-bold">Zadzwoń</a></div><div class="bg-white/10 rounded-2xl p-6 min-w-[220px]"><p class="text-xs uppercase tracking-widest opacity-60">Godziny</p><p class="text-sm mt-2 leading-relaxed">Codziennie 00:00–24:00<br/>Kuchnia do 22:00</p></div></div></section>
<footer class="border-t border-[var(--line)] py-8 text-center text-xs opacity-60">© {year} {bn} • Niemcewicza 3, Warszawa • Hot Fun Cafe</footer></body></html>"""
    readme = f"# {title}\n\nStrona wygenerowana przez SiteMorph AI (fallback Vite+React).\n\n## Uruchomienie\n```\ncd main/frontend && npm install && npm run dev\n```\nPreview: `main/frontend/preview.html`\n"
    return {
        "files": {
            "main/frontend/preview.html": preview_html,
            "main/frontend/index.html": index_html,
            "main/frontend/src/main.tsx": main_tsx,
            "main/frontend/src/App.tsx": app_tsx,
            "main/frontend/src/index.css": index_css,
            "main/frontend/src/components/Hero.tsx": hero_tsx,
            "main/frontend/src/components/Offer.tsx": offer_tsx,
            "main/frontend/src/components/Pricing.tsx": pricing_tsx,
            "main/frontend/src/components/Testimonials.tsx": testimonials_tsx,
            "main/frontend/src/components/Contact.tsx": contact_tsx,
            "main/frontend/src/components/Footer.tsx": footer_tsx,
            "main/frontend/src/ui/Button.tsx": button_tsx,
            "main/frontend/src/ui/Card.tsx": card_tsx,
            "main/frontend/src/ui/Container.tsx": container_tsx,
            "main/frontend/src/ui/Section.tsx": section_tsx,
            "main/frontend/src/hooks/useScrollReveal.ts": hook_ts,
            "main/frontend/src/lib/utils.ts": utils_ts,
            "main/frontend/src/types.ts": types_ts,
            "main/frontend/package.json": pkg,
            "main/frontend/tsconfig.json": tsconfig,
            "main/frontend/tsconfig.node.json": tsconfig_node,
            "main/frontend/vite.config.ts": vite_config,
            "main/frontend/tailwind.config.js": tailwind_config,
            "main/frontend/postcss.config.js": postcss_config,
            "main/frontend/public/favicon.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="black"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#a3e635" font-size="14" font-weight="900">SM</text></svg>',
            "main/frontend/README.md": readme,
            "main/package.json": json.dumps({"name": "sitemorph-site","private": True}, indent=2),
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
    try:
        sections_str = ", ".join(data.sections or [])
        
        # Określ nazwę pakietu na podstawie kredytów
        package_map = {
            "starter": "STARTER",
            "pro": "PRO", 
            "business": "BUSINESS",
            "agencja": "AGENCJA"
        }
        package_name = package_map.get((data.package or "starter").lower(), "STARTER")
        credits = data.credits or 10
        
        # SYSTEM_PROMPT zawiera {package_name} i {credits} — wypełnij je bezpiecznie (bez ruszenia JSONowych { })
        system_prompt_filled = SYSTEM_PROMPT.replace("{package_name}", package_name).replace("{credits}", str(credits))
        
        user_prompt = f"""Dane firmy / instrukcja od użytkownika:
---
BUSINESS_NAME: {data.business_name}
NICHE: {data.niche}
DESCRIPTION: {data.description}
STYLE: {data.style}
COLORS: {data.colors}
SECTIONS: {sections_str}
EXTRA: {data.extraPrompt or ''}
PACKAGE: {package_name} ({credits} kredytów)
---

Wygeneruj stronę zgodnie z SYSTEM_PROMPT: React + Vite + TypeScript + Tailwind project structure, polskie treści, premium design, dostosowane do pakietu {package_name}.
Jeśli w DESCRIPTION/EXTRA jest wklejony surowy tekst z Google Maps — wyciągnij z niego fakty i użyj ich na stronie.
NIE zadawaj pytań. Zwróć od razu kompletny JSON."""

        warning = None
        provider = "fallback"
        parsed_files = None
        parsed_meta = None

        # 1) Gemini (glowny provider) — max_tokens ograniczone pod 10s Vercel
        if GEMINI_API_KEY:
            text, err = gemini_generate(system_prompt_filled, user_prompt, max_tokens=14000)
            if text:
                try:
                    parsed = extract_json(text)
                    pfiles = parsed.get("files") or {}
                    if any(k.endswith(("index.html", "App.tsx", "main.tsx")) for k in pfiles):
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
                            {"role": "system", "content": system_prompt_filled},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.85,
                        "max_tokens": 8000,
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                content_text = resp.json()["choices"][0]["message"]["content"]
                parsed = extract_json(content_text)
                ofiles = parsed.get("files") or {}
                if any(k.endswith(("index.html", "App.tsx", "main.tsx")) for k in ofiles):
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
        return {"status": "success", "provider": provider, "warning": warning, "gemini_key_loaded": bool(GEMINI_API_KEY), "gemini_model": None, "content": {"hero": hero, "services": [], "pricing": []}, "files": parsed_files, "meta": meta}
    except Exception as e:
        import traceback
        print(f"[Builder] CRITICAL ERROR: {e}\n{traceback.format_exc()}", flush=True)
        try:
            fb = fallback_content(data)
            return {"status": "success", "provider": "fallback", "warning": f"Błąd krytyczny, użyto fallback: {str(e)[:200]}", "gemini_key_loaded": bool(GEMINI_API_KEY), "gemini_model": None, "content": {"hero": {"title": data.business_name, "subtitle": data.description[:120] if data.description else "", "cta_text": "Kontakt"}, "services": [], "pricing": []}, "files": fb["files"], "meta": fb["meta"]}
        except Exception as e2:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=500, content={"detail": f"Builder critical error: {str(e)[:300]} | fallback also failed: {str(e2)[:200]}"})
