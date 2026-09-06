import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  GraduationCap,
  X,
  Clock,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cineParent, cineSoft, cineStagger } from '../lib/shared';

export const ACADEMY_GUIDES: Array<{ title: string; category: string; level: string; time: string; excerpt: string; content: Array<{ h: string; p: string }> }> = [
  // ── PORADNIK 1 ────────────────────────────────────────────────────────────
  {
    title: 'Jak zdobyć pierwszego klienta w 7 dni',
    category: 'Sprzedaż',
    level: 'Początkujący',
    time: '18 min',
    excerpt: 'Kompletny plan outreach: od wyboru niszy, przez pierwszy mail, po zamknięcie sprzedaży.',
    content: [
      { h: 'Dlaczego 7 dni, a nie 30?', p: `Działanie w 7 dni nie jest magią — to po prostu ucięcie prokrastynacji. Większość osób zaczyna "szukać klientów" i nigdy nie kończy, bo nie ma konkretnego planu na każdy dzień. Poniżej masz plan dni po dniu: co zrobić, co napisać, jakich narzędzi użyć. Niczego nie wymyślasz sam — wszystko masz w SiteMorph.` },
      { h: 'Dzień 1: Wybierz wąską niszę', p: `Zamiast "strony dla wszystkich" skup się na 1 branży w 1 mieście. Dlaczego? Bo napisanie 5 e-maili do dentystów w Poznaniu jest 5x skuteczniejsze niż 1 e-mail do dentysty, fryzjera i kwiaciarni.

Jak wybrać niszę:
- Otwórz Lead Finder > kraj Polska > miasto, które znasz
- Wybierz branżę, która ma 20+ firm bez strony
- Sprawdź: czy ta branża ma sezonowość? (gabinety stomatologiczne — nie, ogrodnictwo — tak)
- Zasada: im węższa nisza, tym wyższa konwersja. "Gabinety stomatologiczne w Poznaniu" > "Stomatolodzy" > "Służba zdrowia"

Przykłady nisz, które działają:
- Kancelarie prawne w jednym mieście
- Warsztaty samochodowe marki premium (BMW, Audi)
- Kawiarnie specjalistyczne (specialty coffee)
- Gabinety weterynaryjne z profilem na ZnanyLekarz` },
      { h: 'Dzień 2: Zbuduj ciepłą listę w Lead Finderze', p: `Otwórz Lead Finder i ustaw:
- Kraj: Polska
- Miasto: to, które wybrałeś wczoraj
- Branża: ta sama
- Zaznacz: "Tylko firmy bez strony"

Kliknij "Szukaj leadów". Dostaniesz listę firm z nazwą, adresem, numerem telefonu, oceną z Google Maps i wynikiem gotowości.

Co zrobić z tą listą:
1. Posortuj po "Wynik" malejąco — góra to firmy, które NA PEWNO nie mają strony
2. Kliknij "Kopiuj dane" na pierwszych 20 firmach
3. Kliknij "Otwórz w mapach" — sprawdź czy firma istnieje, ile ma opinii
4. Zapisz 10 firm, do których chcesz napisać

Ważne: nie kopiuj danych mechanicznie. Wejdź na Google Maps i ręcznie sprawdź:
- Czy mają aktywny profil Google?
- Ile opinii? (0 opinii = trudny klient)
- Czy mają zdjęcia? (brak zdjęć = szansa na upsell)` },
      { h: 'Dzień 3: Stwórz darmowy mockup w Kreatorze', p: `Przed napisaniem jakiegokolwiek maila, przygotuj DOWÓD — darmowy projekt strony. To zmienia wszystko.

Krok po kroku w Kreatorze AI:
1. Wejdź w Pulpit > Kreator AI
2. Wpisz konkretny prompt:
   "Stwórz nowoczesną stronę dla gabinetu stomatologicznego Dentika w Poznaniu. Jasna kolorystyka (biały + niebieski), sekcje: Hero z hasłem "Twój uśmiech, nasza pasja", Oferta (implanty, ortodoncja, wybielanie), Cennik (3 pakiety), Rezerwacja online, Opinie klientów, Mapa dojazdu, Kontakt. Styl: profesjonalny, ale ciepły."
3. Kliknij "Generuj" (Normal wystarczy na start)
4. Poczekaj 1-3 minuty
5. Sprawdź podgląd na żywo — popraw:
   - Nazwę firmy (zastąp "Twoja Firma" na "Dentika")
   - Miasto i adres (z Google Maps)
   - Telefon (z Lead Findera)
   - Zdjęcia (dodaj prawdziwe z Google Maps lub internetu)
6. Skopiuj link podglądu — masz DARMOWY projekt!

Co dodaje wartość:
- Dodaj prawdziwy adres firmy
- Dodaj numer telefonu
- Dodaj godziny otwarcia
- Dodaj mapę dojazdu (embed z Google Maps)
- Popraw teksty na konkretne (zamiast "nasza oferta" → "implanty od 2 500 zł")` },
      { h: 'Dzień 4: Napisz pierwszy mail (z szablonem)', p: `Masz dowód (mockup). Teraz napisz maila. Oto sprawdzony szablon:

Temat: Darmowy projekt strony dla [Nazwa Firmy]

Cześć [Imię],

Znalazłem [Nazwę Firmy] w Google Maps i widzę, że nie macie jeszcze strony internetowej. Przygotowałem dla Was darmowy projekt — bez żadnych zobowiązań.

Zobacz: [link do podglądu]

Strona jest gotowa do uruchomienia, z rezerwacją online i mapą dojazdy. Jeśli Wam się podoba, mogę ją wdrożyć na Waszej domenie za [1 900 zł] netto — płatność dopiero po akceptacji.

Pozdrawiam,
[Twoje imię] [Twoja nazwa / Studio]

Dlaczego ten mail działa:
- Konkretna nazwa firmy (nie "Drogi Kliencie")
- Darmowy projekt (nie "propozycja współpracy")
- Link do podglądu (dowód, nie obietnica)
- Konkretna cena (nie "wycena po spotkaniu")
- Płatność po akceptacji (zero ryzyka)

Ile maili: 10 dziennie. Po 3 dniach masz 30 maili.
Statystyki: 30% otwarć, 10% odpowiedzi, 3-5 potencjalnych klientów, 1-2 zamknięte transakcje.` },
      { h: 'Dzień 5: Follow-up (nie bój się)', p: `Większość ludzi pisze 1 maila i czeka. Nie czekaj — follow-up jest normalny i oczekiwany.

Sequencja follow-upów:

Dzień 1: pierwszy mail (z mockupem)

Dzień 3: follow-up nr 1
"Cześć [Imię], podsyłam jeszcze raz link do projektu: [link]. Strona jest gotowa — mogę wdrożyć w ciągu 1 dnia. Jeśli macie pytania, chętnie odpowiem."

Dzień 7: follow-up nr 2 (telefon)
Zadzwoń. Nie pisz maila — zadzwoń. Skrypt:
"Cześć [Imię], tu [Twoje imię]. Wysłałem Wam projekt strony kilka dni temu — czy widzieliście? ... Czy macie jakieś pytania? ... Mogę wdrożyć w ciągu 1 dnia, koszt to [1 900 zł] netto. Płatność po akceptacji. Kiedy najlepiej zadzwonić jutro?"

Dzień 14: ostatni mail
"Cześć [Imię], projekt strony dla [Nazwa Firmy] jest nadal gotowy. Jeśli w przyszłości będziecie potrzebować strony — odezwijcie się. Tymczasem życzę dużo klientów!"

Zasady follow-upu:
- Nie przepraszaj za "natrętność" — to normalne w biznesie
- Nie pisz "czy widziałeś mojego maila?" — napisz konkretnie
- Daj wartość w każdym follow-upie
- Po 3 follow-upach — odpuść. Wróć za 2 miesiące` },
      { h: 'Dzień 6: Zamknięcie sprzedaży', p: `Klient odpowiada "fajne, ile to kosztuje?" lub "jestem zainteresowany". Nie odpowiadaj od razu ceną.

Kroki zamknięcia:

1. UMÓW ROZMOWĘ (5 min)
   "Świetnie! Mam 5 minut dziś po 16:00 lub jutro rano — co Wam pasuje?"

2. NA ROZMOWIE — zadaj 3 pytania:
   - "Jakie macie oczekiwania wobec strony?"
   - "Kiedy chcielibyście ją uruchomić?"
   - "Macie już domenę, czy mam pomóc?"

3. PREDYCJA — na podstawie odpowiedzi:
   - "chcemy szybko" → pakiet Start (1 900 zł)
   - "chcemy z rezerwacją" → pakiet Growth (3 900 zł)
   - "chcemy wszystko" → pakiet Premium (7 900 zł)

4. WYSTAW FAKTURĘ
   Po akceptacji cenowej:
   - Wejdź w Finanse > Nowa faktura
   - Dodaj pozycję (np. "Projekt i wdrożenie strony — 1 900 zł netto")
   - Status: Oczekująca
   - Wyślij link do płatności
   - Klient płaci → status: Opłacona → rozpocznij pracę

5. WDROŻENIE (1 dzień)
   - Kliknij Opublikuj w Kreatorze
   - Wybierz domenę (lub stwórz subdomenę)
   - Wyślij klientowi link
   - Sprawdź na telefonie
   - Gotowe!` },
      { h: 'Dzień 7: Analiza i skalowanie', p: `Po 7 dniach masz:
- 20+ maili wysłanych
- 3-5 odpowiedzi
- 1-2 zamknięte transakcje
- ~2 000-4 000 zł przychodu

Co teraz:
1. Podsumuj konwersję: ile maili → ile otwarć → ile odpowiedzi → ile rozmów → ile sprzedaży
2. Powtórz proces z nową niszą (inna branża lub inne miasto)
3. Zwiększ liczbę maili do 15/dzień
4. Dodaj telefon (dzień 5 zamiast 7)
5. Zbuduj portfolio: zapisz screenshoty stron, zbieraj opinie, dodaj case study
6. Podnieś ceny o 20% co 3 miesiące` }
    ]
  },

  // ── PORADNIK 2 ────────────────────────────────────────────────────────────
  {
    title: 'Kreator AI: kompletny przewodnik od promptu do publikacji',
    category: 'Kreator',
    level: 'Początkujący',
    time: '22 min',
    excerpt: 'Jak pisać prompt, żeby AI wygenerowało stronę, którą klient chce kupić. Plus troubleshooting.',
    content: [
      { h: 'Jak działa Kreator AI', p: `Kreator AI bierze Twój opis tekstowy i zamienia go na kompletną stronę internetową.

Co AI dostaje:
- Twój prompt (opis strony)
- Informacje o branży i mieście
- Wybrany styl (dark/light/nowoczesny/klasyczny)
- Twoje załączone zdjęcia (jeśli są)

Co AI zwraca:
- Kompletny HTML z CSS i JavaScript
- Sekcje: Hero, Oferta, Cennik, Opinie, Kontakt, Stopka
- Responsywność (mobile + desktop)
- Animacje i hover efekty
- Formularz kontaktowy

Czego NIE zwraca:
- Gotowej domeny (musisz podłączyć osobno)
- Prawdziwych danych firmy (musisz uzupełnić)
- Prawdziwych zdjęć (chyba że załączysz)` },
      { h: 'Jak pisać dobry prompt — zasady 5W', p: `Prompt to nie "zrób mi stronę". Prompt to KONKRETNY opis tego, co ma być na stronie.

Złota reguła 5W:
- KTO? — nazwa firmy, branża, miasto
- CO? — jakie sekcje ma mieć strona
- JAKI? — styl (dark, light, nowoczesny, klasyczny)
- CO NA ZDJĘCIACH? — jakich zdjęć użyć (Unsplash lub Twoje)
- JAKIE TEKSTY? — konkretny nagłówek i opis

ZŁY prompt: "Zrób mi ładną stronę dla firmy"
AI nie wie: jaka firma? Jaki kolor? Jakie sekcje? Co na hero?

DOBRY prompt: "Stwórz stronę dla kawiarni Kawa i Paleta w Krakowie, ciemny motyw, sekcje: Hero z "Najlepsza kawa w Krakowie", Menu (5 pozycji z cenami: espresso 12zł, latte 16zł, flat white 18zł, croissant 9zł, ciasto dnia 14zł), O nas (historia kawiarni), Opinie Google (4.8/5, 126 opinii), Kontakt (Rynek Główny 5, godz. 7-21), Mapa dojazdy. Zdjęcia: specialty coffee, vintage interior, latte art."` },
      { h: 'Prompt startery — gotowe szablony', p: `RESTAURACJA:
"Stwórz stronę dla restauracji [Nazwa] w [Mieście]. Ciemny motyw. Sekcje: Hero "Smak, który zapamiętasz" ze zdjęciem dania, Menu (6 dań z cenami 25-65 zł), Galeria (6 zdjęć z Unsplash: polskie jedzenie), Opinie (4.7, 89 opinii), Kontakt z mapą dojazdy, Rezerwacja stolika (formularz). Styl: elegancki, ciepły."

KAWIARNIA:
"Strona dla kawiarni [Nazwa] w [Mieście]. Jasny, pastelowy motyw. Hero: "Twoja codzienna kawa" ze zdjęciem latte art. Sekcje: Menu (espresso 10zł, cappuccino 14zł, matcha 16zł, ciasto dnia 12zł), O nas, Opinie, Kontakt. Styl: minimalistyczny, skandynawski."

FRYZJER:
"Strona barbera [Nazwa] w [Mieście]. Ciemny motyw, gold accents. Hero: "Styl, który robi wrażenie". Sekcje: Usługi (strzyżenie 50zł, golenie 40zł, broda 30zł, pakiet 90zł), Galeria before/after, Cennik, Opinie, Kontakt z book online, Instagram feed. Styl: premium, męski."

NIERUCHOMOŚCI:
"Strona agenta nieruchomości [Nazwa]. Biały + niebieski. Hero: "Znajdź swoje miejsce" ze zdjęciem nowoczesnego mieszkania. Sekcje: Oferty (3 karty: mieszkania, domy, działki), O mnie (doświadczenie, licencja), Proces współpracy (4 kroki), Opinie klientów, Kontakt. Styl: profesjonalny, zaufany."` },
      { h: 'Edycja sekcji — jak poprawiać bez regeneracji', p: `Po wygenerowaniu strony NIE musisz regenerować całej strony, żeby poprawić detail. Możesz edytować sekcje:

1. Kliknij sekcję w panelu edycji (lewa strona)
2. Wpisz zmianę tekstu lub wbudowaną komendę
3. Kliknij "Zastosuj" — zmiana pojawia się w podglądzie na żywo

Co możesz edytować:
- Tekst nagłówka (np. "Zmień 'Nasza oferta' na 'Dlaczego my'")
- Kolor tła (np. "Zmień tło sekcji Cennik na ciemnoniebieski")
- Zdjęcia (np. "Zamień zdjęcie w Hero na zdjęcie kawy z Unsplash")
- Układ (np. "Przenieś sekcję Opinie nad Cennik")
- Ceny (np. "Zmień cenę implantu z 2000 na 2500 zł")

Czego NIE edytujesz:
- Struktury plików HTML (to robi AI przy regeneracji)
- CDN linków (Tailwind, Lucide — to automatycznie)
- Responsywności (to się robi samo)

Pro tip: zamiast "popraw cennik", napisz "w sekcji Cennik zmień cenę usługi X z Y na Z i dodaj nową pozycję: nazwa - cena zł". Konkretne instrukcje działają lepiej niż ogólne.` },
      { h: 'Zdjęcia — Unsplash vs Twoje', p: `Opcja 1: Zdjęcia z Unsplash (darmowe)
W Kreatorze kliknij "Załącz zdjęcia" i wybierz "Stock (Unsplash)". AI automatycznie dobiera zdjęcia pasujące do branży. Zalety: darmowe, dobrej jakości, natychmiastowe. Wady: generalne, nie Twoje prawdziwe zdjęcia.

Opcja 2: Twoje zdjęcia (zalecane)
Kliknij "Załącz zdjęcia" i wybierz pliki z komputera. Najlepsze zdjęcia to:
- Zdjęcia firmy z zewnątrz (elewacja, szyld)
- Zdjęcia wnętrz (jeśli lokal jest atrakcyjny)
- Zdjęcia produktów/usług
- Zdjęcia zespołu
- Screeny opinii z Google Maps

Tips:
- Minimum 3 zdjęcia, optimum 6-10
- Rozdzielczość min 800x600 px
- JPG lub PNG (nie HEIC)
- Nazwij pliki deskrypcywnie: kawa.jpg, lokal.jpg, zespol.jpg
- Nie wklejaj screenshotów z Google Maps — pobierz oryginalne` },
      { h: 'Podgląd na żywo — jak pokazać klientowi', p: `Po wygenerowaniu strony masz link do podglądu na żywo. To Twój najsilniejszy argument sprzedażowy.

Jak używać:
1. Kliknij "Podgląd na żywo" w Kreatorze
2. Skopiuj link
3. Wyślij klientowi mailem lub WhatsAppem
4. Klient otwiera na telefonie lub komputerze
5. Widzi Twoją propozycję — BEZ logowania, BEZ instalacji

Co klient widzi:
- Kompletną stronę (nie mockup w PDF)
- Responsywną (działa na telefonie)
- Z prawdziwymi danymi (jeśli je uzupełniłeś)

Co klient MOŻE zrobić:
- Klikać w linki
- Przewijać stronę
- Sprawdzać na telefonie
- Pokazywać wspólnikom

Czego klient NIE MOŻE:
- Edytować strony
- Pobrać kodu źródłowego
- Zobaczyć Twojego panelu` },
      { h: 'Publikacja — krok po kroku', p: `Gdy klient zaakceptuje projekt, publikujesz:

Opcja A: subdomena SiteMorph (darmowa, natychmiastowa)
1. W Kreatorze kliknij "Publikuj"
2. Wybierz "Subdomena SiteMorph"
3. Wpisz nazwę (np. dentika)
4. Link: dentika.sitemorph.pl
5. Gotowe — SSL automatyczny, hosting w cenie

Opcja B: własna domena (zalecana dla klientów)
1. Klient kupuje domenę (np. dentika.pl) u rejestratora
2. W Kreatorze kliknij "Publikuj" > "Własna domena"
3. Wpisz domenę (np. dentika.pl)
4. Skopiuj rekordy DNS:
   - CNAME > cname.sitemorph.pl
   - TXT > do weryfikacji
5. Klient wkleja rekordy u rejestratora (OVH, Aftermarket, home.pl)
6. Czekaj 5-60 minut na propagację
7. Sprawdź: wpisz https://dentika.pl — strona musi działać
8. Kłódka SSL musi być zielona

Czas realizacji: subdomena = natychmiast, własna domena = 5-60 min.` },
      { h: 'Najczęstsze błędy', p: `BŁĄD 1: "Zrób mi stronę" (bez kontekstu)
ZA MAŁO INFORMACJI. Poprawka: dodaj branżę, miasto, kolory, sekcje, konkretne teksty.

BŁĄD 2: Za krótki prompt (1 zdanie)
AI domyśla się i generuje generyczną stronę. Poprawka: minimum 3-4 zdania z konkretami.

BŁĄD 3: Regenerowanie całej strony zamiast edycji sekcji
Tracisz czas (każda regeneracja = 1-3 min). Poprawka: edytuj konkretne sekcje.

BŁĄD 4: Brak prawdziwych danych
Strona wygląda profesjonalnie, ale klient widzi "Twoja Firma" zamiast "Dentika". Poprawka: uzupełnij nazwę, adres, telefon, ceny.

BŁĄD 5: Nie sprawdzasz na telefonie
Klient otwiera na iPhonie i widzi bałagan. Poprawka: zawsze sprawdzaj podgląd na telefonie przed wysłaniem.

BŁĄD 6: Zapominasz o formularzu kontaktowym
Klient nie może napisać do firmy. Poprawka: sekcja Kontakt musi zawierać formularz.

BŁĄD 7: Używasz darmowej subdomeny dla klienta
twojklient.sitemorph.pl wygląda nieprofesjonalnie. Poprawka: zawsze proponuj własną domenę.` },
      { h: 'Twoje tryby generation', p: `Normal (darmowy):
- Szybkie generowanie (30-60 sekund)
- Dobrze na start i prototypowanie
- Mniej detali wizualnych
- Wystarczający dla 70% stron

Ultra (45 kredytów, ~$0.025):
- Wolniejsze (2-3 minuty)
- Lepsze teksty i layout
- Więcej animacji i hover efektów
- Lepsze dopasowanie do branży
- Zalecany dla klientów premium

Kiedy używać Ultra:
- Klient płaci > 3 000 zł
- Strona musi wyglądać "Jak z agencji"
- Klient ma konkretne wymagania wizualne
- Robisz portfolio piece

Kiedy używać Normal:
- Prototypowanie i pokazywanie klientowi
- Klienci z budżetem < 2 000 zł
- Szybkie wersje do akceptacji
- Testowanie pomysłów` }
    ]
  },

  // ── PORADNIK 3 ────────────────────────────────────────────────────────────
  {
    title: 'Cennik, który sprzedaje: 1 500 - 12 000 zł',
    category: 'Biznes',
    level: 'Średniozaawansowany',
    time: '20 min',
    excerpt: 'Psychologia cen, pakiety, obsługa obiekcji i wycena która nie zaniża Twojej wartości.',
    content: [
      { h: 'Dlaczego klienci kupują ceny, a nie usługi', p: `Klient nie kupuje "strony internetowej". Klient kupuje:
- Rezerwacje online (które normalnie traci)
- Widoczność w Google (żeby klienci go znajdowali)
- Profesjonalny wizerunek (żeby wyglądać jak duży gracz)
- Czas (żeby nie robić tego samemu)

Twoja cena to NIE jest cena za kod HTML. Twoja cena to cena za ROZWIĄZANIE PROBLEMU klienta.

Gdy klient mówi "1 900 zł za stronę to dużo":
"Rozumiem. Ile rezerwacji miesięcznie tracicie, bo klienci nie mogą znaleźć Waszych godzin otwarcia online? Jedna rezerwacja to 200 zł? To 5 rezerwacji = 1 000 zł. Strona zwraca się w 2 miesiące."` },
      { h: 'Realne widełki cenowe — Polska 2024/2025', p: `WIZYTÓWKA AI (landing page):
- Co: 1-stronicowa strona z ofertą, kontaktem i formularzem
- Czas: 2-4 godziny pracy
- Cena rynkowa: 800-1 900 zł
- Twoja cena: 1 450-1 900 zł netto

STRONA FIRMOWA (5-7 podstron):
- Co: strona główna + oferta + cennik + kontakt + galeria
- Czas: 6-12 godzin pracy
- Cena rynkowa: 2 500-4 500 zł
- Twoja cena: 2 900-3 900 zł netto

LANDING + COPYWRITING SEO:
- Co: landing page + 5 tekstów SEO + meta tagi + Google Analytics
- Czas: 12-20 godzin pracy
- Cena rynkowa: 4 000-7 000 zł
- Twoja cena: 4 900-6 900 zł netto

WHITE-LABEL DLA AGENCJI:
- Co: strona + hosting + utrzymanie + wsparcie techniczne
- Czas: 20-30 godzin pracy
- Cena rynkowa: 8 000-12 000 zł
- Twoja cena: 7 900-9 900 zł netto

NIE SCHODŹ PONIŻEJ 800 ZŁ za stronę. Poniżej tej ceny psujesz rynek, nie opłaca się, a klient nie szanuje.` },
      { h: 'Trzy pakiety — efekt kotwicy', p: `Psychologia: klient WYBIERA ŚRODEK. Dlatego dajesz 3 pakiety.

PAKIET START — 1 900 zł netto:
- Strona 1-stronicowa (lub 3 podstrony)
- Podgląd na żywo
- 1 poprawka
- Subdomena SiteMorph
- SSL i hosting na 1 miesiąc
- Formularz kontaktowy
Dla kogo: firmy z małym budżetem, pierwsza strona

PAKIET GROWTH — 3 900 zł netto (REKOMENDOWANY):
- Strona 5-7 podstron
- Lead Finder: 20 leadów z branży klienta
- 3 poprawki w ciągu 30 dni
- Własna domena + SSL
- Hosting na 3 miesiące
- Formularz + mapa dojazdy
- Favicon i meta SEO
Dla kogo: firmy, które chcą się rozwijać

PAKIET PREMIUM — 7 900 zł netto:
- Strona + blog + galeria + formularz + mapa
- Lead Finder: 50 leadów
- Nielimitowane poprawki (3 miesiące)
- Własna domena + SSL
- Hosting na 12 miesięcy
- Copywriting SEO (5 artykułów)
- Google Analytics + Search Console
- Szkolenie z obsługi (1h)
Dla kogo: firmy, które chcą kompletny pakiet

Jak presentować: "Mam 3 pakiety: Start za 1 900, Growth za 3 900 i Premium za 7 900. Większość klientów wybiera Growth — ma wszystko, czego potrzebujesz na start."` },
      { h: 'Obsługa obiekcji — gotowe odpowiedzi', p: `"ZA DROGO":
Nie obniżaj stawki. Zmniejsz zakres.
"Rozumiem. Zrobimy 3 podstrony zamiast 6 za 1 450 zł. A jak budżet się poprawi, dodamy resztę."

"MAM ZNAJOMEGO KTÓRY ROBI TANIEJ":
"Świetnie, niech Pan korzysta. Tylko upewnij się, że ma: responsywność, SSL, formularz kontaktowy, hosting i wsparcie techniczne. Ja to wszystko daję w cenie."

"NIE POTRZEBUJĘ STRONY":
"Ile klientów szuka Twojej firmy w Google i nie znajduje? Statystyki mówią, że 70% klientów szuka firm lokalnych online. Bez strony Cię nie znajdują."

"MAM FACEBOOKA":
"Facebook jest świetny do komunikacji, ale: 1) nie pojawiasz się w Google, 2) nie masz formularza rezerwacji, 3) nie wyglądasz profesjonalnie dla klientów biznesowych. Strona + Facebook = pełen zasięg."

"ZASTANOWIĘ SIĘ":
"Oczywiście. Tylko pamiętaj — projekt jest darmowy i ważny 14 dni. Po tym czasie mogę go usunąć, żeby zwolnić miejsce na serwerze. Kiedy mogę zadzwonić jutro?"

"NIE MAM CZASU NA SPOTKANIE":
"Rozumiem. Wyślemy link do podglądu — może Pan zobaczyć na telefonie, w 2 minuty. Bez logowania, bez zobowiązań. Dzisiaj wieczorem?"` },
      { h: 'Upsell — dodatkowe usługi', p: `PO AKCEPTACJI GŁÓWNEGO ZLECENIA, zaproponuj 1-2 dodatkowe usługi:

1. Rezerwacja online: +400 zł
   "Chcesz, żeby klienci rezerwowali stoliki online? Dodaję formularz rezerwacji za 400 zł, wdrożę w 1 dzień."

2. Teksty SEO: 380 zł za 5 artykułów
   "Chcesz pojawiać się w Google na frazy jak 'dentysta Poznań'? Napiszę 5 artykułów SEO za 380 zł."

3. Prowadzenie social media: 500 zł/mies
   "Chcesz regularne posty na Facebooku i Instagramie? Prowadzenie za 500 zł miesięcznie — 8 postów + stories."

4. Google Ads: 300 zł/mies + budżet reklamowy
   "Chcesz natychmiastowych klientów z Google? Prowadzenie kampanii za 300 zł/mies."

5. Utrzymanie strony: 100 zł/mies
   "Strona potrzebuje aktualizacji (SSL, kopie zapasowe, aktualizacje). Utrzymanie za 100 zł miesięcznie."

6. Domena i hosting: 200 zł/rok
   "Mogę obsługiwać Twoją domenę i hosting — 200 zł rocznie, bez Twojego angażu."

Jak sprzedawać upsell:
- NIE na pierwszej rozmowie (pierwsza = główne zlecenie)
- Po akceptacji głównego zlecenia
- Jako "dodatek" — "A jeszcze jedno — widzę, że macie tylko Facebooka..."
- Jednorazowo — nie naciskaj` },
      { h: 'Fakturowanie i płatności', p: `W module Finanse SiteMorph:

1. Wystawianie faktur:
   - Finanse > Nowa faktura
   - Dodaj pozycję: "Projekt i wdrożenie strony — 1 900 zł netto"
   - Dodaj VAT (23%): 437 zł
   - Razem brutto: 2 337 zł
   - Status: Oczekująca
   - Wyślij link do płatności

2. Statusy faktur:
   - Oczekująca → klient仍未付款
   - Opłacona → klient zapłacił (automatycznie po płatności)
   - Anulowana → faktura nieważna

3. Warunki płatności:
   - Start: 100% z góry
   - Growth: 50% z góry, 50% po akceptacji
   - Premium: 30% z góry, 40% po akceptacji, 30% po 3 miesiącach

4. Prowizja:
   - 0% — wszystko trafia na Twoje konto
   - Nie ma ukrytych opłat` },
      { h: 'Jak podnieść ceny co 3 miesiące', p: `Co 3 miesiące podnoś ceny o 15-20%:

Miesiąc 1-3: Start 1 450 zł, Growth 2 900 zł, Premium 5 900 zł
Miesiąc 4-6: Start 1 700 zł, Growth 3 400 zł, Premium 6 900 zł
Miesiąc 7-9: Start 1 900 zł, Growth 3 900 zł, Premium 7 900 zł
Miesiąc 10-12: Start 2 200 zł, Growth 4 500 zł, Premium 8 900 zł

Kiedy podnosisz ceny:
- Gdy masz 5+ klientów (masz portfolio)
- Gdy masz opinie (5 na Google Maps)
- Gdy Twoje strony wyglądają lepiej niż konkurencja
- Gdy klienci sami do Ciebie piszą (inbound)

Jak komunikować podwyżkę:
"Ceny wzrosną od przyszłego miesiąca o 20%. Jeśli chcesz skorzystać z obecnych cen, podpisz umowę do końca tego miesiąca."
Tworzy urgency i nie psuje relacji.` }
    ]
  },

  // ── PORADNIK 4 ────────────────────────────────────────────────────────────
  {
    title: 'Domena, SSL i publikacja — kompletna instrukcja',
    category: 'Techniczne',
    level: 'Wszyscy',
    time: '15 min',
    excerpt: 'Jak podłączyć domenę klienta, skonfigurować DNS, SSL i przekierowania. Z troubleshootingiem.',
    content: [
      { h: 'Opcja A: subdomena SiteMorph', p: `Subdomena to darmowa opcja na start.

Jak działa:
- twojklient.sitemorph.pl
- SSL automatyczny (Let's Encrypt)
- Hosting w cenie
- Działa natychmiast po publikacji

Kiedy używać:
- Prototyp i pokaz klientowi
- Klient nie ma jeszcze domeny
- Szybkie wdrożenie (5 minut)

Wady:
- Nieprofesjonalna (klient widzi sitemorph.pl)
- Nie pojawiasz się w Google na frazy lokalne
- Klient może pomyśleć, że to "tymczasowa" strona

Zasada: zawsze proponuj subdomenę JAKO PIERWSZĄ opcję na pokaz, a potem przejdź na własną domenę.` },
      { h: 'Opcja B: własna domena — krok po kroku', p: `KROK 1: Klient kupuje domenę
- Rejestratorzy: OVH (od 30 zł/rok), Aftermarket, home.pl, cyber_Folks
- Wybierz domenę .pl (lub .com, .eu)
- Koszt: 30-100 zł/rok
- Klient kupuje SAM (nie Ty!) — Ty tylko doradzasz

KROK 2: Publikujesz stronę w Kreatorze
- Kliknij "Publikuj" > "Własna domena"
- Wpisz domenę (np. dentika.pl)
- Kliknij "Generuj rekordy DNS"

KROK 3: Klient konfiguruje DNS
Klient loguje się do rejestratora i dodaje rekordy:

Rekord CNAME:
- Typ: CNAME
- Nazwa: @ (lub nazwa domeny)
- Wartość: cname.sitemorph.pl
- TTL: 3600

Rekord TXT (weryfikacja):
- Typ: TXT
- Nazwa: @
- Wartość: (skopiuj z Kreatora)
- TTL: 3600

Ważne:
- NIE edytuj istniejących rekordów MX (poczta)
- NIE kasuj istniejących rekordów
- Dodaj TYLKO CNAME i TXT
- Jeśli klient nie umie — zadzwoń do rejestratora` },
      { h: 'SSL — certyfikat bezpieczeństwa', p: `SSL to zamek w pasku adresu (https://). Bez SSL:
- Przeglądarka pokazuje "Niezabezpieczona"
- Klienci uciekają
- Google obniża pozycję w wynikach

W SiteMorph SSL jest automatyczny:
- Let's Encrypt — darmowy certyfikat
- Odświeża się co 90 dni (automatycznie)
- Nie musisz nic robić

Po podłączeniu domeny:
1. Poczekaj 5-60 minut na propagację DNS
2. Wejdź na https://twojadomena.pl
3. Sprawdź kłódkę — musi być zielona
4. Jeśli kłódka NIE jest zielona:
   - Poczekaj jeszcze 30 minut
   - Sprawdź czy rekordy DNS są poprawne
   - Wyczyść cache przeglądarki (Ctrl+Shift+R)
   - Sprawdź na telefonie (inne IP)

Jeśli po 2 godzinach nadal nie działa, skontaktuj się z supportem SiteMorph.` },
      { h: 'Przekierowania — www i bez www', p: `Problem: klient wpisuje www.dentika.pl i dentika.pl — to dwie różne strony.

Rozwiązanie: przekierowanie 301

W panelu Kreatora > Ustawienia > Przekierowania:
- Opcja 1: dentika.pl > www.dentika.pl (zalecane)
- Opcja 2: www.dentika.pl > dentika.pl

Wybierz JEDNĄ opcję i zastosuj dla wszystkich.

Dlaczego to ważne:
- Google traktuje www i bez www jako dwie strony
- Duplikacja treści obniża pozycję w wynikach
- Klient może wpisywać obie wersje

Test:
1. Wpisz www.dentika.pl → powinno przekierować na dentika.pl
2. Wpisz dentika.pl → powinno działać bez przekierowania
3. Sprawdź w pasku adresu — URL musi być stały` },
      { h: 'Checklista przed wysyłką do klienta', p: `Przed wysłaniem strony klientowi, sprawdź:

DANE:
- Nazwa firmy (nie "Twoja Firma")
- Adres (z Google Maps)
- Telefon (prawdziwy)
- Godziny otwarcia
- Email kontaktowy

SEKCJE:
- Hero z konkretnym hasłem (nie "Witamy")
- Oferta z cenami
- Opinie (4.5+ gwiazdki)
- Kontakt z formularzem
- Mapa dojazdy (embed)
- Footer z danymi

TECHNICZNE:
- Responsywność (test na telefonie)
- Szybkość ładowania (< 3 sekundy)
- SSL zielona kłódka
- Formularz działa (wyślij test)
- Linki działają (nie prowadzą do 404)
- Brak "Lorem ipsum" i "Twoja Firma"
- Zdjęcia załadowane (nie placeholder)

SEO:
- Title tag (nazwa firmy + miasto)
- Meta description (opis < 160 znaków)
- H1 na każdej stronie
- Alt text na zdjęciach

PRAWNE:
- RODO w formularzu kontaktowym
- Cookies (baner informacyjny)
- Polityka prywatności (stopka)

Dopiero gdy WSZYSTKO jest zaznaczone, wyślij link klientowi.` },
      { h: 'Troubleshooting — co gdy coś nie działa', p: `STRONA NIE DZIAŁA PO PUBLIKACJI:
1. Sprawdź czy rekordy DNS są poprawne
2. Poczekaj 60 minut (propagacja)
3. Wyczyść cache przeglądarki
4. Sprawdź na innym urządzeniu
5. Sprawdź czy domena nie wygasła

FORMULARZ NIE WYSYŁA:
1. Sprawdź czy email jest poprawny w ustawieniach
2. Sprawdź folder SPAM
3. Wyślij test z innego emaila
4. Sprawdź console przeglądarki (F12 > Console)

STRONA WOLNO SIĘ ŁADUJE:
1. Sprawdź rozmiar zdjęć (max 200KB na zdjęcie)
2. Użyj WebP zamiast PNG/JPG
3. Sprawdź czy CDN Tailwind się załadował
4. Wyłącz animacje CSS

ZDJĘCIA NIE ŁADUJĄ SIĘ:
1. Sprawdź czy URL zdjęcia działa (otwórz w nowej karcie)
2. Sprawdź CORS (consola przeglądarki)
3. Użyj zdjęć z Unsplash zamiast własnych
4. Sprawdź czy zdjęcia nie są za duże (> 5MB)

GOOGLE NIE INDYKSUJE STRONY:
1. Dodaj sitemap.xml do Google Search Console
2. Sprawdź robots.txt (nie blokuje robotów)
3. Poczekaj 1-2 tygodnie
4. Zgłoś stronę ręcznie w Search Console` }
    ]
  }
];

// ============================================================================
// 6. WIDOK: EKRAN GLÓWNY (LANDING SCROLLABLE)
// ============================================================================
export const TutorialsView = () => {
  const [activeGuide, setActiveGuide] = useState<number | null>(null);

  return (
    <motion.div 
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto py-8 px-6 pb-16 text-[#2563eb] dark:text-white"
      style={{ perspective: 1600 }}
    >
      <motion.div variants={cineSoft} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-blue-100 dark:bg-neutral-900 text-[#2563eb] dark:text-white border border-[#EAEAEA] dark:border-neutral-800">
          <GraduationCap size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'Inter', sans-serif" }}>Akademia SiteMorph</h1>
          <p className="text-xs font-bold opacity-80">Poradniki tekstowe — czytaj, kopiuj szablony, wdrażaj od razu.</p>
        </div>
      </motion.div>

      <motion.div variants={cineParent} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ perspective: 1600 }}>
        {ACADEMY_GUIDES.map((g, i) => (
          <motion.div
            key={g.title}
            custom={i}
            variants={cineStagger}
            whileHover={{ y: -8, scale: 1.02, rotateX: 6 }}
            onClick={() => setActiveGuide(i)}
            className="rounded-2xl p-6 border shadow-xl transition-all flex flex-col justify-between cursor-pointer bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900 hover:border-blue-300 dark:hover:border-neutral-700 hover:shadow-2xl"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800">{g.category}</span>
                <span className="text-[10px] font-black flex items-center gap-1"><Clock size={12} /> {g.time}</span>
              </div>
              <h3 className="text-base font-black mb-1 leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>{g.title}</h3>
              <p className="text-xs font-bold opacity-70 leading-relaxed">{g.excerpt}</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-[#EAEAEA] dark:border-neutral-900 mt-4">
              <span className="text-[11px] font-bold opacity-80">Poziom: {g.level}</span>
              <span className="text-xs font-black flex items-center gap-1 text-emerald-500">Czytaj poradnik <ArrowRight size={14} /></span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {activeGuide !== null && (
          <motion.div
            className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveGuide(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 18, opacity: 0, rotateX: -10, filter: 'blur(12px)' }}
              animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0, filter: 'blur(0px)' }}
              exit={{ scale: 0.96, y: 12, opacity: 0, filter: 'blur(10px)' }}
              transition={{ type: 'spring' as const, stiffness: 280, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[86vh] overflow-hidden rounded-2xl bg-white dark:bg-neutral-950 border border-[#EAEAEA] dark:border-neutral-800 shadow-2xl flex flex-col"
              style={{ perspective: 1200 }}
            >
              <div className="pointer-events-none absolute -top-24 -right-24 w-[340px] h-[340px] bg-gradient-to-tr from-lime-200 via-emerald-200 to-lime-100 opacity-25 blur-2xl legal-blob" />
              <div className="relative flex items-center justify-between p-6 border-b border-[#EAEAEA] dark:border-neutral-900 bg-white/85 dark:bg-neutral-950/85 backdrop-blur sticky top-0">
                <div className="pr-4">
                  <div className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800 w-fit">{ACADEMY_GUIDES[activeGuide].category} - {ACADEMY_GUIDES[activeGuide].time}</div>
                  <h3 className="text-lg font-black tracking-tight mt-1.5 leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>{ACADEMY_GUIDES[activeGuide].title}</h3>
                </div>
                <motion.button whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: 0.92 }} onClick={() => setActiveGuide(null)} className="w-8 h-8 rounded-full grid place-items-center bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800 cursor-pointer shrink-0">
                  <X size={14} />
                </motion.button>
              </div>
              <div className="relative overflow-y-auto p-6 space-y-6 no-scrollbar text-left" style={{ fontFamily: "'Inter', sans-serif" }}>
                {ACADEMY_GUIDES[activeGuide].content.map((s) => (
                  <div key={s.h} className="space-y-2">
                    <h4 className="text-sm font-black tracking-tight">{s.h}</h4>
                    <p className="text-xs font-medium leading-relaxed opacity-85 whitespace-pre-wrap">{s.p}</p>
                  </div>
                ))}
                <div className="pt-4 flex justify-end border-t border-[#EAEAEA] dark:border-neutral-900">
                  <Button variant="primary" size="sm" onClick={() => setActiveGuide(null)}>Zamknij</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Cookie banner — tylko pierwszy raz
