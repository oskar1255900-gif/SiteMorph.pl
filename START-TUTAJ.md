# SiteMorph — poprawione pliki

Komplet źródeł na podstawie Twojego ZIP-a z commita `f81a8bf`. To rzeczywiste zmiany w plikach, nie sam prompt ani pusty commit. Nie zostały automatycznie wysłane na GitHub ani wdrożone na produkcję.

## Zastosowanie

Paczka zawiera pełny folder `SiteMorph/` oraz `SiteMorph-poprawki.patch`. Wybierz jedną metodę.

W istniejącym repozytorium przekaż Freebuffowi patch i tę instrukcję. Niech sprawdzi lokalny diff, utworzy gałąź, zastosuje zmiany, zainstaluje zależności i wykona testy. Patch jest względem `f81a8bf`; nowszych zmian nie należy nadpisywać w ciemno.

```bash
git status --short
git switch -c fix/design-compiler-v2
git apply --check /sciezka/do/SiteMorph-poprawki.patch
git apply /sciezka/do/SiteMorph-poprawki.patch
git diff --stat
```

Jeśli `--check` wykryje konflikt, Freebuff powinien połączyć zmiany z Twoją wersją, korzystając z pełnego folderu `SiteMorph/`. Nie usuwaj własnych zmian przez `git reset --hard`.

Możesz też uruchomić rozpakowany `SiteMorph/` jako osobną kopię. Zależności i prywatne konfiguracje nie są dołączone; użyj swoich dotychczasowych ustawień.

## Uruchomienie

Backend, terminal 1, z folderu `SiteMorph/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

Windows: aktywacja to `.venv\Scripts\activate`.

Frontend, terminal 2:

```bash
cd frontend
npm ci
npm run dev
```

Nie nadpisuj istniejących `.env` plikami przykładów. Zachowaj bazę i Supabase. Generator wymaga backendowego `XKIRO_API_KEY`; domyślnie używa `https://api.xkiro.com/v1`, `deepseek/deepseek-v4-pro` i limitu 32000 tokenów. OpenRouter nie zastępuje klucza XKIRO tej ścieżki. `UNSPLASH_ACCESS_KEY` jest opcjonalny: bez niego dodaj własne zdjęcia albo strona oprze się na typografii. Użytkownik musi być zalogowany.

Na produkcji zaktualizuj backend i frontend, zainstaluj zależności oraz wykonaj nowy build. Zachowane są dotychczasowe usługi Vercel; `/p/...` kieruje do backendu. Nie ma wymaganej migracji tabel projektu. Nie sprawdzono Twojego konkretnego konta hostingowego.

## Najważniejsze zmiany

- Jeden request zwraca zwięzły plan; kompilator tworzy pełny, komponentowy React.
- 24 rodziny fontów, kontrola kontrastu, różne hero i kompozycje sekcji, osobny układ mobile.
- 15 komponentów z działającym menu, CTA, zakładkami, galerią, FAQ, przewijaniem i kontaktem mailto.
- Poprawne importy CSS i fontów w esbuild-wasm; preview i publish używają tego samego zapisanego HTML.
- Równoległy dobór zdjęć, brak losowych deserów zamiast mochi, fallback typograficzny i autorstwo fotografii.
- Zapis pełnych plików/specyfikacji, powrót do projektu, obsługa identycznych wyników z cache i zachowanie poprzedniej strony przy błędzie.
- Bez ukrytego retry, sztucznego postępu i udawanej oceny jakości. Czas mierzony do rzeczywistego montażu React.

Dokładny kontrakt i ograniczenia opisuje `contracts.md`.

## Weryfikacja

Z głównego folderu, w aktywnym środowisku Python:

```bash
python -m pip install -r backend/requirements-dev.txt
PYTHONPATH=backend DATABASE_URL=sqlite:///:memory: python -m pytest backend/tests -q
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run build
```

Test przeglądarki wymaga Chromium i lokalnego fontu TTF/WOFF2:

```bash
# Z folderu głównego:
PYTHONPATH=backend python backend/tests/export_design_fixtures.py
cd frontend
npx playwright install chromium
TEST_DESIGN_V2=1 TEST_FONT_PATH=/pelna/sciezka/do/fontu.ttf npm run test:preview
```

Opcjonalne `TEST_FONT_ROOT` wskazuje katalog `@fontsource` z rodzinami testu. Bez niego test używa podanego fontu jako kontrolowanego zamiennika. `PLAYWRIGHT_EXECUTABLE_PATH` pozwala wskazać zainstalowany Chromium. Wyniki i zrzuty są w `frontend/test-results/`. Obrazy PHOTO FIXTURE i ręczne specyfikacje sprawdzają runtime; nie są oceną wyników samego DeepSeek.

Po testach dodaj rzeczywiście zmienione pliki do commita zgodnie ze swoim przepływem Git. `git diff --cached --stat` powinien je pokazać. Samo `git commit` bez `git add` nie zapisze plików.

## Czas działania

Największa oszczędność to krótsza odpowiedź modelu: spec zamiast całego React/CSS. Kompilator podglądu rozgrzewa się wcześniej i ma cache, a wyszukiwania zdjęć są równoległe.

Testy uruchomiły prawdziwą kompilację i przeglądarkę, ale odpowiedzi API AI były kontrolowane. Czas pełnej generacji z Twoim XKIRO pozostaje do zmierzenia. Nie ma podstaw do obietnicy „zawsze poniżej 1 minuty”. Nie zużyto Twoich kredytów API.
