# SiteMorph — aktywny kontrakt generatora

Prompt: `sitemorph-spec-2`. Kompilator designu: `sitemorph-design-compiler-2`.
Kompilator podglądu: `sitemorph-esbuild-3`.
Baza zmian: archiwum repozytorium z commita `f81a8bf7f48ce9f4a72b110b6fbd69968050cb27`.

## Przepływ

`prompt + jawne preferencje + zdjęcia → jeden request DeepSeek → SiteMorphSpecV2 → walidacja → równoległy dobór zdjęć → Design Compiler → komponenty React → esbuild-wasm → iframe → zapis → publikacja tego samego artefaktu`

Model planuje markę, kompozycję, treść i interakcje. Kompilator tworzy React/CSS ze sprawdzonych komponentów. To świadoma zmiana względem pełnego codegen, wynikająca z ostatniego załącznika.

Normalne `POST /api/builder/generate` wykonuje dokładnie jeden request HTTP do modelu, również w trybach ultra/ultra+. Nie uruchamia osobnego parsera AI, stratega, krytyka, revision, continuation ani AI preview. Nie ponawia automatycznie 429/5xx/timeout i nie zwraca zastępczej strony jako sukcesu.

Model: `deepseek/deepseek-v4-pro`. Sufit: 32000 tokenów, bez obniżenia do 16k w normalnej ścieżce. Prompt prosi o zwięzły plan, zwykle 2500–5000 tokenów, nie o wypełnienie limitu. Koszty trybów istniejącego interfejsu pozostały bez zmian; wyższy tryb obecnie nie uruchamia dodatkowego procesu AI.

## Kanoniczny kontrakt

| Plik w backend/app/design | Odpowiedzialność |
| --- | --- |
| schema.py | Pydantic 2; odrzucanie nieznanych pól |
| props.py | Dokładne typy danych każdego komponentu |
| validation.py | Fonty, media, odwołania, sekcje, interakcje i podstawowe powtórzenia |
| prompt.py | Instrukcje semantycznego projektowania |
| fonts.py | 24 rodziny; maksymalnie dwie na stronę |
| tokens.py | Rzeczywiste zmienne CSS, kontrast, skala, odstępy i motion |
| assets.py | Dobór zdjęć i fallback kompozycji |
| compiler.py | Tworzenie pełnego projektu React |

Główne pola: `meta`, `businessBrief`, `creative`, `semanticProfile`, `tokens`, `assetPlan`, `pagePlan`, `interactions`, `mobile`, `validationHints`. `meta.schemaVersion` to `"2.0"`. To inny kontrakt niż historyczny JSON zawierający kod `files`. Stare projekty z zapisanymi plikami pozostają obsługiwane.

## Design i runtime

Plan ma 3–12 sekcji; nie ma stałej listy dla każdej branży. Nawigacja i footer są dodawane przez runtime.

15 komponentów w `backend/app/design_runtime/`: ImmersiveHero, EditorialHero, TypeDrivenHero, ProductStage, EditorialSplit, ImageBreak, ProductRail, StorySpread, StickyNarrative, HorizontalGallery, EditorialMenu, LocationCanvas, CTASection, FAQSection i ContactSection.

14 nazw rodzin hero mapuje się na cztery komponenty hero i ich warianty: asymetria, plakat, editorial, warstwowe zdjęcie/tekst, ekspozycja produktu i immersyjne zdjęcie. Nie jest to 14 osobnych szablonów biznesowych.

Fonty, skala, casing, tła, przyciski, radii, kadrowanie, szerokość, gęstość, kompozycja i motion są rzeczywiście używane w kodzie. `design_bindings` pokazuje zastosowane wartości. Koncept i uzasadnienia pozostają metadanymi, nie dowodem oceny wizualnej.

CSS ma warstwy reset/base/layout/components/responsive. Zawartość jest domyślnie widoczna. Jeden IntersectionObserver obsługuje wybrane reveal; parallax ma jeden listener/requestAnimationFrame, maksymalnie dwa zdjęcia i małe przesunięcie. Zmiana prefers-reduced-motion anuluje animacje. Mobile zmienia kolejność, grid i kadrowanie.

Google Fonts ładuje najwyżej dwie rodziny, po najwyżej dwie wagi, z display=swap. Biblioteka zawiera serif, sans, condensed i monospace; font wyłącznie nagłówkowy nie może trafić do akapitów. W razie braku sieci pozostaje właściwa rodzina zastępcza.

## Fakty, zdjęcia i zachowanie

Prompt zakazuje wymyślania ocen, opinii, cen, nagród, adresów, telefonów, godzin i integracji. Nie oznacza to automatycznej weryfikacji faktów w internecie. Model zapisuje założenia i brakujące dane; właściciel sprawdza treść przed publikacją.

Każde CTA ma poprawne odwołanie do sekcji albo HTTPS/tel/mailto. Zakładki działają klawiaturą, galeria obsługuje Escape i powrót fokusu, FAQ używa details, karuzela przewija. Formularz mailto wymaga podanego adresu i otwiera program pocztowy odwiedzającego. Nie udaje serwerowej wysyłki, rezerwacji ani płatności.

Model dostaje adresy i nazwy przesłanych zdjęć; nie jest to multimodalna analiza ich zawartości. Pozostałe zdjęcia używają `asset:id`. Maksymalnie osiem wyszukiwań Unsplash wykonuje się równolegle; cache metadanych ma TTL 30 minut. Wyniki są deduplikowane, filtrowane negatywnymi słowami i wymaganiami produktu. Dla mochi/matcha/sakura wymagana jest obecność odpowiedniego słowa w metadanych. Nie ma katalogu przypadkowych deserów.

Brak zdjęcia głównego zmienia kompozycję na TypeDrivenHero. Uszkodzone zdjęcie w EditorialHero/ImmersiveHero uruchamia fallback również w przeglądarce. Pozostałe brakujące media są pomijane. Brakującego produktu nie zastępuje dekoracyjny blob.

Raport zdjęć bazuje na dostarczonych plikach i metadanych wyszukiwania, nie na modelu vision. Unsplash zachowuje hotlink, autorstwo, responsywne rozmiary i tracking pobrania w tle. Media poza hero ładują się leniwie.

## Pliki, preview i publish

Projekt zawiera wymagane `package.json`, `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx` pod `main/frontend/`, a także `src/data/site.json`, osobne `src/sections/`, `src/runtime/` i tsconfig. App składa sekcje. Projekt działa też samodzielnie z Vite przez npm install i npm run dev/build.

esbuild-wasm buduje prawdziwy graf importów wraz z CSS, CSS Modules, JSON i lokalnymi SVG. Zachowuje fonty, język, tytuł i metadane index.html. Nie używa Sandpack, CodeSandbox, Nodebox ani AI preview.html. Import map ma przypięte wersje bibliotek. Preview nadal potrzebuje sieci do esm.sh, Google Fonts i zewnętrznych zdjęć.

Artefakt zawiera HTML, hash źródeł, buildId, wersję i czas bundlowania. POST/PATCH zapisuje pełne pliki, spec i artefakt. Serwer odrzuca niezgodny hash oraz publikację cudzego projektu. Publikacja podaje identyfikator i hashe zapisanej wersji; backend zwraca dokładnie zapisane bajty HTML bez AI i bez ponownej kompilacji. Zewnętrzne zasoby pozostają sieciowe.

Iframe i publikacja mają sandbox bez allow-same-origin. Wiadomości podglądu sprawdzają źródłowe okno i buildId. Gotowość wynika z montażu React i oczekiwania na fonty. Błąd kompilacji lub montażu zachowuje poprzednią stronę. Identyczny wynik z cache również dostaje nowy montaż iframe.

## Testy i ograniczenia

Backend sprawdza kontrakt, pięć branż, transport bez retry, kontrast, zdjęcia, autoryzację, upload, własność, zapis, odrzucenie starego artefaktu i publikację tych samych bajtów.

Przeglądarka sprawdza realny esbuild/React, CSS/importy/fonty, desktop/mobile, CTA, menu, tabs, galerię, FAQ, przewijanie, formularz, reduced motion, awarię zdjęcia, ponowne otwarcie projektu i błędy. Odpowiedzi AI są kontrolowane. Obrazy oznaczone PHOTO FIXTURE służą do regresji, nie są przykładem doboru zdjęć przez AI.

P50/P95 z pięciu przypadków to mała próba regresyjna, nie SLA. `designCompileMs` obejmuje walidację i kompilator, `bundleMs` — esbuild. Produkcyjne `model_ms`/`model_and_spec_ms` obejmuje request i walidację spec; `client_total_ms` — od kliknięcia do montażu. Bez żywego XKIRO nie potwierdzono pełnej generacji poniżej 60 sekund.

Nie dodano katalogu setek referencji, wyszukiwarki wzorców, automatycznego krytyka vision, CMS ani płatności klientów. Załącznik opisuje je jako oddzielne etapy. quality_review zawiera wejście do ręcznego/przyszłego review i jawne `visual_review_performed:false`, bez fikcyjnej oceny 9/10. Nie twierdzimy, że znamy wewnętrzną architekturę Emergent.

Dokumentacja użyta przy naprawach:
[esbuild w przeglądarce](https://esbuild.github.io/api/#browser),
[CSS w esbuild](https://esbuild.github.io/content-types/#css),
[Unsplash API](https://unsplash.com/documentation).
