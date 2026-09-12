import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  Search,
  MapPin,
  X,
  Check,
  Menu,
  Monitor,
  Wrench,
  Sun,
  Moon,
  Info,
} from 'lucide-react';
import { cineChild, cineParent, cineSoft, springTransition } from '../lib/shared';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4';

// ============================================================================
// EKSPORTOWANE STAŁE (używane też przez inne widoki)
// ============================================================================
export const LANDING_HOW_STEPS = [
  {
    num: '01',
    title: 'Opisz firmę jednym zdaniem',
    desc: 'Napisz, dla kogo jest strona. Resztę — układ, typografię i treści — dobiera SiteMorph.',
  },
  {
    num: '02',
    title: 'Popraw, aż będzie dobrze',
    desc: 'Każda zmiana pojawia się od razu w podglądzie. Bez wysyłania plików i bez limitów wersji.',
  },
  {
    num: '03',
    title: 'Wyślij klientowi i zainkasuj',
    desc: 'Publikujesz pod własnym adresem, wysyłasz link i rozliczasz się bez prowizji.',
  },
];

export const LANDING_FEATURE_TABS: Array<{ label: string; icon: any; title: string; desc: string; statBig: string; statSmall: string }> = [
  { label: 'Kreator AI', icon: Sparkles, title: 'Cała strona z jednego zdania', desc: 'AI dobiera układ, paletę i treści pod branżę klienta. Ty zatwierdzasz efekt.', statBig: '1 zdanie', statSmall: 'od pomysłu do projektu' },
  { label: 'Lead Finder', icon: Search, title: 'Firmy, które potrzebują strony', desc: 'Wyszukaj lokalne firmy i od razu filtruj te bez własnej witryny.', statBig: 'OSM', statSmall: 'dane publiczne' },
];

// ============================================================================
// LEGAL DOCS
// ============================================================================
export const LEGAL_DOCS: Record<'regulamin' | 'prywatnosc' | 'cookies', { title: string; updated: string; sections: Array<{ h: string; p: string }> }> = {
  regulamin: {
    title: 'Regulamin serwisu SiteMorph',
    updated: 'Aktualizacja: 12 sierpnia 2026',
    sections: [
      { h: '§1. Postanowienia ogólne', p: 'Niniejszy regulamin określa zasady korzystania z platformy SiteMorph (sitemorph.pl). Korzystając z serwisu, akceptujesz regulamin w całości. Usługi świadczone są drogą elektroniczną zgodnie z ustawą z dnia 18 lipca 2002 r. Jeżeli nie akceptujesz warunków — nie korzystaj z serwisu.' },
      { h: '§2. Definicje', p: 'Użytkownik — osoba fizyczna, prawna lub j.d.g. posiadająca konto. Konto — zbiór danych Użytkownika umożliwiający dostęp do kreatora, Lead Finder i fakturowania. Kredyty AI — jednostki rozliczeniowe zużywane na generowanie i edycję stron.' },
      { h: '§3. Rejestracja i konto', p: 'Rejestracja wymaga podania adresu e-mail i hasła. Użytkownik odpowiada za bezpieczeństwo hasła. Zabrania się udostępniania konta osobom trzecim oraz automatycznego scrapowania API bez zgody.' },
      { h: '§4. Usługi', p: 'SiteMorph udostępnia: (a) kreator stron AI, (b) wyszukiwarkę Lead Finder opartą o dane publiczne, (c) moduł podglądu na żywo, (d) fakturowanie bez prowizji. Projekty publikujesz na subdomenie *.sitemorph.pl lub własnej domenie.' },
      { h: '§5. Kredyty AI i płatności', p: 'Plany: Starter 49 zł/mies. (100 kredytów), Pro 99 zł (200), Business 199 zł (500). Kredyty odnawiają się co 30 dni. Płatności obsługuje Stripe/Przelewy24. Subskrypcję anulujesz w każdej chwili — dostęp pozostaje do końca okresu.' },
      { h: '§6. Prawa własności intelektualnej', p: 'Treści wygenerowane na Twoje zlecenie należą do Ciebie po opłaceniu planu. Zabrania się odsprzedaży samej platformy jako white-label poza planem Business.' },
      { h: '§7. Odpowiedzialność', p: 'SiteMorph dokłada staranności, ale nie gwarantuje, że wygenerowana treść będzie wolna od błędów. Użytkownik odpowiada za zgodność publikowanych treści z prawem (RODO, prawo autorskie, reklama).' },
      { h: '§8. Reklamacje', p: 'Reklamacje zgłaszasz na support@sitemorph.pl w 14 dni od zdarzenia. Odpowiadamy w 5 dni roboczych. Przy zasadnej reklamacji przyznajemy kredyty lub przedłużamy subskrypcję.' },
      { h: '§9. Postanowienia końcowe', p: 'W sprawach nieuregulowanych stosuje się prawo polskie. Kontakt: kontakt@sitemorph.pl, SiteMorph, Warszawa.' },
    ],
  },
  prywatnosc: {
    title: 'Polityka prywatności',
    updated: 'Aktualizacja: 12 sierpnia 2026 — zgodna z RODO',
    sections: [
      { h: '1. Administrator', p: 'Administratorem danych jest SiteMorph, kontakt: iod@sitemorph.pl.' },
      { h: '2. Jakie dane zbieramy', p: 'Konto: e-mail, nazwa firmy, NIP (jeśli podasz do faktur). Płatności: dane obsługuje Stripe — nie przechowujemy numerów kart. Lead Finder przetwarza wyłącznie dane publiczne.' },
      { h: '3. Cele i podstawy prawne', p: 'Art. 6 ust. 1 lit. b RODO — wykonanie umowy. Lit. c — obowiązki księgowe. Lit. f — bezpieczeństwo i analityka.' },
      { h: '4. Odbiorcy danych', p: 'Hosting (UE), Stripe (płatności), Resend (maile), Google Analytics 4 (po zgodzie). Nie sprzedajemy danych.' },
      { h: '5. Okres przechowywania', p: 'Konto — do usunięcia konta. Faktury — 5 lat. Logi — 12 miesięcy.' },
      { h: '6. Twoje prawa', p: 'Prawo dostępu, sprostowania, usunięcia, ograniczenia, przenoszenia, sprzeciw oraz skarga do PUODO. Wniosek realizujemy w 30 dni na iod@sitemorph.pl.' },
      { h: '7. Bezpieczeństwo', p: 'Szyfrowanie TLS, hasła hashowane bcrypt, kopie zapasowe codziennie.' },
      { h: '8. Kontakt', p: 'Pytania: iod@sitemorph.pl. O zmianach informujemy e-mailem 14 dni wcześniej.' },
    ],
  },
  cookies: {
    title: 'Polityka cookies',
    updated: 'Aktualizacja: 12 sierpnia 2026',
    sections: [
      { h: '1. Co to są cookies', p: 'Małe pliki tekstowe zapisywane na Twoim urządzeniu. Używamy ich, by serwis działał, zapamiętywał motyw i — po zgodzie — mierzył ruch.' },
      { h: '2. Rodzaje', p: 'Niezbędne — sesja, CSRF, wybór motywu. Analityczne — GA4, tylko po kliknięciu „Akceptuję". Marketingowych nie używamy.' },
      { h: '3. Zarządzanie zgodą', p: 'Zgodę zmienisz w stopce „Ustawienia cookies" lub w przeglądarce.' },
      { h: '4. Kontakt', p: 'Pytania o cookies: kontakt@sitemorph.pl.' },
    ],
  },
};

// ============================================================================
// STYLE LANDINGU — spokojne, niemal czarne tło. Bez różu, magenty i fioletu.
// Jeden akcent: turkus przechodzący w limonkę, używany oszczędnie.
// ============================================================================
const LANDING_CSS = `
.sm-landing {
  font-family: 'SF Pro Display', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  background: var(--sm-bg);
  color: var(--sm-text);
}

/* Subtelna siatka prowadząca — neutralna, bez świecących plam. */
.sm-landing-grid {
  position: absolute; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(var(--sm-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--sm-border) 1px, transparent 1px);
  background-size: 64px 64px;
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 75%);
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 75%);
  opacity: 0.5;
}

.sm-landing-preview {
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-lg);
  background: var(--sm-surface);
  overflow: hidden;
}

.sm-landing-step-num {
  font-size: 13px; font-weight: 600; letter-spacing: 0.08em;
  color: var(--sm-text-3);
}

@media (prefers-reduced-motion: reduce) {
  .sm-landing video { display: none; }
}
`;

// ============================================================================
// LOGOMARK — abstrakcyjny znak 4-ćwiartkowy (SiteMorph)
// ============================================================================
const LogoMark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 256 256" className={className} fill="currentColor" aria-hidden>
    <path d="M 0 128 C 70.692 128 128 185.308 128 256 L 64 256 C 64 220.654 35.346 192 0 192 Z M 256 192 C 220.654 192 192 220.654 192 256 L 128 256 C 128 185.308 185.308 128 256 128 Z M 128 0 C 128 70.692 70.692 128 0 128 L 0 64 C 35.346 64 64 35.346 64 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z" />
  </svg>
);

const Wordmark = ({ size = 'base' }: { size?: 'base' | 'lg' }) => (
  <span className={`font-semibold tracking-[-0.03em] ${size === 'lg' ? 'text-[22px]' : 'text-[18px]'}`}>
    Site<span className="sm-brand-gradient">Morph</span>
  </span>
);

// ============================================================================
// PODGLĄD PRODUKTU — czytelne okno zamiast dekoracyjnego mockupu
// ============================================================================
const ProductPreview = () => (
  <div className="sm-landing-preview shadow-2xl">
    {/* pasek okna */}
    <div className="flex items-center gap-3 border-b border-[var(--sm-border)] px-4 py-3">
      <Monitor size={16} className="text-[var(--sm-text-3)]" />
      <span className="text-[14px] font-medium text-[var(--sm-text-2)]">sitemorph.pl / kreator</span>
      <span className="sm-pill ml-auto">Gotowa</span>
    </div>
    <div className="grid gap-0 md:grid-cols-[minmax(0,320px)_1fr]">
      {/* panel sterowania */}
      <div className="space-y-4 border-b border-[var(--sm-border)] p-5 md:border-b-0 md:border-r">
        <div className="sm-label">Opis strony</div>
        <div className="rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)] p-3.5 text-[15px] leading-relaxed text-[var(--sm-text-2)]">
          Restauracja z menu, galerią i rezerwacją online
        </div>
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-[var(--sm-text-2)]">Tryb</span>
          <span className="font-medium">S1 · Ultra · Ultra+</span>
        </div>
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-[var(--sm-text-2)]">Koszt</span>
          <span className="font-medium">15 kredytów</span>
        </div>
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)] px-3.5 py-3 text-[14px]">
          <Check size={16} className="text-[var(--sm-success)]" />
          <span>Projekt gotowy w 1 pliku React</span>
        </div>
      </div>
      {/* wynik */}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--sm-text-2)]">
          <Sparkles size={15} className="text-[var(--sm-accent)]" />
          <span>Komponenty wygenerowane dla tej branży</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Hero z godzinami', 'Menu z cenami', 'Galeria', 'Opinie', 'Mapa i kontakt'].map((s) => (
            <span key={s} className="sm-pill">{s}</span>
          ))}
        </div>
        <div className="mt-5 space-y-2">
          <div className="h-2.5 w-3/4 rounded-full bg-[var(--sm-surface-3)]" />
          <div className="h-2.5 w-1/2 rounded-full bg-[var(--sm-surface-3)]" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)]" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ============================================================================
// GŁÓWNY WIDOK
// ============================================================================
export const PublicLandingView = ({
  onEnterApp,
  theme,
  setTheme,
  session,
  onShowAuth,
  onLogout,
}: {
  onEnterApp: (tab?: string) => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  session: any;
  onShowAuth: () => void;
  onLogout: () => void;
}) => {
  const [legalDoc, setLegalDoc] = useState<null | 'regulamin' | 'prywatnosc' | 'cookies'>(null);
  const [yearly, setYearly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  const scrollToId = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const plans = [
    {
      tier: 'Starter', monthly: '49 zł/mies.', yearly: '490 zł/rok',
      desc: 'Dla twórców, którzy zaczynają sprzedawać pierwsze strony.',
      features: ['100 kredytów AI miesięcznie', 'Kreator stron AI', 'Lead Finder — 10 firm/mies.', '3 projekty', 'Podgląd na żywo'],
      pro: false,
    },
    {
      tier: 'Pro', monthly: '99 zł/mies.', yearly: '990 zł/rok',
      desc: 'Dla freelancerów, którzy robią strony regularnie.',
      features: ['200 kredytów AI miesięcznie', 'Lead Finder — 30 firm/mies.', '10 projektów', 'Galeria i animacje', 'Wsparcie priorytetowe'],
      pro: true,
    },
    {
      tier: 'Business', monthly: '199 zł/mies.', yearly: '1 990 zł/rok',
      desc: 'Dla agencji i zespołów pracujących z klientami.',
      features: ['500 kredytów AI miesięcznie', 'Lead Finder — 100 firm/mies.', 'Nieograniczone projekty', 'Własna domena', 'Fakturowanie 0% prowizji'],
      pro: false,
    },
  ];

  const navLinks: Array<[string, string]> = [
    ['Jak to działa', 'jak-to-dziala'],
    ['Funkcje', 'funkcje'],
    ['Cennik', 'cennik'],
  ];

  return (
    <div className="sm-landing relative min-h-screen overflow-x-hidden">
      <style>{LANDING_CSS}</style>

      {/* tło: mocno wygaszony materiał wideo + neutralna siatka */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <video
          autoPlay loop muted playsInline
          className="h-full w-full object-cover opacity-[0.28]"
          src={VIDEO_URL}
        />
        <div className="absolute inset-0 bg-[#070809]/85" />
        <div className="sm-landing-grid" />
      </div>

      {/* ================= NAWIGACJA (jedyna na tej stronie) ================= */}
      <header
        ref={headerRef}
        className="sticky top-0 z-40 border-b border-[var(--sm-border)] bg-[var(--sm-bg)]/85 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-4 px-5">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex min-h-[44px] items-center gap-2.5 bg-transparent border-none cursor-pointer text-[var(--sm-text)]"
            aria-label="SiteMorph — początek strony"
          >
            <LogoMark className="h-7 w-7" />
            <Wordmark />
          </button>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Sekcje strony">
            {navLinks.map(([label, id]) => (
              <button
                key={id}
                onClick={() => scrollToId(id)}
                className="min-h-[44px] rounded-[10px] px-3.5 text-[15px] font-medium text-[var(--sm-text-2)] hover:bg-[var(--sm-surface-2)] hover:text-[var(--sm-text)] transition-colors cursor-pointer border-none bg-transparent"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="sm-icon-btn"
              title={theme === 'dark' ? 'Motyw jasny' : 'Motyw ciemny'}
              aria-label="Zmień motyw"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {session ? (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="hidden max-w-[160px] truncate text-[14px] text-[var(--sm-text-2)] lg:block">{session.user?.email}</span>
                <button onClick={onLogout} className="sm-btn">Wyloguj</button>
                <button onClick={() => onEnterApp('dashboard')} className="sm-btn sm-btn-primary">Wróć do aplikacji</button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <button onClick={onShowAuth} className="sm-btn">Zaloguj się</button>
                <button onClick={() => onEnterApp('dashboard')} className="sm-btn sm-btn-primary">
                  Zacznij zarabiać <ArrowRight size={16} />
                </button>
              </div>
            )}

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm-icon-btn md:hidden"
              aria-label={menuOpen ? 'Zamknij menu' : 'Otwórz menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-[var(--sm-border)] bg-[var(--sm-bg)] md:hidden"
            >
              <div className="flex flex-col gap-1 p-4">
                {navLinks.map(([label, id]) => (
                  <button key={id} onClick={() => scrollToId(id)} className="sm-nav-item">{label}</button>
                ))}
                <div className="mt-3 flex flex-col gap-2">
                  {session ? (
                    <>
                      <button onClick={onLogout} className="sm-btn">Wyloguj</button>
                      <button onClick={() => onEnterApp('dashboard')} className="sm-btn sm-btn-primary">Wróć do aplikacji</button>
                    </>
                  ) : (
                    <>
                      <button onClick={onShowAuth} className="sm-btn">Zaloguj się</button>
                      <button onClick={() => onEnterApp('dashboard')} className="sm-btn sm-btn-primary">Zacznij zarabiać</button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ================= HERO ================= */}
      <section id="hero" className="relative z-10 mx-auto max-w-[1200px] scroll-mt-24 px-5 pb-16 pt-14 md:pb-24 md:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--sm-text)] sm:text-[44px] md:text-[56px]">
            Buduj strony.<br />
            <span className="sm-brand-gradient">Zarabiaj.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-[1.6] text-[var(--sm-text-2)]">
            SiteMorph to studio AI dla twórców stron. Jedno zdanie o firmie klienta —
            gotowa witryna z układem, treścią i zdjęciami dobranymi do branży.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button onClick={() => onEnterApp('dashboard')} className="sm-btn sm-btn-lg sm-btn-primary">
              Zacznij zarabiać <ArrowRight size={18} />
            </button>
            <button onClick={() => scrollToId('jak-to-dziala')} className="sm-btn sm-btn-lg">
              Jak to działa
            </button>
          </div>
          <p className="mt-4 text-[14px] text-[var(--sm-text-3)]">
            15 kredytów na start · bez karty · anulujesz kiedy chcesz
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 md:mt-16"
        >
          <ProductPreview />
        </motion.div>
      </section>

      {/* ================= JAK TO DZIAŁA ================= */}
      <section id="jak-to-dziala" className="relative z-10 scroll-mt-24 border-t border-[var(--sm-border)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16 md:py-20">
          <h2 className="sm-h1">Jak to działa</h2>
          <p className="mt-3 max-w-xl text-[16px] text-[var(--sm-text-2)]">
            Trzy kroki od pomysłu do strony, którą możesz pokazać klientowi.
          </p>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {LANDING_HOW_STEPS.map((s) => (
              <div key={s.num} className="border-t border-[var(--sm-border)] pt-5">
                <div className="sm-landing-step-num">{s.num}</div>
                <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.6] text-[var(--sm-text-2)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= DWA MODUŁY ================= */}
      <section id="funkcje" className="relative z-10 scroll-mt-24 border-t border-[var(--sm-border)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16 md:py-20">
          <h2 className="sm-h1">Dwa moduły, jedna robota</h2>
          <p className="mt-3 max-w-xl text-[16px] text-[var(--sm-text-2)]">
            Znajdź klienta, a potem zbuduj mu stronę. Wszystko w jednym panelu.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {/* Kreator AI */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)]">
                  <Wrench size={20} className="text-[var(--sm-accent)]" />
                </span>
                <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Kreator AI</h3>
              </div>
              <p className="mt-4 text-[16px] leading-[1.6] text-[var(--sm-text-2)]">
                Wklej dane firmy albo opisz ją własnymi słowami. Kreator generuje kompletny
                projekt React — sekcje, typografię, kolory i treści dopasowane do branży.
                Poprawiasz w podglądzie na żywo i publikujesz jednym kliknięciem.
              </p>
              <ul className="mt-5 space-y-2.5">
                {['Układ i treść dobrane do branży', 'Podgląd prawdziwego Reacta', 'Zapis projektu i historia wersji', 'Publikacja na subdomenie lub własnej domenie'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[15px] text-[var(--sm-text-2)]">
                    <Check size={17} className="mt-0.5 shrink-0 text-[var(--sm-accent)]" /> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Lead Finder */}
            <div className="flex flex-col lg:border-l lg:border-[var(--sm-border)] lg:pl-8">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)]">
                  <Search size={20} className="text-[var(--sm-accent)]" />
                </span>
                <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Lead Finder</h3>
              </div>
              <p className="mt-4 text-[16px] leading-[1.6] text-[var(--sm-text-2)]">
                Wybierz kraj, miasto i branżę — dostajesz listę lokalnych firm z telefonem
                i adresem. Filtr „bez strony" pokazuje tych, którym witryna jest najbardziej
                potrzebna. Z listy przechodzisz od razu do budowania strony.
              </p>
              <div className="mt-5 space-y-2.5">
                {[
                  { icon: MapPin, text: 'Lokalne firmy z adresem i telefonem' },
                  { icon: Search, text: 'Filtr firm bez własnej strony' },
                  { icon: Info, text: 'Dane z OpenStreetMap — przed kontaktem potwierdź informacje o firmie' },
                ].map((row) => (
                  <div key={row.text} className="flex items-start gap-2.5 text-[15px] text-[var(--sm-text-2)]">
                    <row.icon size={17} className="mt-0.5 shrink-0 text-[var(--sm-accent)]" /> {row.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CENNIK ================= */}
      <section id="cennik" className="relative z-10 scroll-mt-24 border-t border-[var(--sm-border)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="sm-h1">Cennik</h2>
              <p className="mt-3 max-w-lg text-[16px] text-[var(--sm-text-2)]">
                Wybierz plan na start. Płatność miesięczna, bez zobowiązań.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[15px] text-[var(--sm-text-2)]">Rozliczenie roczne</span>
              <button
                role="switch"
                aria-checked={yearly}
                aria-label="Przełącz rozliczenie roczne"
                onClick={() => setYearly(!yearly)}
                className="grid h-11 w-14 shrink-0 place-items-center bg-transparent border-none cursor-pointer p-0"
              >
                <span
                  className={`relative block h-7 w-12 rounded-full border transition-colors ${yearly ? 'border-transparent bg-[var(--sm-accent)]' : 'border-[var(--sm-border-strong)] bg-[var(--sm-surface-2)]'}`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full transition-all ${yearly ? 'left-6 bg-[var(--sm-accent-ink)]' : 'left-1 bg-[var(--sm-text-3)]'}`}
                  />
                </span>
              </button>
              <span className="text-[15px] text-[var(--sm-text-2)]">2 miesiące gratis</span>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.tier}
                className={`flex flex-col rounded-[14px] border p-6 ${p.pro ? 'border-[var(--sm-accent)]' : 'border-[var(--sm-border)]'} bg-[var(--sm-surface)]`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[19px] font-semibold tracking-[-0.02em]">{p.tier}</h3>
                  {p.pro && <span className="sm-pill">Najczęściej wybierany</span>}
                </div>
                <div className="mt-4 text-[30px] font-semibold tracking-[-0.03em] leading-none">
                  {yearly ? p.yearly : p.monthly}
                </div>
                <p className="mt-3 text-[15px] leading-[1.6] text-[var(--sm-text-2)]">{p.desc}</p>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[15px] text-[var(--sm-text-2)]">
                      <Check size={17} className="mt-0.5 shrink-0 text-[var(--sm-accent)]" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onEnterApp('pricing')}
                  className={`sm-btn mt-7 w-full ${p.pro ? 'sm-btn-primary' : ''}`}
                >
                  Wybierz plan {p.tier}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= KOŃCOWE CTA ================= */}
      <section className="relative z-10 border-t border-[var(--sm-border)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="sm-h1 max-w-2xl">Jedno zdanie. Gotowa strona.</h2>
            <p className="mt-4 max-w-xl text-[17px] leading-[1.6] text-[var(--sm-text-2)]">
              Zacznij od darmowych kredytów i sprawdź na własnym przykładzie, ile pracy
              zajmuje dziś postawienie strony lokalnej firmie.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => onEnterApp('dashboard')} className="sm-btn sm-btn-lg sm-btn-primary">
                Zbuduj pierwszą stronę <ArrowRight size={18} />
              </button>
              <button onClick={() => scrollToId('cennik')} className="sm-btn sm-btn-lg">
                Zobacz cennik
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="relative z-10 border-t border-[var(--sm-border)]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6" />
            <Wordmark />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-[14px] text-[var(--sm-text-3)]">
              © {new Date().getFullYear()} SiteMorph
            </span>
            {([['Regulamin', 'regulamin'], ['Prywatność', 'prywatnosc'], ['Cookies', 'cookies']] as const).map(([label, key]) => (
              <button
                key={key}
                onClick={() => setLegalDoc(key)}
                className="min-h-[44px] rounded-[10px] px-3 text-left text-[14px] text-[var(--sm-text-2)] hover:bg-[var(--sm-surface-2)] hover:text-[var(--sm-text)] transition-colors cursor-pointer border-none bg-transparent"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* ================= MODAL PRAWNY ================= */}
      <AnimatePresence>
        {legalDoc && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLegalDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.97, y: 10, opacity: 0 }}
              transition={springTransition}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[14px] border border-[var(--sm-border)] bg-[var(--sm-surface)] sm:rounded-[14px]"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--sm-border)] p-5">
                <div>
                  <h3 className="text-[19px] font-semibold tracking-[-0.02em]">{LEGAL_DOCS[legalDoc].title}</h3>
                  <p className="mt-1 text-[13px] text-[var(--sm-text-3)]">{LEGAL_DOCS[legalDoc].updated}</p>
                </div>
                <button onClick={() => setLegalDoc(null)} className="sm-icon-btn" aria-label="Zamknij">
                  <X size={18} />
                </button>
              </div>
              <div className="sm-scroll space-y-5 overflow-y-auto p-5">
                {LEGAL_DOCS[legalDoc].sections.map((s) => (
                  <div key={s.h}>
                    <h4 className="text-[16px] font-semibold">{s.h}</h4>
                    <p className="mt-1.5 text-[15px] leading-[1.65] text-[var(--sm-text-2)]">{s.p}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end border-t border-[var(--sm-border)] p-4">
                <button onClick={() => setLegalDoc(null)} className="sm-btn sm-btn-primary">Rozumiem</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// re-eksport dla kompatybilności (używane w innych miejscach)
export { cineChild, cineParent, cineSoft, springTransition };
