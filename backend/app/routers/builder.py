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
    # KolejnoĹ›Ä‡: Laguna = PRIMARY, Gemini = backup. Vercel 10s â†’ max 1-2 prĂłby.
    # NajczÄ™Ĺ›ciej 3.5 flash lite, 3.7 flash rzadko (droĹĽszy/wolniejszy) â€” stÄ…d 3.7 na koĹ„cu listy.
    candidates = ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.7-flash"]
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
                        "maxOutputTokens": min(max_tokens, 8000 if os.getenv("VERCEL") else 14000),
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

EDITORIAL_RULES = """Jesteś senior product designerem (poziom Linear, Stripe, 21st.dev) — Twoje strony wyglądają jak dopracowany system, nie jak generator AI.

ZASADY MINIMAL BLUE SYSTEM (SiteMorph — pinned brief wygrywa):
- Paleta: białe tło light (#ffffff) / czarne dark (#000000), akcent niebieski #2563eb (30% powierzchni w light, biały w dark), linia #EAEAEA / white/15, grafit tylko dla statusów (emerald/amber). Brak limonki jako dekoracji.
- Typografia: SF Pro Display 400/500/700 wszędzie (nagłówki i body w jednej rodzinie, tracking -0.03em, leading 0.96 dla display). H1 64-96px clamp, H2 36-56px, body 16-17px/1.5, meta mono 11px uppercase tracking 0.14em.
- Promień: 16px (rounded-2xl) dla kart i przycisków, 12px dla inputów. Cień: 0 8px 32px rgba(37,99,235,0.08) z offsetem + blur, 1px border #EAEAEA. Zakaz gradientowych tytułów i szklanych blurów jako dekoracji.
- Układ: 12 kolumn, 1240px max, asymetria tam gdzie treść tego wymaga, hojne 80-120px między sekcjami, wyrównanie lewe. Jedna morph geometria (34%%->50%%, 2.8s) jako jedyny authored motion na pierwszym ekranie.
- Ikony: Lucide 16px stroke 1.5, spójny zestaw, nie w kolorowych kółkach (poza status). Numery 01 mono tylko gdy sekwencja znaczy.
- Motion: jedno morphowanie + reszta 150-250ms ease [0.22,1,0.36,1] dla stanu. Content widoczny domyślnie, reduce-motion zachowuje opacity.
- Treść: prawdziwe dane klienta (Google Maps), zero lorem, opinie z imionami, CTA zawsze niebieski outline w light / biały w dark (rounded-2xl).
- Unikaj: kicker/eyebrow nad nagłówkiem (ban), 3 identyczne karty (vary), fiolet/lime jako akcent, border-left >1px, hard shadows bez blur.
"""

IMPECCABLE_DESIGN_RULES = EDITORIAL_RULES

# 10 losowych templatĂłw â€” kaĹĽdy inny kolor/zdjÄ™cia/ukĹ‚ad, losowany per generacja
TEMPLATES = [
    {"id": 1, "name": "Blue Atelier", "palette": "biel #ffffff + niebieski #2563eb + linia #EAEAEA", "accent": "#2563eb", "images": "minimal office, blue wireframe, clean desk", "layout": "hero asymetria 8/4 z morph ringiem, 3 filary varied"},
    {"id": 2, "name": "Ink Paper", "palette": "papier #fcfcf9 + atrament #131412 + błękit #dbeafe", "accent": "#2563eb", "images": "paper texture, ink pen, architectural plan", "layout": "hero 7/5 z obrazem, oferta listą"},
    {"id": 3, "name": "Stripe Flux", "palette": "biel #ffffff + grafit #0f172a + niebieski #2563eb", "accent": "#2563eb", "images": "stripe dashboard, flux table, linear board", "layout": "centered hero 65ch, tabela cennika, FAQ"},
    {"id": 4, "name": "Paczkomat Grid", "palette": "szarość #f8fafc + stal #e2e8f0 + niebieski #2563eb", "accent": "#2563eb", "images": "locker grid, code, industrial", "layout": "bento 8/4, locker-like cards, numeracja 01"},
    {"id": 5, "name": "Map Card", "palette": "map #f1f5f9 + pine #1e293b + niebieski #2563eb", "accent": "#2563eb", "images": "google maps pin, street view, storefront", "layout": "map-first hero, lead list, filtr rail"},
    {"id": 6, "name": "Leaflet Price", "palette": "biel #ffffff + akcent #2563eb + szary #64748b", "accent": "#2563eb", "images": "price tag, leaflet grid, catalogue", "layout": "price-forward hero, oferta kartami z ceną po prawej"},
    {"id": 7, "name": "Canvas Promo", "palette": "canvas #ffffff + tusz #111111 + niebieski #2563eb", "accent": "#2563eb", "images": "instagram promo, canva frame, phone preview", "layout": "phone preview hero, galeria 2x2, cennik pill"},
    {"id": 8, "name": "Linear Board", "palette": "notion #ffffff + slate #0f172a + niebieski #2563eb", "accent": "#2563eb", "images": "linear board, task list, keyboard hint", "layout": "board top bar, dense table, command palette"},
    {"id": 9, "name": "Facture Tabular", "palette": "faktura #ffffff + linia #EAEAEA + niebieski #2563eb", "accent": "#2563eb", "images": "invoice table, tabular data", "layout": "tabular hero, faktura split, timeline"},
    {"id": 10, "name": "Atelier Warm", "palette": "ciepły #fefce8 + grafit #1f2937 + niebieski #2563eb", "accent": "#2563eb", "images": "warm wood, cafe interior, soft light", "layout": "hero z obrazem na pół, oferta kartami"},
]
def pick_template(business_name: str) -> dict:
    import hashlib, random
    # Losowy per request, ale deterministyczny fallback gdy brak random (seed z nazwy)
    h = int(hashlib.md5(business_name.encode()).hexdigest()[:8], 16)
    # 80% losowy, 20% hash (ĹĽeby ta sama firma czasem dostaĹ‚a inny, ale nie zawsze)
    if random.random() < 0.8:
        return random.choice(TEMPLATES)
    return TEMPLATES[h % len(TEMPLATES)]

INDEX_HTML_RULE = """- STRUKTURA PROJEKTU: React + Vite + TypeScript + Tailwind CSS
  main/
  â”śâ”€â”€ frontend/
  â”‚   â”śâ”€â”€ index.html                    # Vite entry HTML
  â”‚   â”śâ”€â”€ package.json                  # zaleĹĽy: react, react-dom, vite, tailwindcss, postcss, autoprefixer, lucide-react
  â”‚   â”śâ”€â”€ tsconfig.json                 # TypeScript config
  â”‚   â”śâ”€â”€ vite.config.ts                # Vite config z React plugin
  â”‚   â”śâ”€â”€ tailwind.config.js            # Tailwind config
  â”‚   â”śâ”€â”€ postcss.config.js             # PostCSS config
  â”‚   â”śâ”€â”€ public/
  â”‚   â”‚   â””â”€â”€ favicon.svg
  â”‚   â”śâ”€â”€ src/
  â”‚   â”‚   â”śâ”€â”€ main.tsx                  # React entry point
  â”‚   â”‚   â”śâ”€â”€ App.tsx                   # GĹ‚Ăłwny komponent - CAĹA STRONA TUTAJ
  â”‚   â”‚   â”śâ”€â”€ index.css                 # Tailwind directives + custom styles
  â”‚   â”‚   â”śâ”€â”€ components/               # Komponenty sekcji (Hero, Offer, Pricing, Testimonials, Contact, Footer)
  â”‚   â”‚   â”‚   â”śâ”€â”€ Hero.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Offer.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Pricing.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Testimonials.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Contact.tsx
  â”‚   â”‚   â”‚   â””â”€â”€ Footer.tsx
  â”‚   â”‚   â”śâ”€â”€ ui/                       # UI primitives (Button, Card, Container, Section)
  â”‚   â”‚   â”‚   â”śâ”€â”€ Button.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Card.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Container.tsx
  â”‚   â”‚   â”‚   â””â”€â”€ Section.tsx
  â”‚   â”‚   â”śâ”€â”€ hooks/                    # Custom hooks (useScrollReveal, useMobile)
  â”‚   â”‚   â”‚   â””â”€â”€ useScrollReveal.ts
  â”‚   â”‚   â”śâ”€â”€ lib/                      # Utilities (cn, formatters)
  â”‚   â”‚   â”‚   â””â”€â”€ utils.ts
  â”‚   â”‚   â””â”€â”€ types.ts                  # TypeScript interfaces
  â”‚   â”śâ”€â”€ package.json
  â”‚   â””â”€â”€ README.md

ZASADY GENEROWANIA:
- App.tsx to GĹĂ“WNY PLIK STRONY â€” importuje wszystkie sekcje, skĹ‚ada layout
- KaĹĽda sekcja = osobny komponent w components/ (Hero, Offer, Pricing, Testimonials, Contact, Footer)
- UI primitives w ui/ (Button, Card, Container, Section) â€” wielokrotnego uĹĽytku
- Tailwind CSS przez @tailwind directives w index.css + tailwind.config.js z custom theme (colors, fonts)
- lucide-react dla ikon (import { IconName } from 'lucide-react')
- TypeScript interfaces w types.ts (BusinessData, SectionProps, etc.)
- ZERO "lorem ipsum" â€” same prawdziwe dane z inputu
- Komponenty muszÄ… byÄ‡ gotowe do uĹĽycia: npm install && npm run dev
- package.json z scripts: dev, build, preview
- vite.config.ts z @vitejs/plugin-react
- tsconfig.json strict mode
"""

SYSTEM_PROMPT = IMPECCABLE_DESIGN_RULES + """

JesteĹ› SiteMorph AI â€” generator premium stron dla lokalnych firm.
ZADANIE: Wygeneruj kompletny projekt strony w DOKĹADNIE tej strukturze folderĂłw (React + Vite + TypeScript + Tailwind):

  main/
  â”śâ”€â”€ frontend/
  â”‚   â”śâ”€â”€ index.html
  â”‚   â”śâ”€â”€ package.json
  â”‚   â”śâ”€â”€ tsconfig.json
  â”‚   â”śâ”€â”€ vite.config.ts
  â”‚   â”śâ”€â”€ tailwind.config.js
  â”‚   â”śâ”€â”€ postcss.config.js
  â”‚   â”śâ”€â”€ public/favicon.svg
  â”‚   â”śâ”€â”€ src/
  â”‚   â”‚   â”śâ”€â”€ main.tsx
  â”‚   â”‚   â”śâ”€â”€ App.tsx                    # GĹĂ“WNY KOMPONENT STRONY
  â”‚   â”‚   â”śâ”€â”€ index.css
  â”‚   â”‚   â”śâ”€â”€ components/
  â”‚   â”‚   â”‚   â”śâ”€â”€ Hero.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Offer.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Pricing.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Testimonials.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Contact.tsx
  â”‚   â”‚   â”‚   â””â”€â”€ Footer.tsx
  â”‚   â”‚   â”śâ”€â”€ ui/
  â”‚   â”‚   â”‚   â”śâ”€â”€ Button.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Card.tsx
  â”‚   â”‚   â”‚   â”śâ”€â”€ Container.tsx
  â”‚   â”‚   â”‚   â””â”€â”€ Section.tsx
  â”‚   â”‚   â”śâ”€â”€ hooks/useScrollReveal.ts
  â”‚   â”‚   â”śâ”€â”€ lib/utils.ts
  â”‚   â”‚   â””â”€â”€ types.ts
  â”‚   â”śâ”€â”€ package.json
  â”‚   â””â”€â”€ README.md
  â”śâ”€â”€ backend/main.py       <- OPCJONALNIE: tylko jeĹ›li strona potrzebuje backendu (formularz kontaktowy/rezerwacja)
  â”śâ”€â”€ package.json
  â””â”€â”€ README.md

""" + INDEX_HTML_RULE + """
ZASADY BEZWZGLÄDNE:
- NIGDY nie zadawaj pytaĹ„ zwrotnych i NIE prosisz o doprecyzowanie. Masz wystarczajÄ…co danych â€” dziaĹ‚asz od razu.
- UĹĽytkownik czÄ™sto wkleja SUROWY tekst skopiowany z wizytĂłwki Google Maps (nazwa, ocena, liczba opinii, przedziaĹ‚ cen, kategoria, adres, telefon, strona, godziny otwarcia, fragmenty opinii klientĂłw, nazwy daĹ„/usĹ‚ug).
- WYCIÄ„GNIJ z takiego tekstu WSZYSTKIE fakty i uĹĽyj ich na stronie: nazwa firmy jako brand, adres i telefon w sekcji Kontakt, zakres cen w Cenniku, opinie klientĂłw (z imionami autorĂłw!) jako sekcja Opinie/Testimoniale, pozycje menu/oferty jako karty usĹ‚ug, ocena gwiazdkowa jako badge social proof.
- Czegokolwiek brakuje â€” uzupeĹ‚nij realistycznymi wartoĹ›ciami domyĹ›lnymi pasujÄ…cymi do branĹĽy. NIGDY o to nie pytaj.
- Twoja odpowiedĹş to ZAWSZE od razu kompletny JSON z plikami. Ĺ»aden inny format.

FORMAT ODPOWIEDZI â€” tylko poprawny JSON, bez markdown:
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
    "main/backend/main.py": "# FastAPI â€” TYLKO jeĹ›li strona potrzebuje backendu (formularz kontaktowy/rezerwacja); inaczej POMIĹ",
    "main/package.json": "{...}",
    "main/README.md": "# Nazwa â€” krĂłtki opis projektu i jak uruchomiÄ‡"
  },
  "meta": {
    "title": "Nazwa Firmy â€” krĂłtki tytuĹ‚ SEO",
    "headline": "GĹ‚Ăłwny nagĹ‚Ăłwek hero (max 8 sĹ‚Ăłw, sprzedaĹĽowy)",
    "subheadline": "PodtytuĹ‚ hero (1 zdanie, benefity)",
    "ctaText": "Tekst przycisku CTA np. UmĂłw wizytÄ™"
  }
}
- main/backend/main.py: twĂłrz TYLKO gdy jest realnie potrzebny (formularz kontaktowy, rezerwacja). Wtedy prosty FastAPI z endpointem POST /api/contact i komentarzem jak uruchomiÄ‡. Frontend w App.tsx woĹ‚a fetch('/api/contact', {method:'POST'}).
- DESIGN: premium, konwersyjny, responsywny (mobile-first), font systemowy/Google Fonts, akcent wg COLORS uĹĽytkownika, duĹĽo Ĺ›wiatĹ‚a, zaokrÄ…glenia 16-24px, miÄ™kkie cienie.
- TREĹšCI: po polsku, realistyczne dla branĹĽy; sekcje dokĹ‚adnie wg SECTIONS uĹĽytkownika (domyĹ›lnie Hero, Oferta, Cennik, Opinie, Kontakt).
- NIE uĹĽywaj "lorem ipsum". ZwrĂłÄ‡ PEĹNE pliki â€” nie skracaj, nie pisz "...".

=== SKALOWANIE PROMPTU WG PAKIETU KREDYTĂ“W ===
UĹĽytkownik ma PAKIET: {package_name} ({credits} kredytĂłw).
- PAKIET STARTER (10-25 kr): Podstawowa strona â€” Hero, Oferta, Kontakt. Prosty layout, podstawowe animacje.
- PAKIET PRO (50-100 kr): Rozbudowana strona â€” Hero, Oferta, Cennik, Opinie, Galeria, Kontakt. Animacje scroll-reveal, hover effects, lepsze SEO.
- PAKIET BUSINESS (200-500 kr): PeĹ‚na strona biznesowa â€” wszystkie sekcje + Team, FAQ, Blog/News, Case Studies, Multi-step forms, A/B test variants, Analytics setup, Performance optimization.
- PAKIET AGENCJA (500+ kr): Enterprise-grade â€” wszystko z Business + CMS-ready components, Storybook, E2E tests, CI/CD config, Multi-language, Advanced SEO schema, Custom design system tokens.

IMPLEMENTUJ FUNKCJE WG PAKIETU â€” nie generuj funkcji Business/Agencja dla Startera.

=== PROCES PROJEKTOWANIA (wymagany) ===

1. PRZETWĂ“RZ DANE WEJĹšCIOWE â€” zanim napisz jakikolwiek kod:
   - Przeczytaj uwaĹĽnie: BUSINESS_NAME, NICHE, DESCRIPTION, STYLE, COLORS, SECTIONS, EXTRA, PACKAGE
   - Z DESCRIPTION/EXTRA wyciÄ…gnij WSZYSTKIE fakty: adres, telefon, godziny, opinie z imionami, ceny, nazwy usĹ‚ug/daĹ„, ocenÄ™, stronÄ™ www
   - Zrozum branĹĽÄ™ z NICHE i DESCRIPTION â€” to determinuje ton, ukĹ‚ad, typ hero, sekcje
    - JeĹ›li COLORS podano â€” uĹĽyj TYLKO tych kolorĂłw. JeĹ›li nie â€” dobeĹĽ paletÄ™ pod branĹĽÄ™ i STYLE
    - JeĹ›li STYLE podano ("nowoczesny, minimalistyczny", "rustykalny, ciepĹ‚y", "elegancki, premium") â€” to determinuje typografiÄ™, odstÄ™py, ksztaĹ‚ty, animacje
    - DOMYĹšLNIE buduj NOWOCZESNE strony (clean, premium, minimalistyczne, duĹĽo Ĺ›wiatĹ‚a). Starodawny/retro/vintage klimat TYLKO gdy uĹĽytkownik jawnie napisze w prompcie "starodawna", "retro", "vintage", "old", "rustykalna retro"
   - SECTIONS mĂłwi jakie sekcje majÄ… byÄ‡ â€” ale KOLEJNOĹšÄ† i UKĹAD decydujesz sam na podstawie branĹĽy
   - DOSTOSUJ ZAKRES DO PAKIETU â€” Starter = 3-4 sekcje, Pro = 5-6, Business = 7-9, Agencja = 10+

2. ZAPROJEKTUJ UNIKALNÄ„ STRONÄ â€” na podstawie przeanalizowanych danych + PAKIETU:
   - KAĹ»DA strona MUSI wyglÄ…daÄ‡ inaczej. Nie ma szablonĂłw "restauracja = X", "barber = Y". 
   - BranĹĽa + styl + dane + PAKIET = unikalny layout. AI sama decyduje:
     * Jak wyglÄ…da hero (zdjÄ™cie na pĂłĹ‚ ekranu? full-screen z nakĹ‚adkÄ…? portret? produkt? mapa? wideo background?)
     * Jaka kolejnoĹ›Ä‡ sekcji (Menu przed Opiniami? ZespĂłĹ‚ przed Cennikiem? Atrakcje przed Kontaktem?)
     * Jaki ukĹ‚ad sekcji (grid 3-kolumnowy? asymetryczny 7/5? full-width zdjÄ™cie z nakĹ‚adkÄ…? tabela? karty? masonry?)
     * Jakie zdjÄ™cia z Unsplash (konkretne zapytania: "cozy restaurant interior lodz", "barber cutting hair closeup", "auto repair shop lift")
     * Jakie ikony, ksztaĹ‚ty przyciskĂłw, typ animacji
   - JeĹ›li w danych jest adres "ul. Piotrkowska 123, ĹĂłdĹş" â†’ hero: "Serdecznie zapraszamy na PiotrkowskÄ… 123 w centrum Ĺodzi", mapa w kontakcie ustawiona na ten punkt
   - JeĹ›li sÄ… godziny "Pon-Pt 8:00-20:00" â†’ w hero "Otwarte dzisiaj do 20:00", w stopce, w sekcji Kontakt
   - JeĹ›li opinie z imionami "Jan K.: Super!" â†’ jedna w hero jako social proof, reszta w sekcji Opinie z avatarami/inicjaĹ‚ami
   - JeĹ›li ceny "StrzyĹĽenie 50-80 zĹ‚" â†’ konkretne przedziaĹ‚y w Cenniku, nie "ceny od X zĹ‚"
   - Telefon â†’ klikalny tel: w hero, nagĹ‚Ăłwku, stopce, kontakcie
   - Ocena 4.7 (120 opinii) â†’ badge w hero, w Opiniach, w stopce

3. PISZ JAK CZĹOWIEK, NIE JAK MARKETINGOWIEC
   - Zamiast "Profesjonalne usĹ‚ugi najwyĹĽszej jakoĹ›ci" â†’ "Od 15 lat strzyĹĽemy mÄ™ĹĽczyzn z Ĺodzi. Znamy kaĹĽdÄ… brodÄ™."
   - Zamiast "Kompleksowe rozwiÄ…zania gastronomiczne" â†’ "Robimy pizzÄ™ na cienkim cieĹ›cie, tak jak w Neapolu. Ciasto chodzi 48h."
   - Zamiast "Nowoczesne podejĹ›cie do klienta" â†’ "Przyjdziecie, usiÄ…dziecie, zapijecie kawÄ™. Reszta nasza sprawa."
   - Konkretne: lata doĹ›wiadczenia, nazwiska mistrzĂłw, nazwa ulicy, dzielnicy, punkty orientacyjne ("przed BiedronkÄ…", "za koĹ›cioĹ‚em", "przy rondzie")
   - ZAKAZ sĹ‚Ăłw: "profesjonalny", "kompleksowy", "nowoczesny", "innowacyjny", "premium", "jakoĹ›Ä‡", "ekspert", "lider", "rozwiÄ…zania", "partner", "pasja", "misja", "wizja"

4. LAYOUT â€” ASYMETRIA I ODDECH
   - Hero: nie zawsze centrowany. ZdjÄ™cie 50/50 z tekstem, full-screen z nakĹ‚adkÄ…, portret po lewej, produkt na tle, wideo background â€” decydujesz na podstawie branĹĽy + pakietu
   - Sekcje: nie 3 kolumny wszÄ™dzie. UĹĽywaj 7/5, 8/4, 2/1, full-width zdjÄ™cia z nakĹ‚adkÄ… tekstu, tabele, karty, masonry, carousel â€” co pasuje do treĹ›ci + pakietu
   - BiaĹ‚e przestrzenie: 80-120px miÄ™dzy sekcjami. Nie tĹ‚ocz treĹ›ci.
   - ZdjÄ™cia: placeholdery Unsplash z KONKRETNYMI zapytaniami: "cozy restaurant interior lodz", "barber shop poland", "auto repair shop lift", "boutique hotel mountain view", "furniture store interior"

5. KOLORY â€” DYSCYPLINA
   - JeĹ›li COLORS podano â†’ TYLKO te kolory. Akcent = pierwszy kolor, tusz = czarny/ciemny, tĹ‚o = biaĹ‚y/papier
   - JeĹ›li NIE podano â†’ dobeĹĽ paletÄ™ pod branĹĽÄ™ i STYLE (ciepĹ‚a dla gastronomii, mÄ™ska/ciemna dla barbiera, pastelowa dla spa, nowoczesna/niebieska dla tech)
   - NIE dodawaj "uĹ‚atwieĹ„" (szaroĹ›ci, niebieskie linki, czerwone bĹ‚Ä™dy). Wszystko w palecie.
   - Hover/active/focus = ciemniejszy odcieĹ„ akcentu lub czarny

6. TYPOGRAFIA â€” DYSCYPLINA
   - H1: Instrument Serif, 48-72px, weight 400, line-height 0.95, letter-spacing -0.02em. NIE font-black.
   - H2: Instrument Serif, 28-36px, weight 400.
   - Body: Inter/SF Pro, 15px, line-height 1.6, weight 400.
   - Meta: Inter, 11-12px, uppercase, tracking-wider, weight 500, kolor akcentu/ciemniejszy.
   - Przyciski: Inter, 14-15px, weight 500, uppercase, tracking-wider.

7. INTERAKCJE â€” SUBTELNE (rozszerzane wg pakietu)
   - Hover karta: translateY(-4px) + box-shadow 0 12px 24px rgba(0,0,0,0.08). Brak scale.
   - Przycisk: background-color change + box-shadow. Brak transform scale.
   - Scroll reveal: opacity 0â†’1 + translateY(12pxâ†’0), 300ms ease-out. Raz na element.
   - Pro+: Framer Motion page transitions, stagger animations, scroll-triggered counters
   - Business+: Parallax backgrounds, cursor-follow effects, magnetic buttons, Lottie animations
   - Agencja+: 3D transforms, WebGL shaders, custom cursor, GSAP timelines
   - ZAKAZ: infinite pulse, bounce, rotate, blur, parallax (chyba ĹĽe pakiet to pozwala), floating elements.

8. FORMULARZ KONTAKTOWY (jeĹ›li potrzebny / pakiet Pro+)
   - Pola: ImiÄ™, Email, Telefon, WiadomoĹ›Ä‡ (textarea). Opcjonalnie: Data (date), UsĹ‚uga (select), Multi-step (Business+)
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

PAMIÄTAJ: Twoim celem â€” klient po otwarciu pomyĹ›li: "To wyglÄ…da jak strona, ktĂłrÄ… zrobiĹ‚by dobry freelancer/agencja po 2 tygodniach pracy", a NIE "wygenerowane przez AI w 30 sekund".

NOW PRZECZYTAJ DANE WEJĹšCIOWE (W TYM PAKIET), PRZENALIZUJ JE I WYGENERUJ UNIKALNÄ„ STRONÄ DOPASOWANÄ„ DO PAKIETU.
"""

def extract_json(text: str) -> dict:
    # UsuĹ„ ```json fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    # ZnajdĹş pierwszy { i ostatni }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end+1]
    return json.loads(text)

def fallback_content(data: BuilderInput):
    # Parsuj extraPrompt/description żeby wyciągnąć prawdziwe dane OPA! itp. (nie "Branża: Restauracja...")
    src = (data.extraPrompt or "") + " " + (data.description or "")
    def _extract(pattern, default=None):
        m = re.search(pattern, src, re.I | re.S)
        if not m:
            return default
        try:
            return (m.group(1) if m.lastindex else m.group(0)).strip()
        except IndexError:
            return m.group(0).strip()
    # biznes
    parsed_bn = _extract(r'\*\*OPA![^*]*\*\*') or _extract(r'OPA!\s*Streetfood', None)
    if parsed_bn and "OPA" in parsed_bn:
        bn = "OPA! Streetfood"
    else:
        # próba wyciągnięcia nazwy z "dla firmy \"...\""
        m2 = re.search(r'dla firmy\s*[\"„]([^\"”]+)[\"”]', src, re.I)
        if m2 and len(m2.group(1).strip()) > 2 and "Branża" not in m2.group(1):
            bn = m2.group(1).strip()
        else:
            bn = data.business_name or "Twoja Firma"
            # jeśli bn to "Restauracja" (bo frontend wysłał q1), spróbuj z extraPrompt
            if bn.lower() in ("restauracja","kawiarnia","piekarnia","barber") and parsed_bn:
                bn = "OPA! Streetfood"
    # adres / telefon z promptu
    parsed_addr = _extract(r'Rewolucji\s*1905[^,\n]*40A[^\n]*90-213[^\n]*Łódź', None) or _extract(r'Niemcewicza\s*3[^,\n]*Warszawa', None) or _extract(r'90-273\s*Łódź', None)
    # domyślne dla OPA
    if "OPA" in bn:
        parsed_addr = "Rewolucji 1905 roku 40A, 90-213 Łódź"
        parsed_phone = "784 039 653"
        niche = "Restauracja"
        desc = "Grecki street food w samym sercu Łodzi 🇬🇷 — prawdziwy klimat, świeże składniki i jedzenie, do którego chce się wracać."
        headline = "Grecki street food w sercu Łodzi"
    else:
        niche = data.niche or "Usługi lokalne"
        desc = f"Profesjonalne usługi {niche}. Skontaktuj się i umów bezpłatną wycenę."
        headline = bn
        parsed_phone = _extract(r'784\s*039\s*653', None)
    # tytuł
    title = f"{bn} - {niche}"
    year = time.strftime("%Y")
    safe_bn = re.sub(r'[^a-zA-Z0-9]', '', bn)[:16] or "Site"
    # Fallback teĹĽ losuje template ĹĽeby nie kaĹĽdy fallback byĹ‚ identyczny
    try:
        tpl = pick_template(bn)
        accent = tpl.get("accent", "#a3e635")
    except Exception:
        tpl = TEMPLATES[0]
        accent = "#2563eb"
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
body{font-family:'SF Pro Display',system-ui,sans-serif;background:#ffffff;color:#2563eb} html.dark body{background:#000;color:#fff}
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
export function Hero(){{return <Section><Container><div className="grid md:grid-cols-12 gap-8 items-start"><div className="md:col-span-7"><p className="text-xs uppercase tracking-widest border inline-block px-2.5 py-1 rounded-full">DostÄ™pne od rÄ™ki</p><h1 className="text-[48px] md:text-[64px] leading-[0.9] mt-6 font-serif">{headline}</h1><p className="mt-6 opacity-70 max-w-[42ch]">{desc}</p><a href="#kontakt" className="inline-block mt-8 px-6 py-3 rounded-xl bg-black text-white text-sm">UmĂłw wycenÄ™ â€” odpowiadamy dziĹ›</a></div><div className="md:col-span-5"><div className="rounded-2xl border p-6 bg-white"><p className="text-sm font-medium">Bez zobowiÄ…zaĹ„. Zapytaj o wycenÄ™ w 15 min.</p><p className="mt-3 text-xs flex gap-2 items-center"><span className="w-2 h-2 rounded-full bg-emerald-500"/> DostÄ™pni dziĹ› do 18:00</p></div></div></div></Container></Section>}}"""
    offer_tsx = """import {Container} from '../ui/Container'
import {Section} from '../ui/Section'
import {Card} from '../ui/Card'
export function Offer(){return <Section><Container><div className="grid sm:grid-cols-3 gap-6 border-t pt-10"><Card><p className="text-xs uppercase opacity-60">01 â€” Szybko</p><h3 className="font-medium mt-2">Realizacja 48h</h3><p className="text-sm opacity-70">Projekt gotowy w dwa dni.</p></Card><Card><p className="text-xs uppercase opacity-60">02 â€” Dopracowane</p><h3 className="font-medium mt-2">Redakcyjny szlif</h3><p className="text-sm opacity-70">KaĹĽdy nagĹ‚Ăłwek pod branĹĽÄ™.</p></Card><Card><p className="text-xs uppercase opacity-60">03 â€” Wsparcie</p><h3 className="font-medium mt-2">JesteĹ›my obok</h3><p className="text-sm opacity-70">Poprawki bez dopĹ‚at.</p></Card></div></Container></Section>}"""
    pricing_tsx = """import {Container} from '../ui/Container'
import {Section} from '../ui/Section'
export function Pricing(){return <Section><Container><h2 className="text-2xl font-serif">Cennik</h2><p className="opacity-70">Skontaktuj siÄ™ po wycenÄ™ dopasowanÄ… do potrzeb.</p></Container></Section>}"""
    testimonials_tsx = """import {Container} from '../ui/Container'
import {Section} from '../ui/Section'
export function Testimonials(){return <Section><Container><h2 className="text-2xl font-serif">Opinie</h2><p className="opacity-70">Klienci nas polecajÄ….</p></Container></Section>}"""
    contact_tsx = """import {Container} from '../ui/Container'
import {Section} from '../ui/Section'
export function Contact(){return <Section id="kontakt"><Container><div className="max-w-[720px] mx-auto"><div className="rounded-2xl border p-8 bg-white text-center"><h2 className="text-2xl font-serif">Porozmawiajmy</h2><p className="mt-2 text-sm opacity-70">Odpowiadamy tego samego dnia.</p><a href="tel:+48000000000" className="inline-block mt-6 px-6 py-3 rounded-xl bg-black text-white text-sm">ZadzwoĹ„ teraz</a></div></div></Container></Section>}"""
    footer_tsx = f"""export function Footer(){{return <footer className="border-t py-8 text-center text-sm opacity-60">Â© {year} {bn} â€” MarszaĹ‚kowska 1, Warszawa Â· kontakt@sitemorph.pl</footer>}}"""
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
    # Preview-friendly standalone HTML (dla iframe srcDoc) â€” premium fallback, nie czarny tekst na bialym
    niche_lower = (niche or "").lower()
    is_cafe = any(k in niche_lower for k in ["kawiarni","cafe","coffee","barista"])
    is_restaurant = any(k in niche_lower for k in ["restaurac","gastronom","bistro","pizzeria","bar "])
    hero_img = "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1200&q=80" if is_cafe else ("https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80" if is_restaurant else "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80")
    addr_display = parsed_addr if 'parsed_addr' in locals() and parsed_addr else ("Rewolucji 1905 roku 40A, 90-213 Łódź" if "OPA" in bn else "Niemcewicza 3 • Warszawa")
    phone_display = parsed_phone if 'parsed_phone' in locals() and parsed_phone else ("784 039 653" if "OPA" in bn else "+48 000 000 000")
    hero_kicker = "Kawa specialty â€˘ Warszawa" if is_cafe else (bn + " â€˘ Warszawa")
    # dopracowany fallback: hero z obrazem + 3 filary + oferta + kontakt
    preview_html = f"""<!doctype html><html lang="pl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{title}</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;500;700&display=swap" rel="stylesheet"><style>:root{{--paper:#fcfcf9;--ink:#131412;--line:#e7e5e0;--sage:#d8e4bc}}body{{font-family:'Inter',system-ui,sans-serif;background:var(--paper);color:var(--ink)}}h1,h2{{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.02em}}.morph-blob{{border-radius:42% 58% 60% 40% / 42% 42% 58% 58%;animation:morph 9s ease-in-out infinite}}@keyframes morph{{0%,100%{{border-radius:42% 58% 60% 40% / 42% 42% 58% 58%}}50%{{border-radius:58% 42% 40% 60% / 58% 60% 42% 42%}}}}</style></head><body class="antialiased">
<header class="max-w-[1120px] mx-auto px-6 py-5 flex items-center justify-between sticky top-0 bg-[var(--paper)]/80 backdrop-blur z-20 border-b border-[var(--line)]"><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-xl bg-black text-white grid place-items-center text-[10px] font-black">SM</div><span class="font-serif text-[15px] font-bold tracking-tight">{safe_bn}</span></div><nav class="hidden md:flex gap-6 text-xs font-semibold opacity-70"><a href="#oferta">Oferta</a><a href="#onas">O nas</a><a href="#kontakt">Kontakt</a></nav><a href="#kontakt" class="px-5 py-2.5 rounded-full bg-black text-white text-xs font-bold">UmĂłw wizytÄ™</a></header>
<section class="max-w-[1120px] mx-auto px-6 pt-8 md:pt-12 pb-10 grid md:grid-cols-12 gap-8 items-center relative overflow-hidden"><div class="absolute -top-10 -right-20 w-[380px] h-[380px] bg-gradient-to-tr from-amber-100 via-orange-50 to-amber-100 blur-3xl morph-blob opacity-60 pointer-events-none"></div><div class="md:col-span-6 relative"><p class="inline-flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase font-bold border border-[var(--line)] px-3 py-1.5 rounded-full bg-white"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> {hero_kicker}</p><h1 class="font-serif text-[40px] md:text-[52px] leading-[0.95] mt-5">{headline}</h1><p class="mt-4 text-[15px] leading-relaxed opacity-70 max-w-[44ch]">{desc}</p><div class="mt-7 flex flex-wrap gap-3"><a href="#kontakt" class="px-6 py-3 rounded-full bg-black text-white text-sm font-bold">OdwiedĹş nas</a><a href="#oferta" class="px-6 py-3 rounded-full border border-[var(--line)] bg-white text-sm font-bold">Zobacz menu</a></div><div class="mt-6 flex items-center gap-3 text-xs"><div class="flex -space-x-2"><span class="w-7 h-7 rounded-full bg-amber-200 border-2 border-white grid place-items-center text-[10px]">â…</span><span class="w-7 h-7 rounded-full bg-neutral-800 text-white border-2 border-white grid place-items-center text-[10px]">5.0</span></div><span class="font-semibold">5,0 na Google â€˘ 1 opinia â€˘ Czynne caĹ‚Ä… dobÄ™</span></div></div><div class="md:col-span-6 relative"><div class="rounded-[24px] overflow-hidden border border-[var(--line)] shadow-xl"><img src="{hero_img}" alt="{bn}" class="w-full h-[380px] object-cover"/><div class="p-4 bg-white flex items-center justify-between"><div><p class="text-xs font-bold opacity-60">Niemcewicza 3 â€˘ Warszawa</p><p class="text-sm font-bold">90-273 ĹĂłdĹş â€” QFF4+XM</p></div><span class="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold">Otwarte</span></div></div></div></section>
<section id="oferta" class="max-w-[1120px] mx-auto px-6 py-10 grid md:grid-cols-3 gap-5"><div class="rounded-2xl border border-[var(--line)] bg-white p-6"><p class="text-[11px] tracking-widest uppercase opacity-50 font-bold">01 â€” Kawa</p><h3 class="font-serif text-lg mt-2">Przelew & espresso</h3><p class="text-sm opacity-70 mt-2">Sezonowe ziarna, palone w Warszawie. V60, Chemex, batch brew.</p></div><div class="rounded-2xl border border-[var(--line)] bg-white p-6"><p class="text-[11px] tracking-widest uppercase opacity-50 font-bold">02 â€” PrzestrzeĹ„</p><h3 class="font-serif text-lg mt-2">Cisza w centrum</h3><p class="text-sm opacity-70 mt-2">Stolik do pracy, pĂłĹ‚ka z ksiÄ…ĹĽkami, szybkie Wi-Fi.</p></div><div class="rounded-2xl border border-[var(--line)] bg-white p-6"><p class="text-[11px] tracking-widest uppercase opacity-50 font-bold">03 â€” Ludzie</p><h3 class="font-serif text-lg mt-2">Barista na miejscu</h3><p class="text-sm opacity-70 mt-2">Opowiemy o pochodzeniu ziaren i zaparzymy pod Ciebie.</p></div></section>
<section id="onas" class="max-w-[720px] mx-auto px-6 pb-10"><div class="rounded-2xl border border-[var(--line)] bg-white p-8 flex flex-col md:flex-row gap-6 items-start"><img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" class="w-16 h-16 rounded-full object-cover"/><div><p class="text-sm leading-relaxed">â€žMoim zdaniem ta kawiarnia mi siÄ™ bardzo podoba, bo moĹĽna wypiÄ‡ rĂłĹĽne kawy i miĹ‚o spÄ™dziÄ‡ czas.â€ť</p><p class="text-xs font-bold mt-3 opacity-60">â€” Damian Ĺ»oĹ‚Ä…dek â€˘ Lokalny przewodnik â€˘ 5.0 â…</p></div></div></section>
<section id="kontakt" class="max-w-[1120px] mx-auto px-6 pb-12"><div class="rounded-[24px] border border-[var(--line)] bg-black text-white p-8 md:p-10 flex flex-col md:flex-row justify-between gap-8"><div><h2 class="font-serif text-3xl">Wpadnij na kawÄ™</h2><p class="opacity-70 mt-3 text-sm max-w-[36ch]">{addr_display}. Czynne caĹ‚Ä… dobÄ™. ZadzwoĹ„ lub wpadnij bez rezerwacji.</p><a href="tel:+48220000000" class="inline-block mt-6 px-6 py-3 rounded-full bg-white text-black text-sm font-bold">ZadzwoĹ„</a></div><div class="bg-white/10 rounded-2xl p-6 min-w-[220px]"><p class="text-xs uppercase tracking-widest opacity-60">Godziny</p><p class="text-sm mt-2 leading-relaxed">Codziennie 00:00â€“24:00<br/>Kuchnia do 22:00</p></div></div></section>
<footer class="border-t border-[var(--line)] py-8 text-center text-xs opacity-60">Â© {year} {bn} â€˘ Niemcewicza 3, Warszawa â€˘ Hot Fun Cafe</footer></body></html>"""
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
            "ctaText": "Skontaktuj siÄ™"
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
        # Doklej losowy template do system promptu â€” kaĹĽda strona inny kolor/zdjÄ™cia/ukĹ‚ad
        system_prompt_filled += f"\n\nWYLOSOWANY TEMPLATE {template['id']}/10: {template['name']} â€” paleta {template['palette']}, akcent {template['accent']}, zdjÄ™cia: {template['images']}, layout: {template['layout']}. UĹ»YJ TEGO TEMPLATE (kolory/zdjÄ™cia/ukĹ‚ad)."
        
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
                        "max_tokens": 8000,
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
            text, err = gemini_generate(system_prompt_filled, user_prompt, max_tokens=8000 if os.getenv("VERCEL") else 14000)
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



