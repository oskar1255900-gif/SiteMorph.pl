import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { supabase } from './lib/supabase';
import {
  Sparkles,
  ArrowRight,
  Play,
  LayoutDashboard,
  HelpCircle,
  CheckCircle2,
  Globe,
  LogOut,
  Paperclip,
  Send,
  Monitor,
  Code as CodeIcon,
  RefreshCw,
  Zap,
  Check,
  Plus,
  Search,
  Settings,
  DollarSign,
  MapPin,
  Briefcase,
  Phone,
  Sun,
  Moon,
  GraduationCap,
  X,
  ChevronRight,
  Home,
  Coffee,
  ArrowLeft,
  Maximize,
  MessageSquare,
  Clock,
  Coins,
  Wrench,
  Receipt,
  Wallet,
  Info,
  Menu,
  Copy as CopyIcon,
  Image as ImageIcon,
  Eye,
  MousePointer2,
  Save
} from 'lucide-react';

// ============================================================================
// 1. TYPY DANYCH
// ============================================================================
export interface GeneratedWebsite {
  title: string;
  category: string;
  domain: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  files: Record<string, string>;
}

export interface Lead {
  id: string;
  name: string;
  category?: string;
  industry?: string;
  location?: string;
  city?: string;
  country?: string;
  phone?: string;
  website?: string | null;
  websiteStatus?: string;
  readinessScore?: number;
  leadScore?: number;
  estBudget?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  osmId?: string;
  osmType?: string;
  rating?: number | null;
  userRatingsTotal?: number | null;
  openingHours?: string | null;
  photos?: string[];
}

export interface Invoice {
  id: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  status: 'Opłacona' | 'Oczekująca';
  date: string;
}

// ============================================================================
// 2. WARIANTY ANIMACJI
// ============================================================================
const springTransition = {
  type: 'spring',
  stiffness: 400,
  damping: 30
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 350, damping: 25 }
  }
};

/* CINEMATIC — kinowe wejścia z blur, rotacją 3D, overshootem, depth-of-field */
const cineParent = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.06 } }
};

const cineChild = {
  hidden: { opacity: 0, y: 120, z: -200, scale: 0.85, rotateX: -30, rotateY: 8, filter: 'blur(20px)' },
  visible: {
    opacity: 1,
    y: 0,
    z: 0,
    scale: 1,
    rotateX: 0,
    rotateY: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 100, damping: 18, mass: 1.2, duration: 0.9 }
  }
};

const cineSoft = {
  hidden: { opacity: 0, y: 80, z: -100, scale: 1.08, rotateX: -12, filter: 'blur(24px)' },
  visible: {
    opacity: 1,
    y: 0,
    z: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 85, damping: 22, mass: 1.1 }
  }
};

/* Ultra-cinematic dla hero/headlines */
const cineHero = {
  hidden: { opacity: 0, y: 160, z: -400, scale: 0.7, rotateX: -40, rotateZ: -4, filter: 'blur(32px)' },
  visible: {
    opacity: 1,
    y: 0,
    z: 0,
    scale: 1,
    rotateX: 0,
    rotateZ: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 70, damping: 16, mass: 1.5, duration: 1.2 }
  }
};

/* Cinematic stagger dla list/gridów */
const cineStagger = {
  hidden: { opacity: 0, y: 60, scale: 0.9, rotateX: -15, filter: 'blur(12px)' },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 120, damping: 20, delay: i * 0.08, mass: 1 }
  })
};

/* Cinematic page transition */
const cinePage = {
  initial: { opacity: 0, y: 40, scale: 0.96, filter: 'blur(16px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -30, scale: 0.98, filter: 'blur(20px)' },
  transition: { type: 'spring', stiffness: 100, damping: 20 }
};

const getUserId = () => {
  try {
    let id = localStorage.getItem('sitemorph-user-id');
    if (!id) { id = 'user-' + Math.random().toString(36).slice(2, 9); localStorage.setItem('sitemorph-user-id', id); }
    return id;
  } catch { return 'anon'; }
};

const PREVIEW_FALLBACK_HTML = `<!doctype html><html lang="pl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>SiteMorph Preview</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white text-neutral-900"><div class="max-w-6xl mx-auto px-6 py-16 text-center"><h1 class="text-4xl font-black">Podglad dziala</h1><p class="mt-3 text-neutral-600">Vite + React + Tailwind — wygenerowane przez SiteMorph + Laguna S 2.1</p></div></body></html>`;

// ============================================================================
// 3. STYLE GLOBALNE (INSTRUMENT SERIF ITALIC + SF PRO)
// ============================================================================
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

    /* SF PRO DISPLAY (pliki lokalne z /fonts) */
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYREGULAR.OTF') format('opentype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYMEDIUM.OTF') format('opentype');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYBOLD.OTF') format('opentype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYHEAVYITALIC.OTF') format('opentype');
      font-weight: 800 900;
      font-style: italic;
      font-display: swap;
    }

    @keyframes marquee {
      0% { transform: translateX(0%); }
      100% { transform: translateX(-50%); }
    }
    .animate-marquee { display: flex; width: 200%; animation: marquee 26s linear infinite; }

    /* Czcionka akcentowa Instrument Serif (elegancka kursywa) */
    .font-story-script {
      font-family: 'Instrument Serif', Georgia, 'Times New Roman', serif;
      font-style: italic;
      font-weight: 400;
      letter-spacing: -0.01em;
    }

    /* Subtelny gradient limonkowo-szmaragdowy */
    .text-gradient-lime-soft {
      background: linear-gradient(135deg, #bef264 0%, #34d399 50%, #a3e635 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Animowany, płynący gradient limonkowy (splash) */
    @keyframes limeFlow {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    .text-gradient-lime-flow {
      background: linear-gradient(90deg, #65a30d, #a3e635, #34d399, #bef264, #34d399, #a3e635, #65a30d);
      background-size: 200% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: limeFlow 9s linear infinite;
    }

    /* Landing scale 90% -> 100% (desktop) */
    .landing-scale { zoom: 1.095; }
    @media (max-width: 768px) { .landing-scale { zoom: 1; } }

    /* Morphing blob (legal modal) */
    @keyframes legalMorph {
      0%, 100% { border-radius: 62% 38% 58% 42% / 42% 62% 38% 58%; transform: rotate(0deg) scale(1); }
      33% { border-radius: 38% 62% 42% 58% / 58% 38% 62% 42%; transform: rotate(7deg) scale(1.06); }
      66% { border-radius: 58% 42% 38% 62% / 38% 58% 42% 62%; transform: rotate(-7deg) scale(0.96); }
    }
    .legal-blob { animation: legalMorph 7.5s ease-in-out infinite; }

    /* Cinematic morphing blob (sekcje) */
    .morph-blob {
      animation: legalMorph 8s ease-in-out infinite;
      will-change: transform, border-radius;
    }

    * {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* SF PRO dla całej reszty aplikacji */
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100%;
      font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
      letter-spacing: -0.015em;
      overflow-x: hidden;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 10px; }
  `}</style>
);

// ============================================================================
// 4. KOMPONENTY PRZYCISKÓW I BADGE
// ============================================================================
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled,
  type = 'button'
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'lime' | 'outline' | 'ghost' | 'blue';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5 rounded-full font-bold',
    md: 'text-xs px-5 py-2.5 gap-2 rounded-full font-black',
    lg: 'text-sm px-7 py-3.5 gap-2.5 rounded-full font-black'
  };

  const variantStyles = {
    primary: 'bg-blue-600 text-white dark:bg-white dark:text-black shadow-lg shadow-blue-600/20 dark:shadow-white/10 hover:opacity-90',
    lime: 'bg-gradient-to-r from-lime-300 to-emerald-400 text-black hover:opacity-95 font-black shadow-lg shadow-lime-400/20',
    blue: 'bg-blue-600 text-white hover:bg-blue-700 font-black shadow-md shadow-blue-600/30',
    outline: 'bg-transparent text-blue-600 dark:text-white border border-blue-300 dark:border-neutral-700 hover:bg-blue-50 dark:hover:bg-neutral-900',
    ghost: 'bg-transparent text-blue-600 dark:text-white hover:bg-blue-50 dark:hover:bg-neutral-900'
  };

  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={springTransition}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};

const Badge = ({
  children,
  type = 'default'
}: {
  children: React.ReactNode;
  type?: 'default' | 'lime' | 'blue';
}) => {
  const styles = {
    default: 'bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-white border-blue-200 dark:border-neutral-800 font-bold',
    lime: 'bg-lime-50 dark:bg-neutral-900 text-lime-700 dark:text-lime-300 border-lime-300 dark:border-lime-500/40 font-black',
    blue: 'bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-white border-blue-200 dark:border-neutral-800 font-bold'
  };

  return (
    <motion.span 
      layout
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] border tracking-tight ${styles[type]}`}
    >
      {children}
    </motion.span>
  );
};

// ============================================================================
// 5. SPLASH SCREEN (MINIMALISTYCZNY: WIELKI SITEMORPH + LIME GRADIENT)
// ============================================================================
const SplashScreen = ({ onComplete, theme }: { onComplete: () => void; theme: 'light' | 'dark' }) => {
  const letters = 'SITEMORPH'.split('');

  useEffect(() => {
    const timer = setTimeout(() => onComplete(), 1400);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none transition-colors duration-300 ${
        theme === 'dark' ? 'bg-black' : 'bg-white'
      }`}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)', transition: { duration: 0.28, ease: 'easeInOut' } }}
    >
      {/* Wielki napis SITEMORPH */}
      <div className="flex items-baseline justify-center px-4">
        {letters.map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 40, scale: 1.6, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ delay: 0.06 + i * 0.038, type: 'spring', stiffness: 300, damping: 24 }}
            className="text-gradient-lime-flow leading-none tracking-tighter"
            style={{
              fontFamily: "'SF Pro Display', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(3rem, 13vw, 11rem)',
              animationDelay: `${-(i / letters.length) * 9}s`
            }}
          >
            {ch}
          </motion.span>
        ))}
      </div>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0, letterSpacing: '0.6em' }}
        animate={{ opacity: 1, letterSpacing: '0.35em' }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="mt-6 text-[11px] sm:text-xs font-bold uppercase text-neutral-400"
        style={{ fontFamily: "'SF Pro Display', sans-serif" }}
      >
        Buduj strony. Zarabiaj.
      </motion.p>
    </motion.div>
  );
};

// ----------------------------------------------------------------------------
// Landing – dane sekcji
// ----------------------------------------------------------------------------
const LANDING_HOW_STEPS = [
  {
    num: '01',
    title: 'Opisz pomysł jednym zdaniem',
    desc: 'Napisz, dla kogo jest strona. Jedno zdanie wystarczy — resztę dopracuje SiteMorph.',
    mockup: (
      <div className="w-full max-w-[250px] rounded-2xl border p-4 shadow-lg text-left bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
        <p className="text-xs font-bold mb-3">Stwórz stronę dla barbera z rezerwacją</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="text-[9px] font-black px-2 py-1 rounded-full bg-blue-600 dark:bg-white text-white dark:text-black">Generuj</span>
            <span className="text-[9px] font-black px-2 py-1 rounded-full bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">Styl</span>
          </div>
          <Send size={13} className="opacity-60" />
        </div>
      </div>
    )
  },
  {
    num: '02',
    title: 'Poprawiaj bez ograniczeń',
    desc: 'Kliknij w sekcję lub po prostu napisz „rozjaśnij tło”. Każda zmiana pojawia się od razu.',
    mockup: (
      <div className="relative flex flex-col items-center">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-white dark:bg-neutral-900 border border-blue-200 dark:border-neutral-800 shadow-sm whitespace-nowrap">
          <CodeIcon size={9} /> Edytuj element
        </span>
        <div className="mt-3 rounded-xl border-2 border-blue-600 dark:border-white px-6 py-2.5 text-lg font-black shadow-md bg-white dark:bg-neutral-950">
          Większy baner<span className="animate-pulse">|</span>
        </div>
      </div>
    )
  },
  {
    num: '03',
    title: 'Wyślij ofertę, która sprzedaje',
    desc: 'Gotowa wiadomość z linkiem do projektu. Skopiuj do maila lub na IG — klient ogląda stronę.',
    mockup: (
      <div className="w-full max-w-[260px] rounded-2xl border p-4 shadow-lg text-left space-y-2.5 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
        <div className="text-[10px] font-black uppercase tracking-wider opacity-70">Wiadomość do klienta</div>
        <div className="rounded-xl p-3 text-[10px] font-semibold leading-relaxed bg-blue-50/70 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">
          „Cześć Anna! Przygotowałem darmowy projekt strony dla Studio Anna — zobacz: studio-anna.sitemorph.pl”
        </div>
        <div className="flex gap-1.5">
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-600 dark:bg-white text-white dark:text-black">E-mail</span>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">SMS</span>
        </div>
      </div>
    )
  }
];

const LANDING_FEATURE_TABS: Array<{ label: string; icon: any; title: string; desc: string; statBig: string; statSmall: string }> = [
  { label: 'Podgląd na żywo', icon: Globe, title: 'Pokaż postęp bez wysyłania plików', desc: 'Generujesz prywatny link. Klient ogląda każdą poprawkę na żywo — bez konta i bez załączników w mailu.', statBig: 'Na żywo', statSmall: 'podgląd dla klienta' },
  { label: 'Poprawki bez limitu', icon: RefreshCw, title: 'Dopracuj projekt do perfekcji', desc: 'Zmieniasz teksty, kolory i sekcje tak długo, jak trzeba. Historia wersji bez limitu i bez dopłat.', statBig: '∞ wersji', statSmall: 'bez dopłat' },
  { label: 'Projekt z AI', icon: Zap, title: 'Cała strona z jednego pomysłu', desc: 'AI dobiera układ, paletę i treści pod branżę klienta. Ty tylko zatwierdzasz efekt.', statBig: '2 min', statSmall: 'od pomysłu do projektu' },
  { label: 'Bez prowizji', icon: Wallet, title: 'Ty ustalasz stawkę', desc: 'Wyceniaj od 1 500 do 12 000 zł. Pieniądze trafiają bezpośrednio do Ciebie — 0% prowizji.', statBig: '0%', statSmall: 'prowizji od zleceń' }
];

// ----------------------------------------------------------------------------
// Panel administratora – hasło weryfikowane TYLKO po stronie backendu.
// Frontend wysyła SHA-256, backend porównuje z ADMIN_HASH (env). Brak hasła/hasha w kodzie.
// ----------------------------------------------------------------------------
const sha256Hex = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const ADMIN_STATS = [
  { label: 'Użytkownicy', value: '1 284', delta: '+62 / 24h', icon: LayoutDashboard },
  { label: 'Strony wygenerowane', value: '3 912', delta: '+148 / tydzień', icon: Globe },
  { label: 'MRR', value: '24 700 zł', delta: '+8.4% m/m', icon: Wallet },
  { label: 'Leady znalezione', value: '18 340', delta: '+940 / tydzień', icon: Search }
];

const ADMIN_USERS = [
  { name: 'oskar1255900', plan: 'Starter', pages: 2, spent: '49 zł', joined: '02.08.2026' },
  { name: 'anna.studio', plan: 'Pro', pages: 11, spent: '396 zł', joined: '14.06.2026' },
  { name: 'warsztat.karo', plan: 'Business', pages: 27, spent: '597 zł', joined: '03.03.2026' },
  { name: 'fitform.pl', plan: 'Pro', pages: 9, spent: '297 zł', joined: '22.05.2026' },
  { name: 'kwiaty.iwona', plan: 'Starter', pages: 3, spent: '147 zł', joined: '19.07.2026' }
];

const ADMIN_SERVICES = [
  { name: 'API Gateway', status: 'Operational', latency: '84 ms' },
  { name: 'Baza danych (Postgres)', status: 'Operational', latency: '12 ms' },
  { name: 'Silnik AI', status: 'Operational', latency: '2.1 s / strona' },
  { name: 'Kolejka generowania', status: 'Operational', latency: '0 zadań' },
  { name: 'Fakturowanie (Stripe)', status: 'Degraded', latency: '310 ms' }
];

const LEGAL_DOCS: Record<'regulamin' | 'prywatnosc' | 'cookies', { title: string; updated: string; sections: Array<{ h: string; p: string }> }> = {
  regulamin: {
    title: 'Regulamin serwisu SiteMorph',
    updated: 'Aktualizacja: 12 sierpnia 2026',
    sections: [
      { h: '§1. Postanowienia ogólne', p: 'Niniejszy regulamin określa zasady korzystania z platformy SiteMorph (sitemorph.pl) prowadzonej przez SiteMorph sp. z o.o. Korzystając z serwisu, akceptujesz regulamin w całości. Usługi świadczone są drogą elektroniczną zgodnie z ustawą z dnia 18 lipca 2002 r. Jeżeli nie akceptujesz warunków — nie korzystaj z serwisu.' },
      { h: '§2. Definicje', p: 'Użytkownik — osoba fizyczna, prawna lub j.d.g. posiadająca konto. Konto — zbiór danych Użytkownika umożliwiający dostęp do kreatora, Lead Finder i fakturowania. Kredyty AI — jednostki rozliczeniowe zużywane na generowanie i edycję stron. Treści — teksty, grafiki, układy wygenerowane przez AI na zlecenie Użytkownika.' },
      { h: '§3. Rejestracja i konto', p: 'Rejestracja wymaga podania adresu e-mail i hasła. Użytkownik odpowiada za bezpieczeństwo hasła. Jedno konto = jeden podmiot. Zabrania się udostępniania konta osobom trzecim oraz automatycznego scrapowania API bez zgody.' },
      { h: '§4. Usługi', p: 'SiteMorph udostępnia: (a) kreator stron AI, (b) wyszukiwarkę Lead Finder opartą o dane publiczne, (c) moduł podglądu na żywo, (d) fakturowanie bez prowizji. Generowane projekty możesz publikować na subdomenie *.sitemorph.pl lub własnej domenie po wykupieniu planu Business/Agencja.' },
      { h: '§5. Kredyty AI i płatności', p: 'Plany: Starter 49 zł/mies. (100 kredytów), Pro 99 zł (200), Business 199 zł (500). Kredyty odnawiają się co 30 dni, niewykorzystane przepadają. Dokupienie 100 kredytów — 46 zł. Płatności obsługuje Stripe/Przelewy24. Możesz anulować subskrypcję w dowolnym momencie — dostęp pozostaje do końca okresu. Zwrot w 14 dni dla konsumenta, jeśli nie wykorzystano >10% kredytów.' },
      { h: '§6. Prawa własności intelektualnej', p: 'Treści wygenerowane na Twoje zlecenie należą do Ciebie po opłaceniu planu. SiteMorph udziela niewyłącznej licencji na kod i hosting wygenerowanej strony. Zabrania się kopiowania i odsprzedaży samej platformy jako white-label poza planem Agencja.' },
      { h: '§7. Odpowiedzialność', p: 'SiteMorph dokłada staranności, ale nie gwarantuje, że wygenerowana treść będzie wolna od błędów. Użytkownik odpowiada za zgodność publikowanych treści z prawem (RODO, prawo autorskie, reklama). Dostępność serwisu celujemy na 99.5% SLA — przerwy techniczne ogłaszamy z 24h wyprzedzeniem.' },
      { h: '§8. Reklamacje', p: 'Reklamacje zgłaszasz na support@sitemorph.pl w 14 dni od zdarzenia. Odpowiadamy w 5 dni roboczych. Przy zasadnej reklamacji przyznajemy kredyty lub przedłużamy okres subskrypcji.' },
      { h: '§9. Postanowienia końcowe', p: 'Regulamin może ulec zmianie — poinformujemy e-mailem 14 dni przed wejściem zmian. W sprawach nieuregulowanych stosuje się prawo polskie. Sądem właściwym jest sąd w Warszawie. Kontakt: kontakt@sitemorph.pl, SiteMorph sp. z o.o., ul. Marszałkowska 1, 00-001 Warszawa.' }
    ]
  },
  prywatnosc: {
    title: 'Polityka prywatności',
    updated: 'Aktualizacja: 12 sierpnia 2026 — zgodna z RODO',
    sections: [
      { h: '1. Administrator', p: 'Administratorem danych jest SiteMorph sp. z o.o. (KRS 0000000000), kontakt: iod@sitemorph.pl. Inspektorem Ochrony Danych jest iod@sitemorph.pl.' },
      { h: '2. Jakie dane zbieramy', p: 'Konto: e-mail, nazwa firmy, NIP (jeśli podasz do faktur). Płatności: dane obsługuje Stripe — nie przechowujemy numerów kart. Logi: adres IP, data logowania, rodzaj przeglądarki. Lead Finder przetwarza wyłącznie dane publiczne z Google Business Profile.' },
      { h: '3. Cele i podstawy prawne', p: 'Art. 6 ust. 1 lit. b RODO — wykonanie umowy (utworzenie strony, hosting). Lit. c — obowiązki księgowe (faktury 5 lat). Lit. f — prawnie uzasadniony interes (bezpieczeństwo, analityka). Lit. a — zgoda na newsletter (możesz wycofać w każdej chwili).' },
      { h: '4. Odbiorcy danych', p: 'Podmioty przetwarzające: hosting OVH/Hetzner (UE), Stripe (płatności), Resend (maile), Google Analytics 4 (anonimizowane statystyki, tylko po zgodzie). Nie sprzedajemy danych. Transfer poza EOG wyłącznie na podstawie decyzji adekwatności lub SCC.' },
      { h: '5. Okres przechowywania', p: 'Konto — do usunięcia konta. Faktury — 5 lat od końca roku obrotowego. Logi — 12 miesięcy. Dane marketingowe — do wycofania zgody.' },
      { h: '6. Twoje prawa', p: 'Prawo dostępu, sprostowania, usunięcia, ograniczenia, przenoszenia, sprzeciwu oraz skarga do PUODO (ul. Stawki 2, Warszawa). Wniosek realizujemy w 30 dni na iod@sitemorph.pl. Usunięcie konta = usunięcie stron i projektów (nieodwracalne).' },
      { h: '7. Bezpieczeństwo', p: 'Szyfrowanie TLS, hasła hashowane bcrypt, kopie zapasowe codziennie, dostęp pracowników na zasadzie least-privilege i 2FA.' },
      { h: '8. Kontakt i zmiany', p: 'Pytania: iod@sitemorph.pl. O zmianach informujemy banerem i e-mailem 14 dni wcześniej.' }
    ]
  },
  cookies: {
    title: 'Polityka cookies',
    updated: 'Aktualizacja: 12 sierpnia 2026',
    sections: [
      { h: '1. Co to są cookies', p: 'Małe pliki tekstowe zapisywane na Twoim urządzeniu. Używamy ich, by serwis działał, zapamiętywał motyw (jasny/ciemny) i — po zgodzie — mierzył ruch.' },
      { h: '2. Rodzaje', p: 'Niezbędne — sesja, CSRF, wybór motywu (bez zgody, art. 173 Prawa telekomunikacyjnego). Funkcjonalne — zapamiętywanie języka, podglądu. Analityczne — GA4 (_ga, _ga_*, 13 mies.) tylko po kliknięciu „Akceptuję”. Marketingowe — nie używamy.' },
      { h: '3. Zarządzanie zgodą', p: 'Przy pierwszej wizycie pokazujemy baner. Zgodę zmienisz w stopce „Ustawienia cookies” lub w przeglądarce (Chrome: Ustawienia → Prywatność → Pliki cookie). Wycofanie zgody nie wpływa na pliki już zapisane.' },
      { h: '4. Jak długo', p: 'Sesyjne — do zamknięcia przeglądarki. Stałe: motyw — 12 mies., zgoda — 6 mies., GA — 13 mies. Po tym czasie prosimy ponownie o wybór.' },
      { h: '5. Narzędzia zewnętrzne', p: 'Google Analytics (Google Ireland Ltd.) — IP anonimizowane. Stripe — wykrywanie oszustw przy płatności. Szczegóły w polityce prywatności.' },
      { h: '6. Kontakt', p: 'Pytania o cookies: kontakt@sitemorph.pl. Więcej o cookies: wszystkoociasteczkach.pl (strona zewnętrzna).' }
    ]
  }
};

const ACADEMY_GUIDES: Array<{ title: string; category: string; level: string; time: string; excerpt: string; content: Array<{ h: string; p: string }> }> = [
  {
    title: 'Jak zdobyć pierwszego klienta w 7 dni',
    category: 'Sprzedaż',
    level: 'Początkujący',
    time: '9 min',
    excerpt: 'Gotowy plan outreach: od wyboru niszy po pierwszą fakturę.',
    content: [
      { h: '1. Wybierz wąską niszę', p: 'Zamiast pisać do wszystkich, skup się na 1 branży w 1 mieście. Przykład: „gabinet stomatologiczny w Poznaniu” lub „warsztat samochodowy w Gdańsku”. W Lead Finderze ustaw kraj Polska → miasto Poznań → branża Gabinet stomatologiczny. Otrzymasz 20–40 rekordów, z których połowa nie ma strony — to Twoja ciepła lista.' },
      { h: '2. Przygotuj darmowy mockup', p: 'W Kreatorze AI wpisz: „Stwórz nowoczesną stronę dla gabinetu Dentika w Poznaniu, jasna kolorystyka, sekcja cennik i rezerwacja online”. Wygeneruj, popraw nagłówek i skopiuj link podglądu (Podgląd na żywo). Masz dowód zamiast obietnicy.' },
      { h: '3. Wiadomość, która działa', p: 'Temat: Szybka propozycja dla Dentika – darmowy projekt strony\nCześć Anna,\nPrzygotowałem darmowy projekt strony dla Was — zobacz: dentika.sitemorph.pl/podglad-91x\nStrona jest gotowa do uruchomienia w 1 dzień, z rezerwacją online i mapą. Jeśli chcesz, wdrożę ją na Waszej domenie za 1 900 zł netto — płatność dopiero po akceptacji.\nPozdrawiam, Jan — Morph Studio\nWyślij 10 takich maili dziennie. Śledź otwarcia w Lead Finderze.' },
      { h: '4. Follow-up i zamknięcie', p: 'Dzień 3: „Cześć Anna, podbijam — projekt wygaśnie za 2 dni, mam wolny termin w piątek na wdrożenie.” Dzień 7: telefon. Zamknięcie: wyślij fakturę z modułu Finanse (Szablon: Projekt i wdrożenie strony 1 450 zł + copywriting 380 zł). 0% prowizji — całość trafia na Twoje konto. Po 3 klientów masz proces, który możesz powtarzać.' }
    ]
  },
  {
    title: 'Kreator AI: od promptu do publikacji w 5 minut',
    category: 'Kreator',
    level: 'Początkujący',
    time: '7 min',
    excerpt: 'Prompt → edycja → podgląd → publikacja. Dokładny flow krok po kroku.',
    content: [
      { h: 'Krok 1: Napisz prompt', p: 'W Pulpicie wpisz jedno zdanie: „Stwórz stronę dla barbera Złoty Grzebień w Warszawie, ciemny motyw, sekcje: usługi, cennik, rezerwacja, opinie, Instagram”. Unikaj ogólników typu „ładna strona” — AI potrzebuje branży, miasta i stylu.' },
      { h: 'Krok 2: Edytuj sekcje', p: 'Kliknij sekcję → wpisz „rozjaśnij tło” lub „dodaj sekcję z opiniami 4.9 ★”. Każda edycja to 2–5 kredytów i pojawia się w podglądzie na żywo. Użyj starterów (Nieruchomości, SaaS, Restauracja) jeśli brakuje Ci pomysłu.' },
      { h: 'Krok 3: Podgląd i akceptacja', p: 'Skopiuj link podglądu i wyślij klientowi. Klient otwiera na telefonie — widzi zmiany na żywo bez logowania. Gdy zaakceptuje, kliknij Opublikuj. Strona ląduje na *.sitemorph.io lub Twojej domenie (Business).' },
      { h: 'Krok 4: Publikacja', p: 'W Kreatorze → Opublikuj → wybierz domenę. SSL i hosting w cenie. Czas generowania 2–3 min, edycje 9–14 s. Historia wersji bez limitu — wrócisz do dowolnej wersji.' }
    ]
  },
  {
    title: 'Cennik, który sprzedaje: 1 500 – 12 000 zł',
    category: 'Biznes',
    level: 'Średniozaawansowany',
    time: '11 min',
    excerpt: 'Jak wyceniać bez zaniżania i jak sprzedawać pakiety.',
    content: [
      { h: 'Widełki realne', p: 'Polska 2024/2025: wizytówka AI: 800–1 900 zł, strona firmowa 5–7 podstron: 2 500–4 500 zł, landing + copywriting SEO: 4 000–7 000 zł, white-label dla agencji: 8 000–12 000 zł. Poniżej 800 zł psujesz rynek i marżę.' },
      { h: 'Pakiety', p: 'Pakiet Start: strona + podgląd + 1 poprawka — 1 900 zł. Pakiet Growth: Start + Lead Finder (20 leadów) + 3 poprawki + domena — 3 900 zł. Pakiet Premium: Growth + 12 miesięcy utrzymania — 7 900 zł. Klient wybiera środek — efekt kotwicy.' },
      { h: 'Upsell bez wciskania', p: 'Po akceptacji dodaj: „Chcesz rezerwację online? +400 zł, wdrożę w 1 dzień.” lub „Teksty SEO na bloga — 5 artykułów 380 zł”. Wystawiasz drugą fakturę w Finanse → Nowa faktura → status Oczekująca.' },
      { h: 'Negocjacje', p: 'Gdy klient mówi „za drogo”: nie obniżaj stawki, zmniejsz zakres. „OK, zrobimy 3 podstrony zamiast 6 za 1 450 zł”. Zawsze zostaw furtkę do dokupienia reszty później.' }
    ]
  },
  {
    title: 'Domena i publikacja bez bólu',
    category: 'Techniczne',
    level: 'Wszyscy',
    time: '6 min',
    excerpt: 'Podłącz własną domenę, SSL i przekierowania w 10 minut.',
    content: [
      { h: 'Opcja A: subdomena SiteMorph', p: 'Najprostsza: twojklient.sitemorph.io — działa od razu po kliknięciu Opublikuj. Dobre na pokaz i test. Możesz zmienić później na własną domenę bez utraty treści.' },
      { h: 'Opcja B: własna domena (zalecane)', p: 'Kup domenę (np. OVH, Aftermarket) → w Kreatorze → Opublikuj → Własna domena → wpisz np. zlotygrzebien.pl → skopiuj rekordy DNS (CNAME → cname.sitemorph.io, TXT do weryfikacji) → wklej u rejestratora. Propagacja 5–60 min.' },
      { h: 'SSL i przekierowania', p: 'Certyfikat Let’s Encrypt wystawia się automatycznie. Wymuś HTTPS w panelu Kreatora. Ustaw przekierowanie www → bez www (lub odwrotnie) jednym przełącznikiem. Test: wpisz https://twojadomena.pl — kłódka musi być zielona.' },
      { h: 'Checklista przed wysyłką do klienta', p: '1) favicon i tytuł SEO, 2) formularz kontaktowy test (wyślij próbkę), 3) RODO i cookies (wygeneruj w stopce), 4) podgląd na telefonie (link działa?), 5) faktura gotowa w Finanse. Dopiero wtedy wyślij link klientowi.' }
    ]
  }
];

// ============================================================================
// 6. WIDOK: EKRAN GŁÓWNY (LANDING SCROLLABLE)
// ============================================================================
const PublicLandingView = ({
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
  const [activeFeature, setActiveFeature] = useState(0);
  const [legalDoc, setLegalDoc] = useState<null | 'regulamin' | 'prywatnosc' | 'cookies'>(null);

  const scrollToId = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="min-h-screen bg-white dark:bg-black text-blue-600 dark:text-white transition-colors overflow-x-hidden landing-scale">
      
      {/* Kapsułkowy Navbar 1:1 */}
      <header className="pt-6 px-4 flex justify-center sticky top-0 z-40">
        <motion.div 
          layout
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={springTransition}
          className="w-full max-w-5xl backdrop-blur-xl border rounded-full py-2.5 px-6 shadow-xl flex items-center justify-between bg-white/95 dark:bg-black/95 border-blue-200 dark:border-neutral-800 text-blue-600 dark:text-white"
        >
          {/* Logo 1:1 */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onEnterApp('dashboard')}>
            <motion.div 
              layoutId="app-main-logo"
              className="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs bg-blue-600 text-white dark:bg-white dark:text-black shadow-md"
            >
              <Zap size={14} className="fill-current" />
            </motion.div>
            <span className="font-black text-base tracking-tight text-blue-600 dark:text-white">
              Site<span className="text-gradient-lime-soft font-story-script text-xl px-0.5">Morph</span>
            </span>
          </div>

          {/* Linki nawigacji (scrollują do sekcji) */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-blue-600 dark:text-white opacity-90">
            <button onClick={() => scrollToId('jak-to-dziala')} className="hover:text-emerald-400 transition-colors cursor-pointer bg-transparent border-none font-bold text-inherit">Jak to działa</button>
            <button onClick={() => scrollToId('funkcje')} className="hover:text-emerald-400 transition-colors cursor-pointer bg-transparent border-none font-bold text-inherit">Funkcje</button>
            <button onClick={() => scrollToId('leadfinder')} className="hover:text-emerald-400 transition-colors cursor-pointer bg-transparent border-none font-bold text-inherit">Lead Finder</button>
            <button onClick={() => scrollToId('rozliczenia')} className="hover:text-emerald-400 transition-colors cursor-pointer bg-transparent border-none font-bold text-inherit">Rozliczenia</button>
            <button onClick={() => onEnterApp('pricing')} className="hover:text-emerald-400 transition-colors cursor-pointer bg-transparent border-none font-bold text-inherit">Cennik</button>
          </nav>

          {/* Prawa strona: Przełącznik motywu + Przyciski 1:1 */}
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ rotate: 180, scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              transition={springTransition}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-neutral-900 text-blue-600 dark:text-white cursor-pointer border-none bg-transparent"
              title="Zmień motyw"
            >
              {theme === 'dark' ? <Sun size={15} className="text-white" /> : <Moon size={15} className="text-blue-600" />}
            </motion.button>

            {session ? (
              <>
                <span className="hidden sm:block text-xs font-bold opacity-70 max-w-[150px] truncate">{session.user?.email}</span>
                <button onClick={onLogout} className="text-xs font-bold hover:text-rose-500 transition-colors cursor-pointer bg-transparent border-none text-inherit hidden sm:block">Wyloguj</button>
              </>
            ) : (
              <button onClick={onShowAuth} className="text-xs font-bold hover:text-emerald-400 transition-colors cursor-pointer bg-transparent border-none text-inherit hidden sm:block">Zaloguj się</button>
            )}

            <Button variant="primary" size="sm" onClick={() => onEnterApp('dashboard')} className="px-5 font-black">
              Zacznij teraz
            </Button>
          </div>
        </motion.div>
      </header>

      {/* Hero Section (Lewa: Tekst, Prawa: Mockup ze wszystkimi pływającymi badge'ami) */}
      <section className="max-w-6xl mx-auto px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
        
        {/* LEWA KOLUMNA: TYTUŁ, BADGE, OPIS, PRZYCISKI (1:1) */}
        <motion.div 
          initial={{ opacity: 0, x: -60, filter: 'blur(16px)', scale: 0.94 }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)', scale: 1 }}
          transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.05 }}
          className="lg:col-span-5 space-y-6"
        >
          {/* Górna pigułka 1:1 */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold text-blue-600 dark:text-white bg-blue-50 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 shadow-sm">
            <Zap size={13} className="fill-current text-blue-600 dark:text-white" /> 
            <span>Zamień AI w stały zysk</span>
          </div>

          {/* Główny nagłówek 1:1 z czcionką Story Script dla ZARABIAJ. */}
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.08] text-blue-600 dark:text-white">
            Buduj strony.<br />
            <span className="font-story-script text-6xl sm:text-7xl text-gradient-lime-soft pr-2 inline-block align-baseline">
              Zarabiaj.
            </span>
          </h1>

          {/* Opis pod tytułem 1:1 */}
          <p className="text-blue-600 dark:text-white text-sm sm:text-base font-semibold leading-relaxed max-w-md opacity-90">
            Twórz zachwycające serwisy dla lokalnych firm w kilka minut dzięki AI. Bez kodowania. Wyceniaj od 1 500 do 12 000 zł za stronę.
          </p>

          {/* Dwa przyciski CTA 1:1 */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="primary" size="lg" onClick={() => onEnterApp('dashboard')} className="font-black">
              Zacznij zarabiać <ArrowRight size={16} />
            </Button>
            <Button variant="outline" size="lg" onClick={() => onEnterApp('pricing')} className="font-black">
              <Play size={15} className="fill-current" /> Zobacz jak to działa
            </Button>
          </div>
        </motion.div>

        {/* PRAWA KOLUMNA: MOCKUP PRZEGLĄDARKI 1:1 */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.86, x: 70, rotateY: -16, filter: 'blur(18px)' }}
          animate={{ opacity: 1, scale: 1, x: 0, rotateY: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 80, damping: 17, delay: 0.15 }}
          className="lg:col-span-7 relative"
          style={{ perspective: 1200 }}
        >
          {/* Cinematic morphing blob za mockupem */}
          <div className="pointer-events-none absolute -inset-10 -z-10 morph-blob bg-gradient-to-tr from-lime-200 via-emerald-100 to-lime-200 dark:from-lime-500/20 dark:via-emerald-400/10 dark:to-lime-400/20 blur-3xl opacity-60 dark:opacity-40" />

          {/* Pływający badge PRAWY GÓRNY 1:1 */}
          <motion.div 
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-6 right-2 sm:right-6 z-20 bg-white dark:bg-black border border-blue-200 dark:border-neutral-800 p-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold text-blue-600 dark:text-white"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white dark:bg-white dark:text-black flex items-center justify-center font-black">
              <Zap size={14} className="fill-current" />
            </div>
            <div>
              <div className="text-blue-600 dark:text-white font-black text-xs">Zbudowano w 2m 45s</div>
              <div className="text-[10px] opacity-75 font-semibold">Napędzane przez AI</div>
            </div>
          </motion.div>

          {/* Ramka Przeglądarki 1:1 */}
          <div className="rounded-3xl p-5 border shadow-2xl space-y-4 bg-white dark:bg-black border-blue-200 dark:border-neutral-800 text-blue-600 dark:text-white relative">
            
            {/* Pasek URL i Kropki 1:1 */}
            <div className="flex items-center justify-between border-b border-blue-100 dark:border-neutral-900 pb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[11px] font-mono text-blue-600 dark:text-white bg-blue-50 dark:bg-neutral-900 px-4 py-0.5 rounded-full border border-blue-200 dark:border-neutral-800 font-bold opacity-80">
                fryzjer-studio.pl
              </div>
              <div className="w-4" />
            </div>

            {/* Wnętrze makiety strony www 1:1 */}
            <div className="p-6 rounded-2xl bg-blue-50/60 dark:bg-neutral-950 text-blue-600 dark:text-white space-y-6 border border-blue-100 dark:border-neutral-900 relative">
              
              {/* Header makiety */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 shadow-sm" />
                  <span className="font-black text-xs tracking-tight">STUDIO ANNA</span>
                </div>
                <div className="flex gap-4 text-[10px] font-bold opacity-80">
                  <span>Oferta</span>
                  <span>Termin</span>
                  <span>O nas</span>
                </div>
              </div>

              {/* Treść hero makiety */}
              <div className="py-2 space-y-3">
                <div className="text-[9px] font-black uppercase tracking-wider opacity-75">
                  OTWARTE CODZIENNIE • KRAKÓW
                </div>
                <h3 className="text-2xl sm:text-3xl font-black leading-tight">
                  Zmień styl. <br />
                  Poczuj się pewnie.
                </h3>
                
                {/* Przyciski w makiecie */}
                <div className="flex gap-2 pt-1">
                  <span className="bg-blue-600 text-white dark:bg-white dark:text-black text-[10px] font-bold px-3.5 py-1.5 rounded-full shadow-sm">
                    Umów termin
                  </span>
                  <span className="border border-blue-300 dark:border-neutral-800 text-[10px] font-bold px-3.5 py-1.5 rounded-full">
                    Zobacz cennik
                  </span>
                </div>
              </div>

              {/* 3 kolorowe kafelki 1:1 ze zdjęcia */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md opacity-90" />
                <div className="h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 shadow-md opacity-90" />
                <div className="h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-md opacity-90 relative">
                  {/* Badge LIVE 1:1 na trzecim kafelku */}
                  <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                  </div>
                </div>
              </div>

              {/* Pływający badge LEWY DOLNY 1:1 */}
              <motion.div 
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-4 left-4 z-20 bg-white dark:bg-black border border-blue-200 dark:border-neutral-800 py-2.5 px-4 rounded-2xl shadow-2xl flex items-center gap-3 text-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Wallet size={16} />
                </div>
                <div>
                  <div className="font-black text-xs text-blue-600 dark:text-white">9 600 zł zarobione</div>
                  <div className="text-[10px] opacity-75 font-semibold text-blue-600 dark:text-white">W tym tygodniu</div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Ticker */}
      <div className="border-y py-3.5 overflow-hidden relative bg-white dark:bg-black border-blue-100 dark:border-neutral-900">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-10 text-[11px] font-bold text-blue-600 dark:text-white tracking-wide">
          {[
            'Bez kodowania', 'Strona w 5 minut', 'Powtarzalny przychód', '1500–12 000 zł za stronę', 'Natychmiastowy deploy',
            'Linki podglądu', 'Nielimitowane poprawki', 'Akceptacja klienta', 'Powered by SiteMorph AI', 'Bez kodowania', 'Strona w 5 minut',
            'Bez kodowania', 'Strona w 5 minut', 'Powtarzalny przychód', '1500–12 000 zł za stronę', 'Natychmiastowy deploy',
            'Linki podglądu', 'Nielimitowane poprawki', 'Akceptacja klienta', 'Powered by SiteMorph AI', 'Bez kodowania', 'Strona w 5 minut'
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-white opacity-80" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SEKCJA: JAK TO DZIAŁA */}
      <section id="jak-to-dziala" className="max-w-7xl mx-auto px-6 lg:px-8 pt-12 lg:pt-16 pb-10 scroll-mt-24 space-y-8">
        <motion.div
          variants={cineSoft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center space-y-4 relative"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[220px] morph-blob bg-gradient-to-tr from-lime-100 via-emerald-50 to-lime-100 dark:from-lime-500/10 dark:via-emerald-400/5 dark:to-lime-400/10 blur-3xl opacity-70" />
          <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[11px] font-black tracking-widest uppercase bg-blue-50 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800">
            <Sparkles size={13} /> Jak to działa
          </div>
          <h2 className="relative text-5xl sm:text-6xl lg:text-[58px] font-black tracking-tighter leading-[0.95]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Od jednego zdania<br />do działającej strony<span className="text-gradient-lime-soft">.</span>
          </h2>
          <p className="relative text-sm sm:text-[15px] font-bold opacity-80 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Napisz, czego potrzebujesz. Oglądaj, jak powstaje projekt. Poprawiaj, prosząc po prostu o zmianę — kolory, zdjęcia, treści.
          </p>
        </motion.div>

        <motion.div
          variants={cineParent}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          style={{ perspective: 1400 }}
        >
          {LANDING_HOW_STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              variants={cineChild}
              whileHover={{ y: -8, rotateX: 4, scale: 1.02 }}
              className="rounded-3xl border overflow-hidden flex flex-col bg-white dark:bg-black border-blue-100 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-shadow"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="h-60 flex items-center justify-center px-6 border-b bg-gradient-to-b from-blue-50/50 to-transparent dark:from-neutral-950/60 dark:to-transparent border-blue-100 dark:border-neutral-900">{s.mockup}</div>
              <div className="p-7 space-y-2.5 flex-1">
                <div className="flex items-center gap-3 text-[10px] font-black opacity-60" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
                  <span>{s.num}</span>
                  <span className="flex-1 h-px bg-blue-100 dark:bg-neutral-800" />
                </div>
                <h3 className="text-lg font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{s.title}</h3>
                <p className="text-sm font-bold opacity-75 leading-relaxed" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="flex justify-center">
          <Button variant="primary" size="md" onClick={() => onEnterApp('dashboard')} className="font-black">
            Zacznij teraz <ArrowRight size={16} />
          </Button>
        </div>
      </section>

      {/* SEKCJA: FUNKCJE */}
      <section id="funkcje" className="max-w-7xl mx-auto px-6 lg:px-8 py-14 lg:py-20 space-y-8 scroll-mt-24">
        <motion.div
          variants={cineSoft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center space-y-4 relative"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[220px] morph-blob bg-gradient-to-tr from-blue-100 via-lime-100 to-emerald-50 dark:from-blue-500/10 dark:via-lime-400/5 dark:to-emerald-400/10 blur-3xl opacity-60" />
          <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[11px] font-black tracking-widest uppercase bg-blue-50 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800">
            <LayoutDashboard size={13} /> Funkcje
          </div>
          <h2 className="relative text-5xl sm:text-6xl lg:text-[56px] font-black tracking-tighter leading-[0.95]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Wszystko, czego potrzebujesz,<br />żeby sprzedawać strony<span className="text-gradient-lime-soft">.</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ...springTransition, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2.5"
        >
          {LANDING_FEATURE_TABS.map((f, idx) => {
            const isActive = activeFeature === idx;
            return (
              <button
                key={f.label}
                onClick={() => setActiveFeature(idx)}
                className={`px-5 py-2 rounded-full text-xs font-black border transition-colors cursor-pointer ${isActive ? 'bg-blue-600 dark:bg-white text-white dark:text-black border-transparent shadow-md' : 'bg-transparent border-blue-200 dark:border-neutral-800 hover:border-emerald-400'}`}
                style={{ fontFamily: "'SF Pro Display', sans-serif" }}
              >
                {f.label}
              </button>
              );
            })}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, y: 30, scale: 0.97, rotateX: -8, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -24, scale: 0.97, rotateX: 8, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 140, damping: 20 }}
            className="rounded-[28px] border p-8 lg:p-10 grid lg:grid-cols-2 gap-10 bg-blue-50/40 dark:bg-neutral-950 border-blue-100 dark:border-neutral-900 shadow-xl"
            style={{ perspective: 1200 }}
          >
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-600 dark:bg-white text-white dark:text-black shadow-md">
                {(() => { const Icon = LANDING_FEATURE_TABS[activeFeature].icon; return <Icon size={22} />; })()}
              </div>
              <h3 className="text-3xl font-black tracking-tight leading-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{LANDING_FEATURE_TABS[activeFeature].title}</h3>
              <p className="text-sm font-bold leading-relaxed opacity-80 max-w-md" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{LANDING_FEATURE_TABS[activeFeature].desc}</p>
              <div className="flex items-baseline gap-8 pt-2">
                <div>
                  <div className="text-xl font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{LANDING_FEATURE_TABS[activeFeature].statBig}</div>
                  <div className="text-[10px] font-bold opacity-60 uppercase tracking-wider" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{LANDING_FEATURE_TABS[activeFeature].statSmall}</div>
                </div>
                <div className="text-sm font-black opacity-40">/</div>
                <div>
                  <div className="text-sm font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Bez logowania</div>
                  <div className="text-[10px] font-bold opacity-60" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>dla klienta</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-6 bg-white dark:bg-black border-blue-100 dark:border-neutral-800 shadow-sm min-h-[340px] flex items-center justify-center">
              {activeFeature === 0 && (
                <div className="w-full space-y-3">
                  <div className="rounded-2xl border p-4 space-y-3 bg-blue-50/40 dark:bg-neutral-900 border-blue-100 dark:border-neutral-800">
                    <div className="text-[9px] font-black uppercase tracking-wider opacity-70 flex items-center gap-1.5" style={{ fontFamily: "'SF Pro Display', sans-serif" }}><Globe size={10} /> Udostępnij podgląd</div>
                    <div className="flex items-center justify-between gap-2 rounded-full border px-3.5 py-1.5 bg-white dark:bg-black border-blue-100 dark:border-neutral-800">
                      <span className="text-[10px] font-mono truncate">podglad.sitemorph.pl/morph-8421</span>
                      <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-blue-600 dark:bg-white text-white dark:text-black shrink-0">Kopiuj</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-bold">
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Podgląd otwarty</span>
                      <span className="opacity-60">przed chwilą</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-2xl border p-3 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
                    <div className="w-7 h-7 rounded-full bg-blue-600 dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px] font-black shrink-0">AK</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black">„Wygląda świetnie, lecimy!”</div>
                    </div>
                    <span className="text-[9px] font-bold opacity-60 shrink-0">teraz</span>
                  </div>
                </div>
              )}
              {activeFeature === 1 && (
                <div className="w-full space-y-3 text-xs">
                  <div className="rounded-2xl border p-3 flex items-center justify-between bg-blue-50/60 dark:bg-neutral-900 border-blue-100 dark:border-neutral-800">
                    <span className="font-bold">Zmień kolor przycisku na limonkowy</span>
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  </div>
                  <div className="text-[10px] font-black opacity-60 text-center">✓ Gotowe — 9 s</div>
                  <div className="rounded-2xl border p-3 flex items-center justify-between bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
                    <span className="font-bold">Przyciemnij tło galerii</span>
                    <RefreshCw size={14} className="animate-spin opacity-60" />
                  </div>
                </div>
              )}
              {activeFeature === 2 && (
                <div className="w-full space-y-3">
                  <div className="rounded-xl border px-3 py-2.5 flex items-center gap-2 bg-blue-50/60 dark:bg-neutral-900 border-blue-100 dark:border-neutral-800">
                    <Sparkles size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-xs font-bold truncate">Stwórz stronę dla studia jogi w stylu boho</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-16 rounded-xl bg-gradient-to-br from-blue-600/20 to-emerald-400/20 border border-blue-100 dark:border-neutral-800 flex items-center justify-center">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] font-bold opacity-60 text-center">AI generuje sekcje i treści</div>
                </div>
              )}
              {activeFeature === 3 && (
                <div className="w-full space-y-3">
                  {[
                    { name: 'Studio Lily — kwiaciarnia', amount: '2 400 zł', status: 'Opłacona' },
                    { name: 'Barber Kings', amount: '1 800 zł', status: 'Oczekuje' }
                  ].map((r) => (
                    <div key={r.name} className="flex items-center justify-between rounded-xl border p-3 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
                      <span className="text-xs font-bold truncate pr-3">{r.name}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${r.status === 'Opłacona' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>{r.amount}</span>
                    </div>
                  ))}
                  <div className="rounded-xl p-3 flex items-center justify-between bg-blue-600 dark:bg-white text-white dark:text-black">
                    <span className="text-xs font-black">Tydzień: 4 200 zł</span>
                    <Wallet size={14} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* SEKCJA: LEAD FINDER */}
      <section id="leadfinder" className="max-w-7xl mx-auto px-6 lg:px-8 py-14 lg:py-20 grid lg:grid-cols-12 gap-10 items-stretch scroll-mt-24">
        <motion.div
          variants={cineSoft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="lg:col-span-5 space-y-5 flex flex-col justify-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-neutral-800 text-[11px] font-black tracking-widest uppercase w-fit">
            <Search size={12} /> Lead Finder
          </div>
          <h2 className="text-5xl sm:text-6xl font-black tracking-tighter leading-[0.95]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Twoi klienci już gdzieś są.<br />Znajdziesz ich w minutę<span className="text-gradient-lime-soft">.</span>
          </h2>
          <p className="text-sm font-bold leading-relaxed opacity-80" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            W każdym planie dostajesz dostęp do lokalnych firm z Google. Telefon, adres, e-mail — a filtr „brak strony” podświetla najlepsze okazje.
          </p>
          <ul className="space-y-3 text-sm font-bold">
            {[
              ['Tysiące firm na żywo', 'dane z Google Business + wzbogacenie.'],
              ['Filtr „bez strony”', 'od razu widzisz, kto potrzebuje strony.'],
              ['Wyślij projekt w tej samej karcie', 'lead zmienia się w klienta.']
            ].map(([b, r]) => (
              <li key={b} className="flex gap-2.5 leading-relaxed">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <span><span className="font-black">{b}</span> — <span className="opacity-70">{r}</span></span>
              </li>
            ))}
          </ul>
          <button onClick={() => onEnterApp('leadfinder')} className="inline-flex items-center gap-2 text-sm font-black hover:text-emerald-500 transition-colors cursor-pointer bg-transparent border-none p-0" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Otwórz Lead Finder <ArrowRight size={15} />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 80, rotateY: 14, filter: 'blur(16px)' }}
          whileInView={{ opacity: 1, x: 0, rotateY: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ type: 'spring', stiffness: 85, damping: 18 }}
          style={{ perspective: 1200 }}
          className="lg:col-span-7 rounded-[28px] border p-6 space-y-4 bg-white dark:bg-black border-blue-100 dark:border-neutral-800 shadow-2xl shadow-blue-600/5 dark:shadow-black/40"
        >
          <div className="flex gap-2">
            <div className="flex-1 rounded-2xl border p-3 bg-blue-50/40 dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
              <div className="text-[9px] font-black uppercase tracking-wider opacity-60 flex items-center gap-1"><Briefcase size={10} /> Branża</div>
              <div className="text-xs font-black mt-0.5">Gastronomia</div>
            </div>
            <div className="flex-1 rounded-2xl border p-3 bg-blue-50/40 dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
              <div className="text-[9px] font-black uppercase tracking-wider opacity-60 flex items-center gap-1"><MapPin size={10} /> Lokalizacja</div>
              <div className="text-xs font-black mt-0.5">Poznań</div>
            </div>
            <button className="w-12 h-12 rounded-2xl bg-blue-600 dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-xs shadow-md shrink-0 self-center">
              <Search size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { ini: 'ZG', name: 'Złoty Grzebień', score: '4.9', phone: '600 321 780' },
              { ini: 'BV', name: 'Bella Vista', score: '4.6', phone: '604 882 310' },
              { ini: 'AP', name: 'Auto Perfekt', score: '4.8', phone: '513 440 992' },
              { ini: 'FF', name: 'FitForm Studio', score: '4.7', phone: '660 203 517' }
            ].map((f) => (
              <div key={f.name} className="rounded-2xl border p-3.5 space-y-2.5 bg-blue-50/30 dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-600 dark:bg-white text-white dark:text-black grid place-items-center text-[10px] font-black">{f.ini}</div>
                  <div className="min-w-0">
                    <div className="text-xs font-black leading-none truncate">{f.name}</div>
                    <div className="text-[10px] font-bold opacity-60">{f.score} ★</div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-full bg-white dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800 px-2.5 py-1">
                  <span className="text-[10px] font-black">Brak strony</span>
                  <span className="text-[10px]">↗</span>
                </div>
                <div className="text-[10px] font-mono opacity-70">+48 {f.phone}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] font-black">
            <span className="opacity-80">41 wyników · 24 bez strony</span>
            <span className="px-2.5 py-1 rounded-full border bg-white dark:bg-neutral-900 border-blue-100 dark:border-neutral-800">⬇ CSV</span>
          </div>
        </motion.div>
      </section>

      {/* SEKCJA: ROZLICZENIA */}
      <section id="rozliczenia" className="max-w-7xl mx-auto px-6 lg:px-8 py-14 lg:py-20 grid lg:grid-cols-12 gap-10 items-center scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, x: -80, rotateY: -14, filter: 'blur(16px)' }}
          whileInView={{ opacity: 1, x: 0, rotateY: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ type: 'spring', stiffness: 85, damping: 18 }}
          style={{ perspective: 1200 }}
          className="lg:col-span-6 order-2 lg:order-1 rounded-[28px] border p-6 space-y-4 bg-white dark:bg-black border-blue-100 dark:border-neutral-800 shadow-2xl shadow-blue-600/5"
        >
          <div className="flex items-center justify-between border-b border-blue-100 dark:border-neutral-900 pb-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Opłacona</span>
            <span className="text-[10px] font-mono opacity-60">FV 0042/2026</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-wider opacity-60">Od</div>
              <div className="text-sm font-black">Morph Studio</div>
              <div className="text-[10px] font-bold opacity-60">hello@morph.studio</div>
            </div>
            <div className="text-right rounded-xl px-3 py-2 bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">
              <div className="text-[9px] font-black uppercase tracking-wider opacity-60">Razem</div>
              <div className="text-base font-black">1 830 zł</div>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between rounded-xl px-3 py-2.5 bg-blue-50/60 dark:bg-neutral-950 border border-blue-100 dark:border-neutral-900"><span className="font-bold">Projekt i wdrożenie strony</span><span className="font-black">1 450 zł</span></div>
            <div className="flex justify-between rounded-xl px-3 py-2.5 bg-blue-50/40 dark:bg-neutral-950 border border-blue-100 dark:border-neutral-900"><span className="font-bold">Copywriting + zdjęcia</span><span className="font-black">380 zł</span></div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 rounded-full py-2.5 text-xs font-black flex items-center justify-center gap-1.5 bg-blue-600 dark:bg-white text-white dark:text-black shadow-md"><Send size={13} /> Wyślij</button>
            <button className="px-5 rounded-full py-2.5 text-xs font-black border bg-white dark:bg-neutral-900 border-blue-200 dark:border-neutral-800">PDF</button>
          </div>
        </motion.div>

        <motion.div
          variants={cineSoft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="lg:col-span-6 order-1 lg:order-2 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-neutral-800 text-[11px] font-black tracking-widest uppercase w-fit">
            <Receipt size={12} /> Rozliczenia
          </div>
          <h2 className="text-5xl sm:text-6xl font-black tracking-tighter leading-[0.95]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Strona gotowa.<br />Czas na przelew<span className="text-gradient-lime-soft">.</span>
          </h2>
          <p className="text-sm font-bold leading-relaxed opacity-80 max-w-md" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Wbudowane faktury bez prowizji. Wystawiasz dokument, wysyłasz PDF i pilnujesz płatności — wszystko w jednym miejscu.
          </p>
          <div className="grid grid-cols-3 gap-6 pt-2 border-t border-blue-100 dark:border-neutral-900">
            {[
              ['3 dni', 'śr. czas do zapłaty'],
              ['0%', 'prowizji od wpłat'],
              ['Od ręki', 'eksport do PDF']
            ].map(([big, small]) => (
              <div key={big}>
                <div className="text-lg font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{big}</div>
                <div className="text-[10px] font-bold opacity-60 leading-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{small}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 70, scale: 0.94, filter: 'blur(16px)' }}
          whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ type: 'spring', stiffness: 95, damping: 19 }}
          className="relative rounded-[28px] border p-10 sm:p-12 text-center space-y-5 bg-white dark:bg-black border-blue-100 dark:border-neutral-800 shadow-xl overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[280px] morph-blob bg-gradient-to-tr from-lime-200 via-emerald-100 to-lime-100 dark:from-lime-500/15 dark:via-emerald-400/10 dark:to-lime-400/15 blur-3xl opacity-70" />
          <h2 className="relative text-4xl sm:text-5xl font-black tracking-tighter leading-[0.95]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Jedno zdanie.<br />Gotowa strona.<br /><span className="text-gradient-lime-soft">Dzisiaj.</span>
          </h2>
          <p className="relative text-sm font-bold opacity-70 max-w-md mx-auto" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Zrób pierwszy projekt za darmo i pokaż go klientowi jeszcze dziś.</p>
          <div className="relative flex flex-wrap justify-center gap-3 pt-2">
            <Button variant="primary" size="lg" onClick={() => onEnterApp('dashboard')} className="font-black">Zbuduj pierwszą stronę</Button>
            <Button variant="outline" size="lg" onClick={() => onEnterApp('pricing')} className="font-black"><Play size={14} className="fill-current" /> Zobacz demo 90 s</Button>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-blue-100 dark:border-neutral-900 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-bold" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
          <div className="flex items-center gap-2 opacity-60">
            <span className="w-7 h-7 rounded-full bg-blue-600 dark:bg-white text-white dark:text-black grid place-items-center font-black"><Zap size={12} className="fill-current" /></span>
            <span>© 2026 SiteMorph · Stworzone dla lokalnych firm.</span>
          </div>
          <div className="flex gap-1">
            {[
              ['Regulamin', 'regulamin'],
              ['Prywatność', 'prywatnosc'],
              ['Cookies', 'cookies']
            ].map(([label, key]) => (
              <button
                key={key}
                onClick={() => setLegalDoc(key as any)}
                className="px-3 py-1.5 rounded-full border border-transparent hover:border-blue-200 dark:hover:border-neutral-800 hover:bg-blue-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* MODAL DOKUMENTÓW PRAWNYCH – morphing blob w tle */}
      <AnimatePresence>
        {legalDoc && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLegalDoc(null)}
          >
            <motion.div
              layoutId="legal-modal"
              initial={{ scale: 0.92, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[86vh] overflow-hidden rounded-3xl bg-white dark:bg-neutral-950 border border-blue-100 dark:border-neutral-800 shadow-2xl flex flex-col"
            >
              {/* morphing tło */}
              <div className="pointer-events-none absolute -top-24 -right-24 w-[340px] h-[340px] bg-gradient-to-tr from-lime-200 via-emerald-200 to-lime-100 opacity-30 blur-2xl legal-blob" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 w-[280px] h-[280px] bg-gradient-to-tr from-blue-100 via-sky-100 to-lime-100 opacity-25 blur-2xl legal-blob" style={{ animationDelay: '1.2s' }} />

              <div className="relative flex items-center justify-between p-6 border-b border-blue-100 dark:border-neutral-900 bg-white/80 dark:bg-neutral-950/80 backdrop-blur sticky top-0">
                <div>
                  <h3 className="text-lg font-black tracking-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{LEGAL_DOCS[legalDoc].title}</h3>
                  <p className="text-[10px] font-bold opacity-60 mt-0.5" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{LEGAL_DOCS[legalDoc].updated}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.08, rotate: 90 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setLegalDoc(null)}
                  className="w-8 h-8 rounded-full grid place-items-center bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800 cursor-pointer"
                >
                  <X size={14} />
                </motion.button>
              </div>

              <div className="relative overflow-y-auto p-6 space-y-5 no-scrollbar" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
                {LEGAL_DOCS[legalDoc].sections.map((s) => (
                  <div key={s.h} className="space-y-1.5">
                    <h4 className="text-sm font-black tracking-tight">{s.h}</h4>
                    <p className="text-xs font-medium leading-relaxed opacity-80">{s.p}</p>
                  </div>
                ))}
                <div className="pt-4 flex justify-end">
                  <Button variant="primary" size="sm" onClick={() => setLegalDoc(null)}>Rozumiem</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// 7. SIDEBAR APLIKACJI
// ============================================================================
const SIDEBAR_MENU = [
  { id: 'dashboard', label: 'Pulpit', icon: LayoutDashboard },
  { id: 'builder', label: 'Kreator AI', icon: Wrench, badge: 'NOWOŚĆ' },
  { id: 'leadfinder', label: 'Lead Finder', icon: Search },
  { id: 'pricing', label: 'Cennik & Plany', icon: DollarSign },
  { id: 'finance', label: 'Finanse', icon: Receipt },
  { id: 'tutorials', label: 'Akademia', icon: GraduationCap },
  { id: 'help', label: 'Pomoc', icon: HelpCircle }
];

const DashboardSidebar = ({
  activeTab,
  setActiveTab,
  onExit,
  theme,
  setTheme,
  credits
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onExit: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  credits: number;
}) => {
  const menuItems = SIDEBAR_MENU;

  return (
    <motion.aside
      layout
      className="hidden lg:flex w-64 border-r h-screen sticky top-0 flex-col justify-between z-30 shrink-0 select-none bg-white dark:bg-black border-blue-100 dark:border-neutral-900 text-blue-600 dark:text-white"
    >
      <div>
        <div className="h-16 flex items-center justify-between px-6 border-b border-blue-100 dark:border-neutral-900">
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onExit} 
            className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none text-inherit"
          >
            <motion.div 
              layoutId="app-main-logo"
              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs bg-blue-600 text-white dark:bg-white dark:text-black shadow-md"
            >
              <Zap size={13} className="fill-current" />
            </motion.div>
            <span className="font-black text-base tracking-tight text-blue-600 dark:text-white">
              Site<span className="text-gradient-lime-soft font-story-script text-xl px-0.5">Morph</span>
            </span>
          </motion.button>

          <motion.button
            whileHover={{ rotate: 180, scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={springTransition}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-neutral-900 text-blue-600 dark:text-white cursor-pointer border-none bg-transparent"
          >
            {theme === 'dark' ? <Sun size={15} className="text-white" /> : <Moon size={15} className="text-blue-600" />}
          </motion.button>
        </div>

        <LayoutGroup id="sidebar-nav">
          <div className="p-3 space-y-1">
            <div className="text-[10px] font-black tracking-wider uppercase px-3 py-2 text-blue-600 dark:text-white opacity-70">
              MENU GŁÓWNE
            </div>
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black transition-colors cursor-pointer border-none ${
                    isActive ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white hover:bg-blue-50/60 dark:hover:bg-neutral-900/60'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActivePill"
                      transition={springTransition}
                      className="absolute inset-0 bg-blue-600 dark:bg-white rounded-xl shadow-md"
                    />
                  )}
                  <div className="flex items-center gap-2.5 relative z-10">
                    <item.icon size={16} className={isActive ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-white text-blue-600 dark:bg-black dark:text-white' : 'bg-blue-100 text-blue-800 dark:bg-neutral-800 dark:text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="p-3 pt-0">
            <div className="text-[10px] font-black tracking-wider uppercase px-3 py-2 text-blue-600 dark:text-white opacity-70">
              KONTO
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab('settings')}
              className={`w-full relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-colors cursor-pointer border-none ${
                activeTab === 'settings' ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white hover:bg-blue-50/60 dark:hover:bg-neutral-900/60'
              }`}
            >
              {activeTab === 'settings' && (
                <motion.div
                  layoutId="sidebarActivePill"
                  transition={springTransition}
                  className="absolute inset-0 bg-blue-600 dark:bg-white rounded-xl shadow-md"
                />
              )}
              <Settings size={16} className={`relative z-10 ${activeTab === 'settings' ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white'}`} />
              <span className="relative z-10">Ustawienia</span>
            </motion.button>
          </div>
        </LayoutGroup>
      </div>

      <div className="p-3 space-y-2 border-t border-blue-100 dark:border-neutral-900">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="p-3 rounded-2xl border flex items-center justify-between bg-blue-50/50 dark:bg-neutral-950 border-blue-200 dark:border-neutral-800 text-blue-600 dark:text-white"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white dark:bg-white dark:text-black flex items-center justify-center font-black">
              <Coins size={16} />
            </div>
            <div>
              <div className="text-xs font-black">{credits} kredytów</div>
              <div className="text-[10px] font-bold opacity-80">{credits > 0 ? 'Pakiet aktywny' : 'Darmowy pakiet'}</div>
            </div>
          </div>
          <button onClick={() => setActiveTab('pricing')} className="text-[11px] font-black text-emerald-500 dark:text-emerald-400 hover:underline cursor-pointer bg-transparent border-none">
            Doładuj
          </button>
        </motion.div>

        <div className="p-2 flex items-center justify-between rounded-xl hover:bg-blue-50 dark:hover:bg-neutral-900 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white dark:bg-white dark:text-black font-black text-xs flex items-center justify-center shadow-sm">
              O
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black truncate">oskar1255900</div>
              <div className="text-[10px] font-bold opacity-80">Darmowy plan</div>
            </div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.2, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            onClick={onExit} 
            className="p-1 text-blue-600 dark:text-white hover:text-rose-500 cursor-pointer bg-transparent border-none" 
            title="Wyloguj"
          >
            <LogOut size={15} />
          </motion.button>
        </div>
      </div>
    </motion.aside>
  );
};

// Pasek górny + szuflada nawigacji na telefonach (< lg)
const MobileNav = ({
  activeTab,
  setActiveTab,
  onExit,
  theme,
  setTheme,
  credits
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onExit: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  credits: number;
}) => {
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [activeTab])
  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 z-40 flex items-center justify-between px-3 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-blue-100 dark:border-neutral-900 text-blue-600 dark:text-white">
        <button onClick={onExit} className="flex items-center gap-2 cursor-pointer bg-transparent border-none text-inherit p-1.5 rounded-lg active:scale-95 transition-transform">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs bg-blue-600 text-white dark:bg-white dark:text-black shadow-md">
            <Zap size={13} className="fill-current" />
          </div>
          <span className="font-black text-sm tracking-tight">Site<span className="text-gradient-lime-soft font-story-script text-lg px-0.5">Morph</span></span>
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-black px-2 py-1 rounded-full bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">{credits} kr.</span>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Motyw" className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-neutral-900 cursor-pointer border-none bg-transparent text-blue-600 dark:text-white">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => setOpen(true)} aria-label="Menu" className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-neutral-900 cursor-pointer border-none bg-transparent text-blue-600 dark:text-white">
            <Menu size={18} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="lg:hidden fixed top-0 bottom-0 left-0 w-[272px] z-50 flex flex-col justify-between bg-white dark:bg-black border-r border-blue-100 dark:border-neutral-900 shadow-2xl text-blue-600 dark:text-white select-none"
            >
              <div>
                <div className="h-14 flex items-center justify-between px-4 border-b border-blue-100 dark:border-neutral-900">
                  <span className="font-black text-base tracking-tight">Site<span className="text-gradient-lime-soft font-story-script text-xl px-0.5">Morph</span></span>
                  <button onClick={() => setOpen(false)} aria-label="Zamknij" className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-neutral-900 cursor-pointer border-none bg-transparent"><X size={17} /></button>
                </div>
                <LayoutGroup id="mobile-nav">
                  <div className="p-3 space-y-1">
                    <div className="text-[10px] font-black tracking-wider uppercase px-3 py-2 opacity-70">MENU GŁÓWNE</div>
                    {SIDEBAR_MENU.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full relative flex items-center justify-between px-3 py-3 rounded-xl text-xs font-black transition-colors cursor-pointer border-none ${
                            isActive ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white hover:bg-blue-50/60 dark:hover:bg-neutral-900/60'
                          }`}
                        >
                          {isActive && (
                            <motion.div layoutId="mobileActivePill" transition={springTransition} className="absolute inset-0 bg-blue-600 dark:bg-white rounded-xl shadow-md" />
                          )}
                          <div className="flex items-center gap-2.5 relative z-10">
                            <item.icon size={16} className={isActive ? 'text-white dark:text-black' : ''} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className={`relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white text-blue-600 dark:bg-black dark:text-white' : 'bg-blue-100 text-blue-800 dark:bg-neutral-800 dark:text-white'}`}>{item.badge}</span>
                          )}
                        </motion.button>
                      );
                    })}
                    <button
                      onClick={() => setActiveTab('settings')}
                      className={`w-full relative flex items-center gap-2.5 px-3 py-3 mt-2 rounded-xl text-xs font-black transition-colors cursor-pointer border-none ${
                        activeTab === 'settings' ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white hover:bg-blue-50/60 dark:hover:bg-neutral-900/60'
                      }`}
                    >
                      <Settings size={16} className="relative z-10" />
                      <span className="relative z-10">Ustawienia</span>
                    </button>
                  </div>
                </LayoutGroup>
              </div>
              <div className="p-3 space-y-2 border-t border-blue-100 dark:border-neutral-900">
                <div className="p-3 rounded-2xl border flex items-center justify-between bg-blue-50/50 dark:bg-neutral-950 border-blue-200 dark:border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white dark:bg-white dark:text-black flex items-center justify-center font-black"><Coins size={16} /></div>
                    <div>
                      <div className="text-xs font-black">{credits} kredytów</div>
                      <div className="text-[10px] font-bold opacity-80">{credits > 0 ? 'Pakiet aktywny' : 'Darmowy pakiet'}</div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('pricing')} className="text-[11px] font-black text-emerald-500 dark:text-emerald-400 hover:underline cursor-pointer bg-transparent border-none">Doładuj</button>
                </div>
                <div className="p-2 flex items-center justify-between rounded-xl hover:bg-blue-50 dark:hover:bg-neutral-900 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white dark:bg-white dark:text-black font-black text-xs flex items-center justify-center shadow-sm">O</div>
                    <div className="min-w-0">
                      <div className="text-xs font-black truncate">oskar1255900</div>
                      <div className="text-[10px] font-bold opacity-80">Darmowy plan</div>
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={onExit} className="p-1 text-blue-600 dark:text-white hover:text-rose-500 cursor-pointer bg-transparent border-none" title="Wyloguj">
                    <LogOut size={15} />
                  </motion.button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ============================================================================
// 8. WIDOK: DASHBOARD GŁÓWNY
// ============================================================================
const DashboardMainView = ({
  setActiveTab,
  onLaunchBuilderWithPrompt
}: {
  setActiveTab: (t: string) => void;
  theme: 'light' | 'dark';
  onLaunchBuilderWithPrompt: (prompt: string) => void;
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [activeTabSub, setActiveTabSub] = useState<'my' | 'recent'>('my');

  const handleSendPrompt = () => {
    if (!promptInput.trim()) return;
    onLaunchBuilderWithPrompt(promptInput);
  };

  const quickActions = [
    { label: 'Kreator AI', desc: 'Strona z jednego zdania', icon: Wrench, tab: 'builder', accent: 'from-blue-600 to-indigo-500' },
    { label: 'Lead Finder', desc: 'Klienci bez strony www', icon: Search, tab: 'leadfinder', accent: 'from-emerald-500 to-teal-500' },
    { label: 'Nowa faktura', desc: 'Bez prowizji, w PDF', icon: Receipt, tab: 'finance', accent: 'from-fuchsia-500 to-purple-600' },
    { label: 'Akademia', desc: 'Sprzedawaj z głową', icon: GraduationCap, tab: 'tutorials', accent: 'from-amber-400 to-orange-500' }
  ];

  return (
    <motion.div 
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto py-8 px-6 space-y-8 pb-20 text-blue-600 dark:text-white"
    >
      <motion.div variants={itemVariants} className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black border shadow-sm bg-white dark:bg-neutral-950 border-blue-200 dark:border-neutral-800 text-blue-600 dark:text-white">
          <span className="bg-blue-600 text-white dark:bg-white dark:text-black text-[9px] font-black px-1.5 py-0.5 rounded-md">NOWOŚĆ</span>
          Generowanie serwisów www nowej generacji <ArrowRight size={12} />
        </div>
      </motion.div>

      <motion.div variants={cineChild} className="text-center space-y-6 relative">
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[480px] h-[200px] morph-blob bg-gradient-to-tr from-lime-100 via-emerald-50 to-lime-100 dark:from-lime-500/10 dark:via-emerald-400/5 dark:to-lime-400/10 blur-3xl opacity-70" />
        <h2 className="relative text-4xl sm:text-5xl font-black tracking-tighter text-blue-600 dark:text-white leading-[0.95]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
          Co dzisiaj stworzymy?
        </h2>

        <motion.div
          layout
          whileHover={{ scale: 1.01 }}
          transition={springTransition}
          className="relative rounded-2xl p-2 pl-5 shadow-2xl border text-left flex items-center gap-4 bg-white/95 dark:bg-black/95 border-blue-300 dark:border-neutral-700 text-blue-600 dark:text-white overflow-hidden"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 w-48 h-48 morph-blob bg-gradient-to-tr from-lime-300/40 via-emerald-300/20 to-lime-300/40 blur-2xl" />
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            placeholder="Stwórz stronę dla siłowni z systemem rezerwacji online..."
            className="relative flex-1 bg-transparent border-none outline-none text-sm sm:text-base font-bold placeholder:text-blue-400 dark:placeholder:text-neutral-500 py-3 text-blue-600 dark:text-white"
          />
          <div className="relative flex items-center gap-2 pr-1">
            <motion.button whileHover={{ scale: 1.1 }} className="p-2 text-blue-600 dark:text-white hover:opacity-80 cursor-pointer bg-transparent border-none">
              <Paperclip size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleSendPrompt}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white dark:from-white dark:to-neutral-200 dark:text-black flex items-center justify-center font-black shadow-lg cursor-pointer border-none"
            >
              <Send size={16} />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Szybkie akcje */}
      <motion.div variants={cineParent} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((a, i) => (
          <motion.button
            key={a.label}
            variants={cineChild}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab(a.tab)}
            className="rounded-2xl border p-4 text-left space-y-6 bg-white dark:bg-black border-blue-100 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-shadow cursor-pointer group"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${a.accent} text-white grid place-items-center shadow-md`}>
              <a.icon size={18} />
            </div>
            <div>
              <div className="text-xs font-black">{a.label}</div>
              <div className="text-[10px] font-bold opacity-60 mt-0.5">{a.desc}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      <motion.div 
        variants={cineChild}
        className="rounded-3xl p-6 border shadow-xl space-y-6 bg-white dark:bg-black border-blue-100 dark:border-neutral-900 text-blue-600 dark:text-white"
      >
        <div className="flex items-center gap-2 text-xs font-bold border-b border-blue-100 dark:border-neutral-900 pb-3">
          <div className="relative flex gap-2">
            {(['my', 'recent'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTabSub(tab)}
                className={`relative px-4 py-1.5 rounded-full transition-colors cursor-pointer border-none font-black text-xs ${
                  activeTabSub === tab ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white hover:opacity-75'
                }`}
              >
                {activeTabSub === tab && (
                  <motion.div
                    layoutId="dashboardSubTab"
                    transition={springTransition}
                    className="absolute inset-0 bg-blue-600 dark:bg-white rounded-full shadow-md"
                  />
                )}
                <span className="relative z-10">{tab === 'my' ? 'Moje projekty' : 'Ostatnio przeglądane'}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTabSub}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }}
            transition={springTransition}
            className="py-14 flex flex-col items-center justify-center text-center space-y-3"
          >
            <motion.div 
              animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }}
              transition={{ duration: 5, repeat: Infinity }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-lime-50 dark:from-neutral-900 dark:to-neutral-950 text-blue-600 dark:text-white flex items-center justify-center mb-1 border border-blue-200 dark:border-neutral-800 shadow-inner"
            >
              {activeTabSub === 'my' ? <Sparkles size={28} className="text-emerald-400" /> : <Clock size={28} className="opacity-60" />}
            </motion.div>
            <h3 className="text-lg font-black">{activeTabSub === 'my' ? 'Brak aktywnych projektów' : 'Nic tu jeszcze nie ma'}</h3>
            <p className="text-xs font-bold max-w-xs opacity-80">
              {activeTabSub === 'my'
                ? 'Opisz swój pomysł w polu powyżej lub kliknij przycisk, aby uruchomić kreator.'
                : 'Projekty, które otworzysz, pojawią się tutaj.'}
            </p>
            <Button variant="primary" size="md" onClick={() => setActiveTab('builder')} className="mt-2 font-black">
              <Wrench size={15} /> Otwórz Kreator Stron
            </Button>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// 9. WIDOK: KREATOR AI (BUILDER)
// ============================================================================
const BuilderFullView = ({
  initialPrompt = '',
  onBack,
  credits,
  setCredits
}: {
  theme: 'light' | 'dark';
  initialPrompt?: string;
  onBack: () => void;
  credits: number;
  setCredits: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const [activeMode, setActiveMode] = useState<'preview' | 'code'>('preview');
  const [builderPrompt, setBuilderPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSite, setGeneratedSite] = useState<GeneratedWebsite | null>(null);
  const [genStep, setGenStep] = useState(0);
  const GEN_MSGS = ['Analizuję prompt…', 'Generuję sekcje…', 'Dobieram paletę i grafiki…', 'Składam podgląd na żywo…'];

  useEffect(() => {
    if (!isGenerating) return;
    const id = setInterval(() => setGenStep((s) => (s + 1) % GEN_MSGS.length), 360);
    return () => clearInterval(id);
  }, [isGenerating]);

  useEffect(() => {
    if (initialPrompt) {
      handleGenerate(initialPrompt);
    }
  }, []);

  const [q1, setQ1] = useState('Restauracja');
  const [q2, setQ2] = useState('Nowoczesny, minimalistyczny');
  const [q3, setQ3] = useState('Limonkowy #a3e635 + czarny + biały');
  const [q4, setQ4] = useState<string[]>(['Hero', 'Oferta', 'Cennik', 'Kontakt']);
  const [selectedFile, setSelectedFile] = useState('main/frontend/index.html');
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishErr, setPublishErr] = useState('');

  const toggleQ4 = (v: string) => setQ4((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [isProMode, setIsProMode] = useState(false);
  const cost = isProMode ? 15 : 10;

  // Przesuwalna granica miedzy panelem promptu a podgladem
  const splitRef = useRef<HTMLDivElement>(null);
  const [leftW, setLeftW] = useState(340);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [isEditMode, setIsEditMode] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const fn = () => setIsDesktop(mq.matches);
    fn();
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);
  useEffect(() => {
    if (!isDraggingSplit) return;
    const move = (e: MouseEvent) => {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      setLeftW(Math.min(Math.max(e.clientX - rect.left, 260), Math.floor(rect.width * 0.65)));
    };
    const up = () => setIsDraggingSplit(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isDraggingSplit]);

  const WIZARD_DATA: Array<{ title: string; options: string[]; multi?: boolean }> = [
    { title: 'Jaki klimat ma mieć strona?', options: ['Ciepła, rustykalna piekarnia (beże, brązy, drewno)', 'Elegancka bistro / bistro-żydowska tradycja (ciemna, szlachetna)', 'Nowoczesna, minimalistyczna', 'Inne — wpiszę w prompt'] },
    { title: 'Jaki to biznes?', options: ['Restauracja', 'Barber', 'Salon beauty', 'Siłownia', 'Warsztat', 'Kwiaciarnia', 'Inne'] },
    { title: 'Jakie kolory lubisz?', options: ['Limonkowy + czarny', 'Niebieski + biały', 'Beż + brąz', 'Czarny + złoty', 'Fiolet + róż', 'Dowolne — AI dobierze'] },
    { title: 'Które sekcje dodać?', options: ['Hero', 'Oferta', 'Cennik', 'Galeria', 'Opinie', 'Kontakt', 'Rezerwacja', 'FAQ'], multi: true },
  ];

  const buildPrompt = (override?: string) => {
    const extra = override || builderPrompt;
    const sections = q4.join(', ');
    return `Branża: ${q1}. Styl: ${q2}. Kolory: ${q3}. Sekcje: ${sections}. ${extra ? `Dodatkowy opis: ${extra}.` : ''} Tryb: ${isProMode ? 'PRO premium z animacjami' : 'standard'} — Zbuduj premium stronę Vite+React+Tailwind.`;
  };

  const starterIdeas = [
    { title: 'Luksusowa agencja nieruchomości', icon: Home },
    { title: 'Nowoczesny landing page dla SaaS', icon: Zap },
    { title: 'Restauracja z menu i rezerwacją', icon: Coffee },
    { title: 'Portfolio agencji kreatywnej', icon: Briefcase }
  ];

  const handleGenerate = async (promptText?: string) => {
    const p = buildPrompt(promptText);
    if (!p.trim()) return;
    if (credits < cost) {
      alert(`Brak kredytów! Potrzeba ${cost}, masz ${credits}. Sprawdź dostępne plany w sekcji Cennik.`);
      return;
    }
    setIsGenerating(true);
    setGenStep(0);
    setSelectedFile('src/App.tsx');
    setShowWizard(false);
    try {
      const { data: { session: _s } } = await supabase.auth.getSession()
      const _h: Record<string,string> = { 'Content-Type': 'application/json', 'X-User-Id': _s?.user?.id || getUserId(), 'X-User-Plan': (()=>{try{return localStorage.getItem('sitemorph-plan')||'Starter'}catch{return 'Starter'}})() }
      if (_s?.access_token) _h['Authorization'] = `Bearer ${_s.access_token}`
      const res = await fetch('/api/builder/generate', {
        method: 'POST',
        headers: _h,
        body: JSON.stringify({
          business_name: q1,
          niche: q1,
          description: p,
          style: q2,
          colors: q3,
          sections: q4,
          extraPrompt: promptText || builderPrompt,
        }),
      });
      const data = await res.json();
      const files: Record<string, string> = data.files || {};
      const meta = data.meta || {};
      setGeneratedSite({
        title: meta.title || p.slice(0, 28),
        category: q1,
        domain: `${q1.toLowerCase().replace(/\s+/g, '')}.sitemorph.pl`,
        headline: meta.headline || p,
        subheadline: meta.subheadline || 'Wygenerowane przez SiteMorph AI (Gemini Flash)',
        ctaText: meta.ctaText || 'Skontaktuj się',
        files,
      });
      const first = Object.keys(files).find(f => f.endsWith('index.html')) || Object.keys(files)[0];
      if (first) setSelectedFile(first);
      setCredits((c) => Math.max(0, c - cost));
    } catch (e) {
      setGeneratedSite({
        title: p.slice(0, 25),
        category: q1,
        domain: 'mojastrona.sitemorph.io',
        headline: p,
        subheadline: 'Błąd generowania — pokazuję podgląd awaryjny.',
        ctaText: 'Skontaktuj się',
        files: {
          'src/App.tsx': `export default function App(){return <div className="p-8"><h1>${p}</h1></div>}`,
        },
      });
      setCredits((c) => Math.max(0, c - cost));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWizardNext = () => {
    if (wizardStep < WIZARD_DATA.length - 1) {
      setWizardStep((s) => s + 1);
    } else {
      handleGenerate();
    }
  };

  const handleWizardAuto = () => {
    const opts = WIZARD_DATA[wizardStep].options;
    if (WIZARD_DATA[wizardStep].multi) {
      const shuffled = [...opts].sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 2));
      shuffled.forEach((o) => {
        if (wizardStep === 3) toggleQ4(o);
      });
      if (wizardStep === 3 && q4.length === 0) setQ4(['Hero', 'Kontakt']);
    } else {
      const pick = opts[Math.floor(Math.random() * opts.length)];
      if (wizardStep === 0) setQ2(pick);
      if (wizardStep === 1) setQ1(pick);
      if (wizardStep === 2) setQ3(pick);
    }
    // auto next
    setTimeout(() => handleWizardNext(), 280);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-screen flex flex-col overflow-hidden select-none bg-white dark:bg-black text-blue-600 dark:text-white"
    >
      <header className="h-14 border-b px-4 flex items-center justify-between shrink-0 bg-white dark:bg-black border-blue-200 dark:border-neutral-900 text-blue-600 dark:text-white">
        <motion.button 
          whileHover={{ x: -2 }}
          onClick={onBack} 
          className="flex items-center gap-2 text-blue-600 dark:text-white hover:text-emerald-400 font-black text-sm transition-colors cursor-pointer bg-transparent border-none"
        >
          <ArrowLeft size={16} />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white dark:bg-white dark:text-black flex items-center justify-center text-xs font-black shadow-sm">S</div>
            Kreator SiteMorph
          </div>
        </motion.button>

        <div className="flex items-center gap-1 bg-blue-50 dark:bg-neutral-900 p-1 rounded-xl border border-blue-200 dark:border-neutral-800">
          {(['preview', 'code'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`relative flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer border-none ${
                activeMode === mode ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white'
              }`}
            >
              {activeMode === mode && (
                <motion.div
                  layoutId="builderModePill"
                  transition={springTransition}
                  className="absolute inset-0 bg-blue-600 dark:bg-white rounded-lg shadow-sm"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {mode === 'preview' ? <Monitor size={14} /> : <CodeIcon size={14} />}
                {mode === 'preview' ? 'Podgląd' : 'Kod'}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black text-blue-600 dark:text-white bg-blue-50 dark:bg-neutral-900 px-2.5 py-1 rounded-md border border-blue-200 dark:border-neutral-800 flex items-center gap-1.5">
            <RefreshCw size={12} className={isGenerating ? 'animate-spin text-emerald-400' : ''} /> Autozapis
          </div>
          <Button
            variant="primary" size="sm"
            disabled={isGenerating || !generatedSite || publishing}
            onClick={async () => {
              if (!generatedSite) return;
              setPublishing(true); setPublishErr('');
              try {
                const html = generatedSite.files['main/frontend/index.html'] || generatedSite.files['index.html'] || '';
                const { data: { session: _ps } } = await supabase.auth.getSession();
                const ph: Record<string,string> = { 'Content-Type': 'application/json', 'X-User-Id': _ps?.user?.id || getUserId() };
                if (_ps?.access_token) ph['Authorization'] = `Bearer ${_ps.access_token}`;
                const res = await fetch('/api/publish', {
                  method: 'POST', headers: ph,
                  body: JSON.stringify({ html, title: generatedSite.title }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || `Błąd ${res.status}`);
                const full = `${window.location.protocol}//${window.location.hostname}:8000${data.url}`;
                setPublishedUrl(full);
                navigator.clipboard?.writeText(full).catch(()=>{});
              } catch (e: any) {
                setPublishErr(e.message || 'Błąd publikacji');
              } finally { setPublishing(false) }
            }}
            className="font-black"
          >
            {publishing ? 'Publikuję…' : 'Opublikuj'}
          </Button>
        </div>
      </header>

      <div ref={splitRef} className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div
          style={isDesktop ? { width: leftW } : undefined}
          className="border-b md:border-b-0 md:border-r h-[46vh] md:h-auto flex flex-col overflow-hidden shrink-0 bg-white dark:bg-black border-blue-100 dark:border-neutral-900 text-blue-600 dark:text-white"
        >
          <div className="flex-1 p-4 overflow-y-auto no-scrollbar space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-white flex items-center justify-center mx-auto mb-3 border border-blue-200 dark:border-neutral-800 shadow-sm">
                <Globe size={24} />
              </div>
              <h3 className="font-black text-sm">Zbuduj swoją stronę</h3>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                Kompletny serwis z treściami, grafikami i formularzem kontaktowym.
              </p>
            </div>

            <div className="rounded-lg border p-3 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/20">
              <p className="text-[11px] font-bold leading-relaxed opacity-80">
                Wklej dane firmy prosto z Google Maps (nazwa, adres, telefon, opinie) albo opisz własnymi słowami —
                <span className="font-black"> Gemini Flash </span>
                zbuduje kompletną stronę i nigdy nie będzie pytać o szczegóły.
              </p>
            </div>
          </div>

          <div className="p-3 border-t bg-blue-50/30 dark:bg-black border-blue-100 dark:border-neutral-900">
            <div className="rounded-lg border p-3 shadow-md bg-white dark:bg-neutral-950 border-blue-200 dark:border-neutral-800">
              <textarea
                rows={5}
                value={builderPrompt}
                onChange={(e) => setBuilderPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // Masz opis? Generuj OD RAZU bez żadnych pytań.
                    if (builderPrompt.trim()) handleGenerate();
                    else { setWizardStep(0); setShowWizard(true); }
                  }
                }}
                placeholder="Wklej dane z Google Maps albo opisz firmę (Enter = generuj)..."
                className="w-full bg-transparent border-none outline-none text-xs font-semibold leading-relaxed placeholder:text-blue-400 dark:placeholder:text-neutral-500 resize-y text-blue-600 dark:text-white min-h-[90px]"
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex gap-2">
                  <motion.button whileHover={{ scale: 1.1 }} className="hover:text-emerald-400 cursor-pointer bg-transparent border-none text-inherit"><Paperclip size={14} /></motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} className="hover:text-emerald-400 cursor-pointer bg-transparent border-none text-inherit"><CodeIcon size={14} /></motion.button>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    if (builderPrompt.trim()) handleGenerate();
                    else { setWizardStep(0); setShowWizard(true); }
                  }}
                  className="w-7 h-7 bg-blue-600 text-white dark:bg-white dark:text-black rounded-lg flex items-center justify-center cursor-pointer border-none font-black shadow-md"
                  title={builderPrompt.trim() ? `Generuj — ${cost} kredytów` : 'Otwórz kreator pytań'}
                >
                  <Send size={12} />
                </motion.button>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-100 dark:border-neutral-800 gap-1.5">
                <span className="text-[10px] font-black opacity-60">{credits} kr.</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setBuilderPrompt(p => p + (p ? ' ' : '') + ` Dodaj galerię 6 prawdziwych zdjęć z Unsplash dla branży ${q1} (https://source.unsplash.com/800x600/?${encodeURIComponent(q1)})`)} className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:brightness-95 flex items-center gap-1">
                    <ImageIcon size={10} /> Zdjęcia
                  </button>
                  <button onClick={() => setIsProMode(!isProMode)} className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer border ${isProMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent opacity-60 hover:opacity-100 border-blue-200 dark:border-neutral-700'}`}>
                    PRO · {cost} kr
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          onMouseDown={(e) => { e.preventDefault(); setIsDraggingSplit(true); }}
          className={`hidden md:flex w-[9px] shrink-0 cursor-col-resize items-center justify-center transition-colors ${isDraggingSplit ? 'bg-blue-100 dark:bg-neutral-900' : 'hover:bg-blue-50 dark:hover:bg-neutral-900/60'}`}
          title="Przeciągnij, aby zmienić szerokość panelu"
        >
          <div className={`w-[3px] h-14 rounded-lg transition-colors ${isDraggingSplit ? 'bg-blue-500' : 'bg-blue-200 dark:bg-neutral-800'}`} />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex bg-blue-50/20 dark:bg-black">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
                className="flex-1 flex flex-col items-center justify-center p-8 space-y-4 relative overflow-hidden"
              >
                <div className="pointer-events-none absolute w-[360px] h-[360px] bg-gradient-to-tr from-lime-200 via-emerald-100 to-lime-200 dark:from-lime-500/15 dark:via-emerald-400/10 dark:to-lime-400/15 blur-3xl morph-blob opacity-70" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                  className="w-12 h-12 rounded-2xl bg-blue-600 dark:bg-white text-white dark:text-black grid place-items-center shadow-lg"
                >
                  <Sparkles size={22} />
                </motion.div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={genStep}
                    initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                    transition={{ duration: 0.22 }}
                    className="text-xs font-black tracking-wide"
                  >
                    {GEN_MSGS[genStep]}
                  </motion.div>
                </AnimatePresence>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ scale: genStep === i ? 1.6 : 1, opacity: genStep === i ? 1 : 0.3 }}
                      className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-white"
                    />
                  ))}
                </div>
              </motion.div>
            ) : !generatedSite ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex items-center justify-center p-6"
              >
                <div className="text-center space-y-2 p-12 rounded-3xl border shadow-xl bg-white dark:bg-neutral-950 border-blue-200 dark:border-neutral-900">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border bg-blue-50 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800">
                    <Monitor size={28} />
                  </div>
                  <h3 className="text-base font-black">Brak podglądu</h3>
                  <p className="text-xs font-bold max-w-xs opacity-80">Wpisz instrukcję w panelu po lewej, aby wygenerować pierwszy podgląd na żywo.</p>
                </div>
              </motion.div>
            ) : activeMode === 'preview' ? (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={springTransition}
                className="flex-1 flex min-h-0 overflow-hidden bg-white dark:bg-black"
              >
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="h-9 border-b border-blue-100 dark:border-neutral-900 flex items-center justify-between px-3 bg-blue-50/40 dark:bg-neutral-950 text-[11px] font-bold shrink-0 gap-2">
                    <span className="flex items-center gap-2 truncate"><Globe size={12} className="shrink-0" /> {generatedSite.domain} — Podgląd</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => { const on = !isEditMode; setIsEditMode(on); try { const doc = previewRef.current?.contentDocument; if (doc) doc.body.contentEditable = on ? 'true' : 'false'; } catch {} }} className={`px-2.5 py-1 rounded-full text-[10px] font-black border flex items-center gap-1 ${isEditMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 hover:bg-blue-50'}`}>
                        <MousePointer2 size={11} /> {isEditMode ? 'Edycja: ON' : 'Kliknij by edytować'}
                      </button>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black hidden sm:inline">LIVE</span>
                    </div>
                  </div>
                  <iframe
                    ref={previewRef}
                    title="Podgląd"
                    className="flex-1 w-full border-0 bg-white"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    srcDoc={
                      generatedSite.files['main/frontend/index.html'] ||
                      generatedSite.files['index.html'] ||
                      `<!doctype html><html lang="pl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${generatedSite.title}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white text-neutral-900"><div class="max-w-6xl mx-auto px-6 py-16 text-center"><h1 class="text-4xl font-black">${generatedSite.headline}</h1><p class="mt-3 text-neutral-600">${generatedSite.subheadline}</p><a href="#" class="inline-block mt-6 bg-black text-white px-6 py-3 rounded-full font-black">${generatedSite.ctaText}</a></div></body></html>`
                    }
                  />
                </div>
                <div className="hidden lg:flex w-64 border-l bg-white dark:bg-neutral-950 flex-col shrink-0 overflow-hidden">
                  <div className="p-4 border-b border-blue-100 dark:border-neutral-800 space-y-1">
                    <div className="text-[11px] font-black tracking-wider uppercase opacity-60">Podgląd</div>
                    <div className="text-xs font-bold truncate">{generatedSite.title}</div>
                    <div className="flex items-center gap-2 text-[11px]"><Eye size={12} className="opacity-60"/> 2 online</div>
                  </div>
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                    <div className="text-[10px] font-black opacity-60">Dostosuj, co tylko chcesz</div>
                    <p className="text-xs leading-relaxed opacity-80">Kliknij tekst w podglądzie (tryb edycji) lub poproś AI: „zmień nagłówek na…”, „dodaj zdjęcie”.</p>
                    <button onClick={() => setIsEditMode(v => { const nv=!v; try{const d=previewRef.current?.contentDocument; if(d) d.body.contentEditable=nv?'true':'false';}catch{} return nv; })} className={`w-full py-2 rounded-xl text-xs font-black border ${isEditMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 hover:bg-blue-50'}`}>{isEditMode ? 'Wyłącz edycję' : 'Włącz edycję tekstu'}</button>
                    <div className="pt-3 border-t border-blue-100 dark:border-neutral-800 space-y-2">
                      <div className="text-[10px] font-black opacity-60">Link do podglądu</div>
                      <div className="text-[11px] font-mono truncate bg-blue-50 dark:bg-neutral-900 p-2 rounded-lg border border-blue-100 dark:border-neutral-800">{generatedSite.domain}</div>
                      <button onClick={() => { const html = generatedSite.files['main/frontend/index.html'] || generatedSite.files['index.html'] || ''; const blob=new Blob([html],{type:'text/html'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='index.html'; a.click(); URL.revokeObjectURL(url);}} className="w-full py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black text-xs font-black flex items-center justify-center gap-1.5"><Save size={12}/> Zapisz projekt</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="code"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex font-mono text-xs overflow-hidden"
              >
                <div className="w-56 bg-blue-50 dark:bg-neutral-950 border-r border-blue-200 dark:border-neutral-900 p-3 space-y-1 overflow-y-auto no-scrollbar">
                  <span className="text-[9px] font-black block mb-2 opacity-70 uppercase tracking-wider">Drzewo plikow — Vite</span>
                  {Object.keys(generatedSite.files).map((fname) => (
                    <button
                      key={fname}
                      onClick={() => setSelectedFile(fname)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold truncate border ${selectedFile === fname ? 'bg-blue-600 text-white dark:bg-white dark:text-black border-transparent shadow-sm' : 'bg-white dark:bg-neutral-900 border-blue-100 dark:border-neutral-800 hover:border-blue-300'}`}
                    >
                      {fname}
                    </button>
                  ))}
                </div>
                <div className="flex-1 p-4 overflow-y-auto no-scrollbar bg-white dark:bg-black flex flex-col">
                  <div className="flex items-center justify-between mb-2 text-[10px] font-black opacity-60 shrink-0">
                    <span className="truncate">{selectedFile}</span>
                    <button onClick={() => navigator.clipboard.writeText(generatedSite.files[selectedFile] || '')} className="px-2 py-1 rounded-full border bg-blue-50 dark:bg-neutral-900 border-blue-100 dark:border-neutral-800 cursor-pointer">Kopiuj</button>
                  </div>
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words bg-neutral-950 text-lime-300 p-4 rounded-xl overflow-x-auto flex-1">{generatedSite.files[selectedFile] || ''}</pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Panel boczny publikacji — wysuwa się z prawej */}
      <AnimatePresence>
        {publishedUrl && (
          <>
            <motion.div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPublishedUrl(null)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="fixed right-0 top-0 bottom-0 w-[380px] max-w-[92vw] z-[61] bg-white dark:bg-neutral-950 border-l border-blue-100 dark:border-neutral-800 shadow-2xl flex flex-col">
              <div className="p-6 border-b border-blue-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 grid place-items-center"><CheckCircle2 size={18} /></div>
                  <div><h3 className="font-black text-sm">Opublikowano!</h3><p className="text-[11px] font-semibold opacity-60">Link działa na serio</p></div>
                </div>
                <button onClick={() => setPublishedUrl(null)} className="w-8 h-8 rounded-lg grid place-items-center hover:bg-neutral-100 dark:hover:bg-neutral-900"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                <p className="text-xs font-semibold opacity-70 text-center">Wyślij klientowi — otworzy na telefonie i zobaczy stronę.</p>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">
                  <input readOnly value={publishedUrl} onFocus={(e)=>e.currentTarget.select()} className="flex-1 bg-transparent text-[12px] font-bold outline-none min-w-0" />
                  <button onClick={() => navigator.clipboard?.writeText(publishedUrl)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white dark:bg-white dark:text-black text-[11px] font-black shrink-0">Kopiuj</button>
                </div>
                {publishErr && <p className="text-xs font-bold text-rose-600">{publishErr}</p>}
                <a href={publishedUrl} target="_blank" rel="noreferrer" className="block"><Button variant="primary" size="md" className="w-full">Otwórz stronę</Button></a>
                <div className="pt-4 border-t border-blue-100 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between text-xs"><span className="opacity-60">Status</span><span className="font-black text-emerald-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/> Live</span></div>
                  <div className="flex items-center justify-between text-xs"><span className="opacity-60">Aktualnie na stronie</span><span className="font-black">—</span></div>
                  <button onClick={() => { if (generatedSite) { const blob = new Blob([JSON.stringify(generatedSite.files, null, 2)], {type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='site-files.json'; a.click(); URL.revokeObjectURL(url) }}} className="w-full py-2 rounded-xl border text-xs font-bold hover:bg-neutral-50 dark:hover:bg-neutral-900">Zapisz projekt</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Wizard 4 pytań — tylko gdy prompt jest pusty */}
      <AnimatePresence>
        {showWizard && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWizard(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                <div className="flex items-center gap-2 text-white font-black text-sm"><Sparkles size={14} className="text-emerald-400" /> Agent ma pytania</div>
                <button onClick={() => setShowWizard(false)} className="text-neutral-400 hover:text-white cursor-pointer bg-transparent border-none"><X size={14} /></button>
              </div>
              <div className="p-5 space-y-3">
                <h3 className="font-black text-white text-sm">{WIZARD_DATA[wizardStep].title}</h3>
                <div className="space-y-2">
                  {WIZARD_DATA[wizardStep].options.map((opt) => {
                    const isChecked = wizardStep === 0 ? q2 === opt : wizardStep === 1 ? q1 === opt : wizardStep === 2 ? q3 === opt : q4.includes(opt);
                    return (
                      <label key={opt} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${isChecked ? 'bg-white text-black border-white' : 'bg-neutral-800 text-white border-neutral-700 hover:border-neutral-600'}`}>
                        <input
                          type={WIZARD_DATA[wizardStep].multi ? 'checkbox' : 'radio'}
                          checked={isChecked}
                          onChange={() => {
                            if (wizardStep === 0) setQ2(opt);
                            else if (wizardStep === 1) setQ1(opt);
                            else if (wizardStep === 2) setQ3(opt);
                            else toggleQ4(opt);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-xs font-bold leading-tight">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800 bg-neutral-950">
                <span className="text-[11px] font-bold text-neutral-400">Pytanie {wizardStep + 1} z 4 · koszt {cost} kr.</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleWizardAuto} className="bg-neutral-800 text-white hover:bg-neutral-700">Auto</Button>
                  <Button variant="primary" size="sm" onClick={handleWizardNext} className="font-black">{wizardStep === 3 ? 'Generuj' : 'Dalej'}</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};
const LEAD_COUNTRIES = ['Polska','USA','UK'] as const
const LEAD_INDUSTRIES = ['Restauracje','Kawiarnie','Bary i puby','Fast food','Piekarnie i cukiernie','Salony fryzjerskie','Salony kosmetyczne','Salony piękności','Manicure','Spa','Stomatolog','Przychodnia lekarska','Fizjoterapeuta','Weterynarz','Restauracja','Kawiarnia','Piekarnia','Pizzeria','Bar szybkiej obsługi','Catering','Hotel','Siłownia','Studio jogi','Trener personalny','Nieruchomości','Kancelaria prawna','Księgowość','Ubezpieczenia','Warsztat samochodowy','Salon samochodowy','Myjnia samochodowa','Fotograf','Usługi ślubne','Sprzątanie','Budownictwo','Hydraulik','Elektryk','Dekarz','Malarz','Przeprowadzki','Agencja marketingowa','Usługi IT','Serwis komputerowy','Sklep osiedlowy','Sklep odzieżowy','Sklep meblowy','Kwiaciarnia','Sklep zoologiczny','Fryzjer męski','Korepetycje','Szkoła muzyczna','Nauka jazdy']

type CityOption = { display_name: string; name: string; lat: string; lon: string; osm_id: number; osm_type: string; place_type: string; country_code?: string; importance?: number }

// Normalizacja nazwy do porownan — ignoruje polskie znaki (Wrocław == wroclaw)
const foldPl = (s: string) => (s || '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const LeadFinderView = ({
  onGenerateSiteForLead
}: {
  theme: 'light' | 'dark';
  onGenerateSiteForLead: (lead: Lead, opts?: { withImages?: boolean }) => void;
}) => {
  const [country, setCountry] = useState<string>('')
  const [industry, setIndustry] = useState<string>('')
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(true)
  const [citySelected, setCitySelected] = useState<string>('')
  const [cityDetails, setCityDetails] = useState<CityOption | null>(null)
  const [cityOpen, setCityOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<CityOption[]>([])
  const [cityLoading, setCityLoading] = useState(false)
  const [cityError, setCityError] = useState<string | null>(null)
  const [allCities, setAllCities] = useState<CityOption[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const cityReqIdRef = React.useRef(0)
  const citiesReqIdRef = React.useRef(0)
  const cityInputRef = React.useRef<HTMLInputElement>(null)
  const [industryOpen, setIndustryOpen] = useState(false)
  const [industryQuery, setIndustryQuery] = useState('')
  const industryInputRef = React.useRef<HTMLInputElement>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchWarning, setSearchWarning] = useState<string | null>(null)
  const [searchRemaining, setSearchRemaining] = useState<number | null>(null)
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'no-website' | 'has-website'>('all')
  const [leadSearch, setLeadSearch] = useState('')
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'industry'>('score')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20
  const [savingId, setSavingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    setCitySelected('')
    setCityDetails(null)
    setCityQuery('')
    setCityResults([])
    setCityError(null)
    setCityOpen(false)
    setLeads([])
    setHasSearched(false)
    setSearchError(null)
    setSearchWarning(null)
  }, [country])
  // Pelna lista miast dla wybranego kraju (prawdziwe dane OSM, cache 24h na backendzie)
  useEffect(() => {
    if (!country) {
      setAllCities([])
      setCitiesLoading(false)
      return
    }
    const reqId = ++citiesReqIdRef.current
    setCitiesLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/geocode/all-cities?country=${encodeURIComponent(country)}`)
        const data = await res.json()
        if (reqId !== citiesReqIdRef.current) return
        if (Array.isArray(data.results)) setAllCities(data.results as CityOption[])
        else setAllCities([])
      } catch {
        if (reqId === citiesReqIdRef.current) setAllCities([])
      } finally {
        if (reqId === citiesReqIdRef.current) setCitiesLoading(false)
      }
    })()
  }, [country])
  useEffect(() => {
    if (!cityOpen) return
    const q = cityQuery.trim()
    // Zdalne podpowiedzi (mniejsze miejscowosci spoza listy city/town) od 2 znakow
    if (q.length < 2 || !country) {
      setCityResults([])
      setCityLoading(false)
      return
    }
    const reqId = ++cityReqIdRef.current
    setCityLoading(true)
    setCityError(null)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode/autocomplete?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`)
        const data = await res.json()
        if (reqId !== cityReqIdRef.current) return
        if (data.error) {
          setCityError(data.error)
          setCityResults([])
        } else {
          setCityResults((data.results || []) as CityOption[])
        }
      } catch (e: any) {
        if (reqId !== cityReqIdRef.current) return
        setCityError('Błąd pobierania podpowiedzi')
        setCityResults([])
      } finally {
        if (reqId === cityReqIdRef.current) setCityLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [cityQuery, country, cityOpen])
  useEffect(() => {
    if (cityOpen) setTimeout(() => cityInputRef.current?.focus(), 50)
  }, [cityOpen])
  useEffect(() => {
    if (industryOpen) setTimeout(() => industryInputRef.current?.focus(), 50)
  }, [industryOpen])
  const filteredIndustries = React.useMemo(() => {
    const q = industryQuery.trim().toLowerCase()
    if (!q) return LEAD_INDUSTRIES as unknown as string[]
    return (LEAD_INDUSTRIES as unknown as string[]).filter(i => i.toLowerCase().includes(q))
  }, [industryQuery])
  const MAX_CITY_ROWS = 400
  // Lista miast w dropdownie: pelna lista (filtr lokalnie, bez ogonkow) + zdalne
  // podpowiedzi mniejszych miejscowosci doklejone na koniec
  const cityDisplayList = React.useMemo(() => {
    const qf = foldPl(cityQuery.trim())
    let base: CityOption[] = []
    if (!qf) {
      base = allCities
    } else {
      const starts: CityOption[] = []
      const incl: CityOption[] = []
      for (const c of allCities) {
        const nf = foldPl(c.name)
        if (nf.startsWith(qf)) starts.push(c)
        else if (nf.includes(qf)) incl.push(c)
      }
      base = [...starts, ...incl]
    }
    const seen = new Set(base.map(c => foldPl(c.name)))
    const extras = cityResults.filter(r => r.name && !seen.has(foldPl(r.name))).slice(0, 8)
    return [...base, ...extras]
  }, [allCities, cityQuery, cityResults])
  const hiddenCityCount = Math.max(0, cityDisplayList.length - MAX_CITY_ROWS)
  const displayLeads = React.useMemo(() => {
    let out = [...leads]
    if (websiteFilter === 'no-website') out = out.filter(l => !l.website)
    else if (websiteFilter === 'has-website') out = out.filter(l => !!l.website)
    if (leadSearch.trim()) {
      const q = leadSearch.toLowerCase()
      out = out.filter(l => (l.name || '').toLowerCase().includes(q) || (l.industry || l.category || '').toLowerCase().includes(q) || (l.address || '').toLowerCase().includes(q))
    }
    if (sortBy === 'score') out.sort((a,b) => (b.leadScore ?? b.readinessScore ?? 0) - (a.leadScore ?? a.readinessScore ?? 0))
    else if (sortBy === 'name') out.sort((a,b) => (a.name || '').localeCompare(b.name || ''))
    else if (sortBy === 'industry') out.sort((a,b) => ((a.industry || a.category || '') as string).localeCompare((b.industry || b.category || '') as string))
    return out
  }, [leads, websiteFilter, leadSearch, sortBy])
  useEffect(() => { setCurrentPage(1) }, [displayLeads.length, websiteFilter, leadSearch, sortBy])
  const totalPages = Math.max(1, Math.ceil(displayLeads.length / PAGE_SIZE))
  const pagedLeads = displayLeads.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE)
  const noWebsiteCount = leads.filter(l => !l.website).length
  const withWebsiteCount = leads.filter(l => !!l.website).length
  const handleFind = async () => {
    if (!country || !citySelected || !industry) return
    setIsSearching(true)
    setHasSearched(true)
    setSearchError(null)
    setSearchWarning(null)
    setLeads([])
    try {
      const plan = (() => { try { return localStorage.getItem('sitemorph-plan') || 'Starter' } catch { return 'Starter' } })()
      const body: any = {
        country,
        city: citySelected,
        industry,
        onlyWithoutWebsite,
        limit: 60,
      }
      if (cityDetails) {
        body.latitude = cityDetails.lat ? parseFloat(cityDetails.lat) : undefined
        body.longitude = cityDetails.lon ? parseFloat(cityDetails.lon) : undefined
        body.osmId = cityDetails.osm_id ? String(cityDetails.osm_id) : undefined
        body.osmType = cityDetails.osm_type || undefined
      }
      const { data: { session: _s2 } } = await supabase.auth.getSession()
      const _h2: Record<string,string> = { 'Content-Type': 'application/json', 'X-User-Plan': plan, 'X-User-Id': _s2?.user?.id || getUserId() }
      if (_s2?.access_token) _h2['Authorization'] = `Bearer ${_s2.access_token}`
      const res = await fetch('/api/leads/search', {
        method: 'POST',
        headers: _h2,
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.detail || data?.warning || data?.message || `Błąd ${res.status}`
        setSearchError(msg)
        if (data?.remaining !== undefined) setSearchRemaining(data.remaining)
        return
      }
      if (data.remaining !== undefined) setSearchRemaining(data.remaining)
      if (data.warning) setSearchWarning(data.warning)
      else setSearchWarning(null)
      if (Array.isArray(data.leads)) setLeads(data.leads)
      else setLeads([])
    } catch (e: any) {
      setSearchError('Błąd połączenia z serwerem — spróbuj ponownie')
    } finally {
      setIsSearching(false)
    }
  }
  const handleSave = async (lead: any) => {
    const id = String(lead.id)
    setSavingId(id)
    try {
      const { data: { session: _s3 } } = await supabase.auth.getSession()
      const _h3: Record<string,string> = { 'Content-Type': 'application/json', 'X-User-Id': _s3?.user?.id || getUserId() }
      if (_s3?.access_token) _h3['Authorization'] = `Bearer ${_s3.access_token}`
      const res = await fetch('/api/leads/save', {
        method: 'POST',
        headers: _h3,
        body: JSON.stringify({
          name: lead.name,
          industry: lead.industry || lead.category,
          address: lead.address,
          city: lead.city || lead.location,
          country: lead.country || country,
          phone: lead.phone,
          website: lead.website || null,
          latitude: lead.latitude,
          longitude: lead.longitude,
          osmId: lead.osmId,
          osmType: lead.osmType,
          leadScore: lead.leadScore ?? lead.readinessScore,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavedIds(prev => new Set(prev).add(id))
      } else {
        setSearchError(data?.detail || 'Błąd zapisu')
      }
    } catch {
      setSearchError('Błąd zapisu — brak połączenia')
    } finally {
      setSavingId(null)
    }
  }
  const copyLeadInfo = async (lead: any) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([lead.name, lead.address || '', lead.city || lead.location || '', lead.country || country].filter(Boolean).join(' '))}`
    const lines: (string | null)[] = [
      lead.name,
      lead.rating ? `${String(lead.rating).replace('.', ',')} (${lead.userRatingsTotal ?? '?'} opinii)` : null,
      (lead.industry || lead.category) || null,
      lead.address ? `Adres: ${lead.address}` : null,
      [lead.city || lead.location, lead.country].filter(Boolean).join(', ') || null,
      lead.phone ? `Telefon: ${lead.phone}` : null,
      lead.website ? `Strona: ${lead.website}` : null,
      lead.openingHours ? `Godziny otwarcia: ${lead.openingHours}` : null,
      `Google Maps: ${mapsUrl}`,
      '',
      'Do uzupełnienia z Google Maps: pełny adres, godziny otwarcia, ceny, zdjęcia.'
    ]
    const text = lines.filter((x): x is string => !!x).join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* pomiń */ }
      document.body.removeChild(ta)
    }
    setCopiedId(String(lead.id))
    setTimeout(() => setCopiedId(null), 2000)
  }
  const exportCsv = () => {
    const header = ['Nazwa','Branża','Adres','Miasto','Kraj','Telefon','Strona WWW','Szerokość','Długość','Wynik','OSM ID']
    const rows = displayLeads.map(l => {
      const vals = [
        l.name || '',
        l.industry || l.category || '',
        l.address || '',
        l.city || l.location || '',
        l.country || country || '',
        l.phone || '',
        l.website || '',
        l.latitude != null ? String(l.latitude) : '',
        l.longitude != null ? String(l.longitude) : '',
        String(l.leadScore ?? l.readinessScore ?? ''),
        l.osmId || ''
      ]
      return vals.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `leads-${(citySelected || 'results').replace(/\s+/g,'_')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }
  const cityRef = React.useRef<HTMLDivElement>(null)
  const industryRef = React.useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false)
      if (industryRef.current && !industryRef.current.contains(e.target as Node)) setIndustryOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <motion.div
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-[760px] mx-auto py-8 px-4 sm:px-6 space-y-6 pb-24 text-blue-600 dark:text-white"
      style={{ perspective: 1200, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="text-center space-y-3">
        <h2 className="text-[32px] sm:text-[36px] font-black tracking-tighter text-center" style={{ fontFamily: "'SF Pro Display', sans-serif", letterSpacing: '-0.03em' }}>LEAD FINDER</h2>
        <p className="text-[13px] font-semibold opacity-60 max-w-md mx-auto">Wybierz kraj, miasto i branżę — wyszukamy prawdziwe firmy z OSM. Bez mocków.</p>
        <div className="flex justify-center px-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-[10px] font-bold text-amber-800 dark:text-amber-300 text-left">
            <Info size={12} className="shrink-0" />
            Wersja 1.0 — może mieć błędy i czasem pokazywać dziwne informacje, ale ok. 90% wyników jest poprawnych
          </span>
        </div>
      </div>
      <motion.div variants={cineChild} className="p-6 sm:p-7 rounded-lg border shadow-xl space-y-5 bg-white dark:bg-black border-blue-100 dark:border-neutral-800">
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-widest opacity-60">Kraj</label>
          <div className="relative">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full appearance-none pl-4 pr-10 py-[13px] rounded-lg text-[14px] font-semibold outline-none border bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-700 cursor-pointer shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition"
              style={{ fontFamily: "'SF Pro Display', sans-serif" }}
            >
              <option value="" disabled>Wybierz kraj...</option>
              {(LEAD_COUNTRIES as unknown as string[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 opacity-40" size={16} />
          </div>
        </div>
        <div className="space-y-1.5" ref={cityRef}>
          <label className="text-[11px] font-black uppercase tracking-widest opacity-60">Miasto</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCityOpen(!cityOpen)}
              className={`w-full flex items-center justify-between pl-4 pr-10 py-[13px] rounded-lg text-[14px] font-semibold border bg-white dark:bg-neutral-950 shadow-sm text-left transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${cityOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'} ${!citySelected ? 'text-neutral-400' : 'text-blue-600 dark:text-white'}`}
              style={{ fontFamily: "'SF Pro Display', sans-serif" }}
            >
              <span className="flex items-center gap-2 truncate">
                <Search size={16} className="opacity-40 shrink-0" />
                <span className="truncate">{citySelected ? (cityDetails ? `${citySelected}` : citySelected) : 'Wybierz miasto z listy...'}</span>
              </span>
              <ChevronRight size={16} className={`opacity-40 shrink-0 transition-transform ${cityOpen ? '-rotate-90' : 'rotate-90'}`} />
            </button>
            <AnimatePresence>
              {cityOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="absolute z-30 mt-2 w-full rounded-lg border bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
                >
                  <div className="p-2 border-b border-neutral-100 dark:border-neutral-900">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                      <input
                        ref={cityInputRef}
                        value={cityQuery}
                        onChange={(e) => setCityQuery(e.target.value)}
                        placeholder="Filtruj lub wybierz z listy..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-[13px] font-semibold bg-blue-50/40 dark:bg-neutral-900 border-blue-100 dark:border-neutral-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <p className="text-[10px] font-bold opacity-50 mt-1.5 px-1">{country ? (citiesLoading ? 'Pobieram pełną listę miejscowości...' : `${allCities.length} miejscowości — przewiń lub wpisz nazwę, aby zawęzić`) : 'Pełna lista miast — najpierw wybierz kraj'}</p>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto no-scrollbar">
                    {!country && <div className="p-4 text-center text-xs font-bold opacity-50">Najpierw wybierz kraj</div>}
                    {country && citiesLoading && <div className="p-4 text-center text-xs font-bold opacity-60 flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> Pobieram pełną listę miejscowości...</div>}
                    {country && !citiesLoading && cityError && cityDisplayList.length === 0 && <div className="p-3 text-xs font-bold text-rose-600">{cityError}</div>}
                    {country && !citiesLoading && cityDisplayList.length === 0 && (
                      <div className="p-4 text-center text-xs font-bold opacity-50">Brak wyników{cityQuery.trim() ? ` dla „${cityQuery.trim()}"` : ''} — spróbuj innej pisowni</div>
                    )}
                    {country && !citiesLoading && cityDisplayList.slice(0, MAX_CITY_ROWS).map((r) => (
                      <button
                        key={`${r.osm_type}_${r.osm_id}_${foldPl(r.name)}`}
                        onClick={() => { setCitySelected(r.name); setCityDetails(r); setCityQuery(r.name); setCityOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-900 last:border-0 transition ${citySelected === r.name ? 'bg-blue-50 dark:bg-neutral-900' : ''}`}
                      >
                        <div className="text-[13px] font-black leading-tight">{r.name}</div>
                        <div className="text-[11px] font-semibold opacity-60 leading-tight truncate">{r.display_name}</div>
                        <div className="text-[10px] font-bold opacity-40">{r.place_type}{(r as any).importance ? ` • ${Number((r as any).importance).toLocaleString('pl-PL')} mieszk.` : ''}</div>
                      </button>
                    ))}
                    {country && !citiesLoading && hiddenCityCount > 0 && (
                      <div className="p-3 text-center text-[11px] font-bold opacity-50">+{hiddenCityCount} więcej — wpisz nazwę, aby zawęzić</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="space-y-1.5" ref={industryRef}>
          <label className="text-[11px] font-black uppercase tracking-widest opacity-60">Branża</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIndustryOpen(!industryOpen)}
              className={`w-full flex items-center justify-between pl-4 pr-10 py-[13px] rounded-lg text-[14px] font-semibold border bg-white dark:bg-neutral-950 shadow-sm text-left transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${industryOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'} ${!industry ? 'text-neutral-400' : 'text-blue-600 dark:text-white'}`}
              style={{ fontFamily: "'SF Pro Display', sans-serif" }}
            >
              <span className="flex items-center gap-2 truncate">
                <Search size={16} className="opacity-40 shrink-0" />
                <span className="truncate">{industry || 'Wybierz branżę...'}</span>
              </span>
              <ChevronRight size={16} className={`opacity-40 shrink-0 transition-transform ${industryOpen ? '-rotate-90' : 'rotate-90'}`} />
            </button>
            <AnimatePresence>
              {industryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="absolute z-30 mt-2 w-full rounded-lg border bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
                >
                  <div className="p-2 border-b border-neutral-100 dark:border-neutral-900">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                      <input
                        ref={industryInputRef}
                        value={industryQuery}
                        onChange={(e) => setIndustryQuery(e.target.value)}
                        placeholder="Filtruj branżę, np. Stomatolog, Hydraulik..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-[13px] font-semibold bg-blue-50/40 dark:bg-neutral-900 border-blue-100 dark:border-neutral-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto no-scrollbar">
                    {filteredIndustries.length===0 && <div className="p-4 text-center text-xs font-bold opacity-50">Brak branż dla filtra</div>}
                    {filteredIndustries.map((ind) => (
                      <button
                        key={ind}
                        onClick={() => { setIndustry(ind); setIndustryQuery(''); setIndustryOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold hover:bg-blue-50 dark:hover:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-900 last:border-0 transition ${industry===ind ? 'bg-blue-600 text-white dark:bg-white dark:text-black hover:bg-blue-600 dark:hover:bg-white' : ''}`}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <label className="flex items-center gap-3 p-3.5 rounded-lg border bg-blue-50/50 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-neutral-900/80 transition">
          <input type="checkbox" checked={onlyWithoutWebsite} onChange={(e) => setOnlyWithoutWebsite(e.target.checked)} className="w-[18px] h-[18px] accent-blue-600 rounded" />
          <span className="text-[13px] font-bold">Tylko firmy bez strony</span>
          <span className="ml-auto text-[11px] font-bold opacity-50">domyślnie zaznaczone</span>
        </label>
        <p className="text-[10px] font-semibold opacity-50 -mt-2 px-1">Wielkie sieci i marki (Żabka, McDonald's, dealerzy Opla itp.) są automatycznie pomijane — szukamy lokalnych firm, które realnie potrzebują strony.</p>
        <button
          onClick={handleFind}
          disabled={isSearching || !country || !citySelected || !industry}
          className="w-full py-[14px] rounded-lg bg-blue-600 dark:bg-white text-white dark:text-black font-black text-[15px] shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          style={{ fontFamily: "'SF Pro Display', sans-serif" }}
        >
          {isSearching ? <><span className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" /> Szukam...</> : 'Szukaj leadów'}
        </button>
        <p className="text-[10px] font-bold opacity-40 text-center">Backend → Nominatim + Overpass • prawdziwe dane OSM • {searchRemaining !== null ? `zostało ${searchRemaining}` : '10/mies Starter, 30/mies Business+'}</p>
      </motion.div>
      {!hasSearched ? (
        <motion.div variants={cineSoft} className="p-10 rounded-lg border text-center space-y-3 shadow-sm bg-white dark:bg-black border-blue-100 dark:border-neutral-800 max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto shadow-sm bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">
            <Search size={20} className="opacity-60" />
          </div>
          <h3 className="text-[15px] font-black">Wybierz filtry i kliknij Szukaj leadów</h3>
          <p className="text-[12px] font-semibold opacity-60">Pokazujemy tylko zweryfikowane firmy — żadnych mocków. Jeśli brak wyników, zobaczysz pusty stan.</p>
        </motion.div>
      ) : (
        <motion.div variants={cineSoft} className="space-y-4">
          {searchError && <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-[13px] font-bold text-rose-700 dark:text-rose-300">{searchError}</div>}
          {searchWarning && !searchError && <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[13px] font-bold text-amber-800 dark:text-amber-300">{searchWarning}</div>}
          {isSearching && <div className="p-8 rounded-lg border bg-white dark:bg-black border-blue-100 dark:border-neutral-800 flex flex-col items-center gap-3"><span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /><span className="text-[13px] font-bold">Szukam firm w OSM — to może potrwać 3–8s...</span></div>}
          {!isSearching && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-black p-3 rounded-lg bg-blue-50/60 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">
                <span>Znalezione firmy: {leads.length}</span><span className="opacity-30">•</span><span className="text-amber-600 dark:text-amber-400">Bez strony: {noWebsiteCount}</span><span className="opacity-30">•</span><span className="text-emerald-600 dark:text-emerald-400">Ze stroną: {withWebsiteCount}</span>
                <button onClick={exportCsv} disabled={displayLeads.length===0} className="ml-auto text-[11px] font-black px-3 py-1.5 rounded-lg border bg-white dark:bg-neutral-950 border-blue-200 dark:border-neutral-800 hover:bg-blue-50 dark:hover:bg-neutral-800 disabled:opacity-40">Eksport CSV</button>
              </div>
              {leads.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-[12px] font-semibold text-amber-800 dark:text-amber-300">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>Część firm może mieć stronę mimo braku jej w danych OSM — przed kontaktem zweryfikuj firmę w Google Maps (przycisk „Otwórz w mapach”).</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex rounded-lg border overflow-hidden bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 p-1 gap-1">
                  {(['all','no-website','has-website'] as const).map(f => (
                    <button key={f} onClick={() => setWebsiteFilter(f)} className={`px-3 py-1.5 rounded-lg text-[12px] font-black transition ${websiteFilter===f ? 'bg-blue-600 text-white dark:bg-white dark:text-black shadow-sm' : 'hover:bg-blue-50 dark:hover:bg-neutral-900'}`}>
                      {f==='all' ? 'Wszystkie' : f==='no-website' ? 'Bez strony' : 'Ze stroną'}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input value={leadSearch} onChange={(e)=>setLeadSearch(e.target.value)} placeholder="Szukaj firm (filtr po nazwie)..." className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-[13px] font-semibold bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <select value={sortBy} onChange={(e)=>setSortBy(e.target.value as any)} className="px-3 py-2.5 rounded-lg border text-[13px] font-black bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 cursor-pointer outline-none focus:border-blue-500">
                  <option value="score">Sortuj: Wynik</option>
                  <option value="name">Sortuj: Nazwa</option>
                  <option value="industry">Sortuj: Branża</option>
                </select>
              </div>
              {displayLeads.length===0 ? (
                <div className="p-12 rounded-lg border bg-white dark:bg-black border-blue-100 dark:border-neutral-800 text-center space-y-2">
                  <div className="text-[14px] font-black">Brak wyników</div>
                  <div className="text-[13px] font-semibold opacity-60">{leads.length===0 ? 'Nie znaleziono firm spełniających kryteria w tej okolicy. Spróbuj inne miasto lub branżę. Pokazujemy tylko prawdziwe dane OSM — niczego nie generujemy.' : `Brak wyników dla filtra "${leadSearch}" lub "${websiteFilter}".`}</div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3">
                    {pagedLeads.map((l) => {
                      const score = l.leadScore ?? l.readinessScore ?? 0
                      const isSaved = savedIds.has(String(l.id))
                      const addr = l.address || null
                      const phone = l.phone || null
                      const website = l.website || null
                      const cityCountry = [l.city || l.location, l.country || country].filter(Boolean).join(', ')
                      // Szukamy po nazwie + adresie, nie po kordynatach — wtedy Google Maps
                      // otwiera profil firmy (oceny, zdjecia, godziny), a nie pusty punkt na mapie
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.name, addr || '', cityCountry].filter(Boolean).join(' '))}`
                      return (
                        <motion.div layout key={String(l.id)} className="p-4 sm:p-5 rounded-lg border bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 hover:shadow-lg transition flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-[15px] leading-tight truncate" title={l.name}>{l.name}</h4>
                              <div className="text-[12px] font-bold opacity-60">{l.industry || l.category}</div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <span title="Punkty: +35 firma, +20 adres, +20 telefon, +20 brak strony, + do 5 bonus za nazwę" className="px-2.5 py-1 rounded-lg bg-blue-600 dark:bg-white text-white dark:text-black text-[11px] font-black cursor-help">Wynik {score}</span>
                            </div>
                          </div>
                          <div className="space-y-1 text-[12px] font-semibold">
                            <div className="flex items-start gap-1.5 opacity-80"><MapPin size={12} className="mt-0.5 shrink-0" /><span>{cityCountry || 'Brak danych'}</span></div>
                            <div className="flex items-start gap-1.5 opacity-80"><MapPin size={12} className="mt-0.5 shrink-0" /><span className={addr ? '' : 'opacity-50'}>{addr || 'Brak danych'}</span></div>
                            <div className="flex items-center gap-1.5 opacity-80"><Phone size={12} className="shrink-0" /><span className={phone ? '' : 'opacity-50'}>{phone || 'Brak danych'}</span></div>
                            <div className="flex items-center gap-1.5 opacity-80"><Globe size={12} className="shrink-0" />{website ? <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noreferrer" className="underline text-blue-600 dark:text-white truncate max-w-[220px]">{website}</a> : <span className="opacity-60">Brak strony w danych OSM — sprawdź w Google Maps</span>}</div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-50 dark:border-neutral-900">
                            <button onClick={() => handleSave(l)} disabled={!!savingId || isSaved} className={`px-3 py-1.5 rounded-lg text-[12px] font-black border transition ${isSaved ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200' : 'bg-blue-600 dark:bg-white text-white dark:text-black border-transparent hover:opacity-90 disabled:opacity-50'}`}>{isSaved ? '✓ Zapisano' : savingId===String(l.id) ? 'Zapisywanie...' : 'Zapisz lead'}</button>
                            <button onClick={() => copyLeadInfo(l)} className={`px-3 py-1.5 rounded-lg text-[12px] font-black border transition inline-flex items-center gap-1.5 ${copiedId===String(l.id) ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200' : 'bg-white dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 hover:bg-blue-50 dark:hover:bg-neutral-800'}`}>
                              <CopyIcon size={12} className="shrink-0" />
                              {copiedId===String(l.id) ? '✓ Skopiowano' : 'Kopiuj dane'}
                            </button>
                            <a href={mapsUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg text-[12px] font-black border bg-white dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 hover:bg-blue-50 dark:hover:bg-neutral-800">Otwórz w mapach</a>
                            <button onClick={() => onGenerateSiteForLead(l)} className="px-3 py-1.5 rounded-lg text-[12px] font-black border bg-lime-300 text-black border-lime-400 hover:bg-lime-400">Stwórz stronę</button>
                          </div>
                          <p className="text-[10px] font-semibold opacity-50 leading-snug -mt-1">
                            Wskazówka: przed budowaniem strony otwórz firmę w Google Maps i skopiuj dodatkowe dane (pełny adres, godziny otwarcia, ceny, zdjęcia do galerii) — przycisk „Kopiuj dane" zapisuje wszystko, co już mamy.
                          </p>
                        </motion.div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[12px] font-bold opacity-60">Strona {currentPage} z {totalPages} • {displayLeads.length} wyników • 20/stronę</span>
                    <div className="flex gap-2">
                      <button disabled={currentPage<=1} onClick={() => setCurrentPage(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg border text-[12px] font-black bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 disabled:opacity-40 hover:bg-blue-50 dark:hover:bg-neutral-900">Poprzednia</button>
                      <button disabled={currentPage>=totalPages} onClick={() => setCurrentPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1.5 rounded-lg border text-[12px] font-black bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 disabled:opacity-40 hover:bg-blue-50 dark:hover:bg-neutral-900">Następna</button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}



// ============================================================================
// 11. WIDOK: CENNIK
// ============================================================================
const StandalonePricingView = () => {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <motion.div 
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto py-6 lg:py-10 px-6 lg:px-4 space-y-10 pb-24 text-blue-600 dark:text-white"
      style={{ perspective: 1600 }}
    >
      <motion.div variants={cineSoft} className="text-center space-y-3 relative">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[240px] morph-blob bg-gradient-to-tr from-lime-100 via-emerald-50 to-blue-50 dark:from-lime-500/10 dark:via-emerald-400/5 dark:to-blue-400/5 blur-3xl opacity-70" />
        <div className="relative text-emerald-500 dark:text-emerald-400 font-black text-xs tracking-[0.2em] uppercase">Cennik i Plany</div>
        <h2 className="relative text-5xl sm:text-6xl font-black tracking-tighter leading-[0.9]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
          Wybierz swój <span className="text-gradient-lime-soft font-story-script text-6xl sm:text-7xl px-1">Plan</span>
        </h2>
        <p className="relative text-sm font-bold max-w-xl mx-auto opacity-80 leading-relaxed">
          Odblokuj pełne możliwości AI. Twórz strony, szukaj klientów i zarabiaj bez limitów.
        </p>

        <div className="pt-4 flex justify-center">
          <div className="p-1 rounded-full flex items-center gap-1 text-[11px] font-bold border shadow-md bg-white dark:bg-black border-blue-200 dark:border-neutral-900">
            <button
              onClick={() => setIsYearly(false)}
              className={`relative px-5 py-2 rounded-full cursor-pointer transition-colors border-none font-black ${
                !isYearly ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white'
              }`}
            >
              {!isYearly && (
                <motion.div
                  layoutId="pricingPeriodPill"
                  transition={springTransition}
                  className="absolute inset-0 bg-blue-600 dark:bg-white rounded-full shadow-sm"
                />
              )}
              <span className="relative z-10">Miesięcznie</span>
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`relative px-5 py-2 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors border-none font-black ${
                isYearly ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white'
              }`}
            >
              {isYearly && (
                <motion.div
                  layoutId="pricingPeriodPill"
                  transition={springTransition}
                  className="absolute inset-0 bg-blue-600 dark:bg-white rounded-full shadow-sm"
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                Rocznie <span className="text-[9px] bg-emerald-400 text-black px-2 py-0.5 rounded-full font-black">-20%</span>
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={cineParent}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6 items-stretch"
        style={{ perspective: 1600 }}
      >
        {[
          { name: 'Starter', price: 50, credits: 100, features: ['100 kredytów AI / mies', 'Wyszukiwanie firm (5/mies)', 'Generowanie stron AI', 'Fakturowanie klientów'] },
          { name: 'Pro', price: 100, credits: 250, popular: true, features: ['250 kredytów AI / mies', 'Wyszukiwanie firm (25/mies)', 'Generowanie stron AI', 'Własne subdomeny'] },
          { name: 'Business', price: 199, credits: 500, features: ['500 kredytów AI / mies', 'Wyszukiwanie firm (100/mies)', 'Generowanie stron AI', 'Własne domeny'] },
          { name: 'Agencja', price: 500, credits: 1500, features: ['1500 kredytów AI / mies', 'Nielimitowane wyszukiwania', 'White-label (brak logo)', 'Wsparcie API'] }
        ].map((plan, idx) => {
          const finalPrice = isYearly ? Math.round(plan.price * 0.8) : plan.price;
          return (
            <motion.div
              custom={idx}
              variants={cineStagger}
              whileHover={{ y: -10, scale: 1.03, rotateX: 4 }}
              transition={springTransition}
              key={idx}
              className={`rounded-3xl p-7 lg:p-8 flex flex-col justify-between border transition-all relative shadow-xl ${
                plan.popular
                  ? 'border-blue-600 dark:border-white ring-2 ring-blue-600/20 dark:ring-white/20'
                  : 'bg-white dark:bg-black border-blue-100 dark:border-neutral-900'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white dark:bg-white dark:text-black text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                  Najpopularniejszy
                </div>
              )}

              <div>
                <h3 className="text-xl font-black mb-1" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{plan.name}</h3>

                <div className="flex items-baseline gap-1 my-4">
                  <span className="text-4xl font-black tracking-tighter">{finalPrice} zł</span>
                  <span className="text-sm font-bold opacity-60">/mies</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  <div className="p-3 rounded-xl text-center border bg-blue-50/60 dark:bg-neutral-950 border-blue-100 dark:border-neutral-900">
                    <div className="text-base font-black text-emerald-500">{plan.credits}</div>
                    <div className="text-[10px] uppercase font-black opacity-60 tracking-wide">Kredytów</div>
                  </div>
                  <div className="p-3 rounded-xl text-center border bg-blue-50/60 dark:bg-neutral-950 border-blue-100 dark:border-neutral-900">
                    <div className="text-base font-black text-emerald-500">{plan.name === 'Agencja' ? '∞' : plan.name === 'Business' ? '100' : plan.name === 'Pro' ? '25' : '5'}</div>
                    <div className="text-[10px] uppercase font-black opacity-60 tracking-wide">Projektów</div>
                  </div>
                </div>

                <ul className="space-y-3 text-sm">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 font-bold">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <Button 
                variant={plan.popular ? 'primary' : 'outline'} 
                size="md" 
                onClick={() => alert(`Subskrybujesz pakiet ${plan.name}!`)}
                className="w-full mt-6 font-black"
              >
                Wybierz {plan.name}
              </Button>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// 12. MODUŁ FINANSÓW
// ============================================================================
const FinanceSection = () => {
  const [isProfileSet, setIsProfileSet] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [userName, setUserName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const handleCompleteSetup = () => {
    if (!businessName.trim() || !businessEmail.trim()) {
      alert('Proszę wypełnić wymagane pola (Nazwa firmy, Email).');
      return;
    }
    setIsProfileSet(true);
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientEmail || !newAmount) return;

    const newInv: Invoice = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      clientName: newClientName,
      clientEmail: newClientEmail,
      amount: parseFloat(newAmount),
      status: 'Oczekująca',
      date: new Date().toLocaleDateString('pl-PL')
    };

    setInvoices([newInv, ...invoices]);
    setShowCreateModal(false);
    setNewClientName('');
    setNewClientEmail('');
    setNewAmount('');
  };

  const totalRevenue = invoices
    .filter((i) => i.status === 'Opłacona')
    .reduce((sum, curr) => sum + curr.amount, 0);

  const outstanding = invoices
    .filter((i) => i.status === 'Oczekująca')
    .reduce((sum, curr) => sum + curr.amount, 0);

  const inputClasses = "w-full rounded-xl px-3.5 py-2 text-xs font-bold outline-none border text-blue-600 dark:text-white placeholder:text-blue-400 dark:placeholder:text-neutral-500 bg-blue-50/40 dark:bg-neutral-950 border-blue-200 dark:border-neutral-800";

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto py-8 px-6 space-y-6 pb-24 text-blue-600 dark:text-white"
    >
      <div className="flex items-center justify-between border-b border-blue-100 dark:border-neutral-900 pb-3">
        <div>
          <h2 className="text-xl font-black">Finanse i Księgowość</h2>
          <p className="text-xs font-bold opacity-80">
            {isProfileSet ? `Firma: ${businessName}` : 'Rejestracja profilu płatniczego i firmy'}
          </p>
        </div>
        {isProfileSet && (
          <Button variant="outline" size="sm" onClick={() => setIsProfileSet(false)}>
            Edytuj dane firmy
          </Button>
        )}
      </div>

      {!isProfileSet ? (
        <motion.div variants={itemVariants} className="max-w-xl mx-auto space-y-6 pt-4 text-center">
          <div>
            <h3 className="text-2xl font-black">Załóż profil firmy</h3>
            <p className="text-xs font-bold mt-1 opacity-80">Wprowadź dane swojej działalności, aby wystawiać faktury.</p>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs font-bold py-2">
            {[
              { n: 1, label: 'Dane firmy' },
              { n: 2, label: 'Metody płatności' },
              { n: 3, label: 'Potwierdzenie' }
            ].map((step, idx) => (
              <React.Fragment key={step.n}>
                {idx > 0 && <span className="w-8 h-px bg-blue-200 dark:bg-neutral-800" />}
                <span className={`flex items-center gap-2 ${setupStep >= step.n ? 'text-emerald-400 font-black' : 'opacity-70'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                    setupStep >= step.n ? 'bg-blue-600 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-blue-100 dark:bg-neutral-900 text-blue-600 dark:text-white'
                  }`}>{step.n}</span>
                  {step.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          <motion.div 
            layout
            className="p-6 rounded-3xl border text-left space-y-4 shadow-xl bg-white dark:bg-black border-blue-100 dark:border-neutral-900"
          >
            {setupStep === 1 && (
              <div className="space-y-3">
                <h4 className="font-black text-sm">Krok 1: Wprowadź dane firmy</h4>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Nazwa firmy / Studia *</label>
                  <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="np. Studio Projektowe" className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Imię i nazwisko właściciela *</label>
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="np. Jan Kowalski" className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Email firmowy do faktur *</label>
                  <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="jan@studio.pl" className={inputClasses} />
                </div>
                <div>
                  <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Telefon (opcjonalnie)</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+48 500 000 000" className={inputClasses} />
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div className="space-y-4">
                <h4 className="font-black text-sm">Krok 2: Domyślne metody rozliczeń</h4>
                <p className="text-xs font-bold opacity-80">Zaznacz metody płatności dla klientów.</p>
                {['Przelew bankowy', 'BLIK / Przelew na telefon', 'Stripe / Karty płatnicze'].map((method, i) => (
                  <label key={i} className="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer border-blue-100 dark:border-neutral-800 bg-blue-50/40 dark:bg-neutral-950">
                    <span className="text-xs font-black">{method}</span>
                    <input type="checkbox" defaultChecked={i < 2} className="w-4 h-4 accent-blue-600 dark:accent-white" />
                  </label>
                ))}
              </div>
            )}

            {setupStep === 3 && (
              <div className="space-y-3 text-xs">
                <h4 className="font-black text-sm">Krok 3: Podsumowanie danych</h4>
                {[
                  ['Nazwa firmy', businessName || '—'],
                  ['Właściciel', userName || '—'],
                  ['Email', businessEmail || '—'],
                  ['Metody rozliczeń', 'Przelew bankowy, BLIK']
                ].map(([label, value], i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-blue-100 dark:border-neutral-900 last:border-none">
                    <span className="font-bold opacity-75">{label}:</span>
                    <span className="font-black">{value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 gap-2">
              {setupStep > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setSetupStep(setupStep - 1)}>
                  Wstecz
                </Button>
              )}
              {setupStep < 3 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (setupStep === 1 && (!businessName.trim() || !businessEmail.trim())) {
                      alert('Wypełnij wymagane pola (Nazwa firmy i Email)');
                      return;
                    }
                    setSetupStep(setupStep + 1);
                  }}
                >
                  Dalej →
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleCompleteSetup} className="font-black shadow-md">
                  Załóż firmę i przejdź do finansów ✓
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="space-y-6 pt-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: 'Łączny przychód', value: `${totalRevenue} zł`, color: 'text-emerald-400' },
              { title: 'Oczekujące wpłaty', value: `${outstanding} zł`, color: 'text-amber-500' },
              { title: 'Wystawione faktury', value: invoices.length, color: 'text-blue-600 dark:text-white' },
              { title: 'Opłacone faktury', value: invoices.filter((i) => i.status === 'Opłacona').length, color: 'text-blue-600 dark:text-white' }
            ].map((stat, i) => (
              <motion.div 
                whileHover={{ y: -3 }}
                key={i} 
                className="p-4 rounded-2xl border shadow-lg bg-white dark:bg-black border-blue-100 dark:border-neutral-900"
              >
                <span className="text-[10px] font-black uppercase tracking-wider block mb-1 opacity-70">{stat.title}</span>
                <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
              </motion.div>
            ))}
          </div>

          <div className="p-6 rounded-3xl border shadow-xl space-y-4 bg-white dark:bg-black border-blue-100 dark:border-neutral-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black">Rejestr faktur</span>
              <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)} className="gap-1 text-xs font-black">
                <Plus size={14} /> Stwórz nową fakturę
              </Button>
            </div>

            {invoices.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 border shadow-sm bg-blue-50 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800">
                  <Receipt size={24} />
                </div>
                <h4 className="text-xs font-black">Brak wystawionych faktur</h4>
                <p className="text-xs font-bold opacity-80">Kliknij przycisk powyżej, aby wystawić pierwszą fakturę dla klienta.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-blue-100 dark:border-neutral-900 font-black">
                      <th className="py-2.5">Klient</th>
                      <th className="py-2.5">Email</th>
                      <th className="py-2.5">Kwota</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 dark:divide-neutral-900 font-bold">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-blue-50/50 dark:hover:bg-neutral-900/40">
                        <td className="py-3 font-black">{inv.clientName}</td>
                        <td className="py-3 font-mono">{inv.clientEmail}</td>
                        <td className="py-3 font-black text-emerald-400">{inv.amount} zł</td>
                        <td className="py-3">
                          <span
                            onClick={() => {
                              setInvoices(invoices.map((i) =>
                                i.id === inv.id
                                  ? { ...i, status: i.status === 'Opłacona' ? 'Oczekująca' : 'Opłacona' }
                                  : i
                              ));
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black cursor-pointer select-none shadow-sm ${
                              inv.status === 'Opłacona'
                                ? 'bg-lime-50 text-lime-700 dark:bg-neutral-900 dark:text-lime-300 border border-lime-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-neutral-900 dark:text-amber-300 border border-amber-400'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono">{inv.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* MODAL TWORZENIA FAKTURY */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={springTransition}
              className="w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-4 relative text-left bg-white dark:bg-black border-blue-200 dark:border-neutral-800 text-blue-600 dark:text-white"
            >
              <motion.button
                whileHover={{ scale: 1.15 }}
                onClick={() => setShowCreateModal(false)}
                className="absolute right-4 top-4 p-1 rounded-full cursor-pointer bg-transparent border-none text-inherit"
              >
                <X size={16} />
              </motion.button>

              <h3 className="font-black text-base">Nowa faktura</h3>

              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Nazwa klienta *</label>
                    <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Jan Kowalski" required className={inputClasses} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Email klienta *</label>
                    <input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="jan@firma.pl" required className={inputClasses} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Kwota (PLN) *</label>
                    <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="4500" required className={inputClasses} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-blue-100 dark:border-neutral-900">
                  <span className="font-black text-sm">Suma: {newAmount || '0'} zł</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
                      Anuluj
                    </Button>
                    <Button variant="primary" size="sm" type="submit" className="gap-1 text-xs font-black shadow-md">
                      <Send size={12} /> Wyślij fakturę
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// 13. WIDOK: AKADEMIA
// ============================================================================
const TutorialsView = () => {
  const [activeGuide, setActiveGuide] = useState<number | null>(null);

  return (
    <motion.div 
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto py-8 px-6 pb-16 text-blue-600 dark:text-white"
      style={{ perspective: 1600 }}
    >
      <motion.div variants={cineSoft} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-blue-100 dark:bg-neutral-900 text-blue-600 dark:text-white border border-blue-200 dark:border-neutral-800">
          <GraduationCap size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Akademia SiteMorph</h1>
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
            className="rounded-2xl p-6 border shadow-xl transition-all flex flex-col justify-between cursor-pointer bg-white dark:bg-black border-blue-100 dark:border-neutral-900 hover:border-blue-300 dark:hover:border-neutral-700 hover:shadow-2xl"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-neutral-800">{g.category}</span>
                <span className="text-[10px] font-black flex items-center gap-1"><Clock size={12} /> {g.time}</span>
              </div>
              <h3 className="text-base font-black mb-1 leading-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{g.title}</h3>
              <p className="text-xs font-bold opacity-70 leading-relaxed">{g.excerpt}</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-blue-100 dark:border-neutral-900 mt-4">
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
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[86vh] overflow-hidden rounded-3xl bg-white dark:bg-neutral-950 border border-blue-100 dark:border-neutral-800 shadow-2xl flex flex-col"
              style={{ perspective: 1200 }}
            >
              <div className="pointer-events-none absolute -top-24 -right-24 w-[340px] h-[340px] bg-gradient-to-tr from-lime-200 via-emerald-200 to-lime-100 opacity-25 blur-2xl legal-blob" />
              <div className="relative flex items-center justify-between p-6 border-b border-blue-100 dark:border-neutral-900 bg-white/85 dark:bg-neutral-950/85 backdrop-blur sticky top-0">
                <div className="pr-4">
                  <div className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800 w-fit">{ACADEMY_GUIDES[activeGuide].category} · {ACADEMY_GUIDES[activeGuide].time}</div>
                  <h3 className="text-lg font-black tracking-tight mt-1.5 leading-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{ACADEMY_GUIDES[activeGuide].title}</h3>
                </div>
                <motion.button whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: 0.92 }} onClick={() => setActiveGuide(null)} className="w-8 h-8 rounded-full grid place-items-center bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800 cursor-pointer shrink-0">
                  <X size={14} />
                </motion.button>
              </div>
              <div className="relative overflow-y-auto p-6 space-y-6 no-scrollbar text-left" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
                {ACADEMY_GUIDES[activeGuide].content.map((s) => (
                  <div key={s.h} className="space-y-2">
                    <h4 className="text-sm font-black tracking-tight">{s.h}</h4>
                    <p className="text-xs font-medium leading-relaxed opacity-85 whitespace-pre-wrap">{s.p}</p>
                  </div>
                ))}
                <div className="pt-4 flex justify-end border-t border-blue-100 dark:border-neutral-900">
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
const CookieBanner = () => {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    try { if (!localStorage.getItem('sitemorph-cookies-accepted')) setShow(true); } catch { setShow(true); }
  }, []);
  if (!show) return null;
  return (
    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] max-w-lg w-[calc(100%-2rem)] rounded-2xl border bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 shadow-2xl p-4 flex flex-col sm:flex-row items-center gap-3">
      <p className="text-xs font-bold leading-relaxed flex-1" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Używamy plików cookie, aby strona działała poprawnie. Kliknij Akceptuj, aby kontynuować. <button onClick={() => { try{localStorage.setItem('sitemorph-cookies-accepted','1')}catch{}; setShow(false); }} className="underline font-black">Polityka cookies</button></p>
      <Button variant="primary" size="sm" onClick={() => { try{localStorage.setItem('sitemorph-cookies-accepted','1')}catch{}; setShow(false); }} className="shrink-0">Akceptuj</Button>
    </motion.div>
  );
};

// ============================================================================
// 14a. PANEL ADMINISTRATORA (pełnoekranowe okno)
// ============================================================================
const AdminPanel = ({ onClose, credits, setCredits }: { onClose: () => void; credits: number; setCredits: React.Dispatch<React.SetStateAction<number>> }) => {
  const [liveStats, setLiveStats] = useState([
    { label: 'Użytkownicy', value: '0', delta: '—', icon: LayoutDashboard },
    { label: 'Strony wygenerowane', value: '0', delta: '—', icon: Globe },
    { label: 'MRR', value: '0 zł', delta: '—', icon: Wallet },
    { label: 'Leady znalezione', value: '0', delta: '—', icon: Search },
  ]);
  const [liveUsers, setLiveUsers] = useState<typeof ADMIN_USERS>([]);
  const [creditUser, setCreditUser] = useState('oskar1255900');
  const [creditAmount, setCreditAmount] = useState('25');
  const [creditMsg, setCreditMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => {
        setLiveStats([
          { label: 'Użytkownicy', value: String(d.users ?? 0), delta: '—', icon: LayoutDashboard },
          { label: 'Strony wygenerowane', value: String(d.pages ?? 0), delta: '—', icon: Globe },
          { label: 'MRR', value: String(d.mrr ?? '0 zł'), delta: '—', icon: Wallet },
          { label: 'Leady znalezione', value: String(d.leads ?? 0), delta: '—', icon: Search },
        ]);
      })
      .catch(() => {});
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, filter: 'blur(12px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.97, filter: 'blur(12px)' }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="fixed inset-0 z-[95] bg-white dark:bg-black text-blue-600 dark:text-white overflow-y-auto no-scrollbar"
    >
      {/* morph blobs */}
      <div className="pointer-events-none fixed -top-32 -right-32 w-[520px] h-[520px] bg-gradient-to-tr from-lime-200 via-emerald-100 to-lime-100 dark:from-lime-500/15 dark:via-emerald-400/10 dark:to-lime-400/15 blur-3xl morph-blob" />
      <div className="pointer-events-none fixed -bottom-32 -left-32 w-[460px] h-[460px] bg-gradient-to-tr from-blue-100 via-sky-100 to-lime-100 dark:from-blue-500/10 dark:via-sky-400/5 dark:to-lime-400/10 blur-3xl morph-blob" style={{ animationDelay: '1.2s' }} />

      <div className="relative max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between border-b border-blue-100 dark:border-neutral-900 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-white text-white dark:text-black grid place-items-center font-black"><Settings size={18} /></div>
            <div>
              <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Panel administratora</h1>
              <p className="text-[11px] font-bold opacity-60">Tylko dla administratora · wszystkie dane o stronie w jednym miejscu</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}><X size={14} /> Zamknij panel</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {liveStats.map((s) => (
            <motion.div key={s.label} whileHover={{ y: -4, scale: 1.02 }} className="rounded-2xl border p-5 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{s.label}</span>
                <s.icon size={14} className="opacity-60" />
              </div>
              <div className="text-2xl font-black mt-1" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{s.value}</div>
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">{s.delta}</div>
            </motion.div>
          ))}
        </div>

        <div className="rounded-2xl border p-5 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 mb-6">
          <h3 className="text-sm font-black mb-3">Zarządzanie kredytami</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={creditUser} onChange={(e) => setCreditUser(e.target.value)} placeholder="Nazwa użytkownika" className="px-3 py-2 rounded-xl border text-xs font-bold bg-blue-50/40 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 outline-none" />
            <select value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="px-3 py-2 rounded-xl border text-xs font-black bg-blue-50/40 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800 cursor-pointer">
              <option value="10">+10 kredytów</option>
              <option value="25">+25 kredytów</option>
              <option value="50">+50 kredytów</option>
              <option value="100">+100 kredytów</option>
              <option value="500">+500 kredytów</option>
            </select>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const amt = parseInt(creditAmount, 10) || 0;
                if (creditUser.trim().toLowerCase() === 'oskar1255900') {
                  setCredits((c) => c + amt);
                }
                setCreditMsg(`Dodano ${amt} kredytów dla ${creditUser} ${creditUser.toLowerCase() !== 'oskar1255900' ? '(demo)' : ''}`);
                setTimeout(() => setCreditMsg(''), 3000);
              }}
              className="font-black"
            >
              Dodaj kredyty
            </Button>
          </div>
          <div className="text-xs font-bold mt-3 flex items-center gap-2">
            <span className="opacity-70">Twoje kredyty: {credits}</span>
            {creditMsg && <span className="text-emerald-600 dark:text-emerald-400">· {creditMsg}</span>}
          </div>
          <p className="text-[10px] font-bold opacity-60 mt-1">Wszystko w panelu administratora — dodaj sobie lub komuś innemu. Przykład: wpisz „oskar1255900” aby doładować swoje konto.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 overflow-hidden">
            <div className="p-4 border-b border-blue-100 dark:border-neutral-900 flex items-center justify-between">
              <h3 className="text-sm font-black">Ostatni użytkownicy</h3>
              <Badge type="lime">{liveUsers.length} kont</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-blue-50/60 dark:bg-neutral-900">
                  <tr className="font-black">
                    <th className="px-4 py-2.5">Użytkownik</th><th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">Stron</th><th className="px-4 py-2.5">Wydane</th><th className="px-4 py-2.5">Dołączył</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 dark:divide-neutral-900">
                  {liveUsers.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center font-bold opacity-60">Brak danych — na razie 0 użytkowników</td></tr>
                  ) : liveUsers.map((u) => (
                    <tr key={u.name} className="font-bold hover:bg-blue-50/40 dark:hover:bg-neutral-900/40">
                      <td className="px-4 py-3 font-black">{u.name}</td><td className="px-4 py-3">{u.plan}</td><td className="px-4 py-3">{u.pages}</td><td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">{u.spent}</td><td className="px-4 py-3 opacity-70">{u.joined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border p-5 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
              <h3 className="text-sm font-black mb-3">Status usług</h3>
              <div className="space-y-2.5">
                {ADMIN_SERVICES.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black leading-none">{svc.name}</div>
                      <div className="text-[10px] font-bold opacity-60">{svc.latency}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black ${svc.status === 'Operational' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}`}>{svc.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border p-5 bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800">
              <h3 className="text-sm font-black mb-2">Informacje o stronie</h3>
              <div className="space-y-2 text-xs font-bold">
                <div className="flex justify-between"><span className="opacity-60">Wersja</span><span>SiteMorph 2.4.1</span></div>
                <div className="flex justify-between"><span className="opacity-60">Build</span><span>2026.08.22</span></div>
                <div className="flex justify-between"><span className="opacity-60">Środowisko</span><span>production</span></div>
                <div className="flex justify-between"><span className="opacity-60">Uptime</span><span>99.97% / 30 dni</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-xs font-bold leading-relaxed">
          <span className="font-black">Uwaga:</span> to jest panel demo w przeglądarce. Prawdziwa weryfikacja hasła powinna odbywać się na backendzie (<code className="px-1 py-0.5 rounded bg-white dark:bg-black border">POST /api/admin/verify</code>). Tutaj porównujemy jedynie SHA-256 hasha, więc hasło w jawnej postaci nie występuje w kodzie frontendu.
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// 14. WIDOK: POMOC
// ============================================================================
const HelpView = ({ credits, setCredits }: { credits: number; setCredits: React.Dispatch<React.SetStateAction<number>> }) => {
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminErr, setAdminErr] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const inputClasses = "w-full rounded-xl px-3 py-2 text-xs font-bold outline-none border text-blue-600 dark:text-white placeholder:text-blue-400 dark:placeholder:text-neutral-500 bg-blue-50/40 dark:bg-neutral-950 border-blue-200 dark:border-neutral-800";

  const handleAdminLogin = async () => {
    if (!adminPass.trim()) { setAdminErr('Wpisz hasło'); return; }
    setAdminLoading(true);
    setAdminErr('');
    try {
      const hash = await sha256Hex(adminPass);
      const res = await fetch('/api/admin/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': getUserId() }, body: JSON.stringify({ hash }) });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        setAdminOpen(true);
        setShowAdminLogin(false);
        setAdminPass('');
      } else {
        setAdminErr(data.message || 'Nieprawidłowe hasło');
      }
    } catch {
      setAdminErr('Brak połączenia z serwerem');
    } finally {
      setAdminLoading(false);
    }
  };

  if (adminOpen) {
    return <AdminPanel onClose={() => setAdminOpen(false)} credits={credits} setCredits={setCredits} />;
  }

  return (
    <motion.div 
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto py-8 px-6 pb-16 text-blue-600 dark:text-white"
      style={{ perspective: 1200 }}
    >
      <motion.div variants={cineSoft} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-blue-100 dark:bg-neutral-900 text-blue-600 dark:text-white border border-blue-200 dark:border-neutral-800">
          <HelpCircle size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Centrum Pomocy</h1>
          <p className="text-xs font-bold opacity-80">Masz pytanie? Odpowiadamy zazwyczaj w 24h.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <motion.div variants={cineParent} initial="hidden" animate="visible" className="md:col-span-4 space-y-4">
          <motion.div variants={cineChild} className="rounded-2xl p-5 border shadow-xl bg-white dark:bg-black border-blue-100 dark:border-neutral-900">
            <h3 className="text-sm font-black mb-1">Kontakt bezpośredni</h3>
            <p className="text-xs font-bold mb-3 opacity-80">Napisz bezpośrednio na nasz email:</p>
            <a href="mailto:support@sitemorph.ai" className="text-xs font-black text-emerald-400 hover:underline">support@sitemorph.ai</a>
          </motion.div>
          <div className="flex justify-center pt-1">
            <button onClick={() => setShowAdminLogin(true)} className="text-[9px] font-bold tracking-widest uppercase opacity-[0.18] hover:opacity-60 transition-opacity cursor-pointer bg-transparent border-none select-none" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
              Panel
            </button>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="md:col-span-8 rounded-3xl p-8 border shadow-xl bg-white dark:bg-black border-blue-100 dark:border-neutral-900">
          {sent ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12 space-y-3"
            >
              <div className="w-12 h-12 bg-emerald-400 text-black rounded-full flex items-center justify-center mx-auto mb-2 font-black shadow-md">
                <Check size={24} />
              </div>
              <h3 className="text-lg font-black">Wiadomość wysłana!</h3>
              <p className="text-xs font-bold opacity-80">Odpowiadamy najszybciej jak to możliwe.</p>
              <button onClick={() => setSent(false)} className="text-xs font-black text-emerald-400 hover:underline pt-2 cursor-pointer bg-transparent border-none">Wyślij kolejną</button>
            </motion.div>
          ) : (
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <div>
                <label className="text-[10px] font-black block mb-2 uppercase opacity-75">Czego dotyczy zgłoszenie?</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Sugerowana funkcja', 'Błąd na stronie', 'Pytanie ogólne', 'Inne'].map((item, idx) => (
                    <label key={idx} className="flex items-center gap-2 text-xs font-black p-3 rounded-xl border cursor-pointer border-blue-200 dark:border-neutral-900 bg-blue-50/40 dark:bg-neutral-950">
                      <input type="radio" name="category" defaultChecked={idx === 0} className="accent-blue-600 dark:accent-white" />
                      {item}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black block mb-1 uppercase opacity-75">Twoja wiadomość</label>
                <textarea
                  rows={4}
                  required
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Opisz swój problem lub pytanie..."
                  className={`${inputClasses} resize-none`}
                />
              </div>

              <Button variant="primary" size="md" type="submit" className="w-full font-black">
                <Send size={14} /> Wyślij zgłoszenie
              </Button>
            </form>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showAdminLogin && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowAdminLogin(false); setAdminErr(''); }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-950 border border-blue-100 dark:border-neutral-800 shadow-2xl p-6 space-y-4"
            >
              <div className="relative flex items-center justify-between">
                <h3 className="text-base font-black" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Panel administratora</h3>
                <button onClick={() => { setShowAdminLogin(false); setAdminErr(''); }} className="w-7 h-7 rounded-full grid place-items-center bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800 cursor-pointer">
                  <X size={12} />
                </button>
              </div>
              <p className="relative text-xs font-bold opacity-70">Wpisz hasło administratora. Weryfikacja odbywa się wyłącznie po stronie serwera.</p>
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin(); }}
                placeholder="Hasło administratora"
                className="relative w-full rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none border bg-blue-50/60 dark:bg-neutral-900 border-blue-200 dark:border-neutral-800"
                autoFocus
              />
              {adminErr && <p className="text-xs font-black text-rose-600 dark:text-rose-400">{adminErr}</p>}
              <div className="relative flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setShowAdminLogin(false); setAdminErr(''); }}>Anuluj</Button>
                <Button variant="primary" size="sm" onClick={handleAdminLogin} disabled={adminLoading} className="min-w-[96px]">{adminLoading ? 'Sprawdzam…' : 'Zaloguj'}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
// ============================================================================
// Auth Modal — Supabase Google + Email
// ============================================================================
const AuthModal = ({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const handleGoogle = async () => {
    setErr(''); setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) { setErr(error.message); setLoading(false) }
    // redirect nastąpi — nie trzeba zamykać
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setMsg(''); setLoading(true)
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Sprawdź email — wysłaliśmy link potwierdzający. Potem zaloguj się.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onSuccess?.(); onClose()
      }
    } catch (e: any) {
      setErr(e.message || 'Błąd logowania')
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, scale: 0.97, opacity: 0 }} transition={springTransition} className="relative w-full max-w-[460px] rounded-3xl border bg-white dark:bg-neutral-950 border-blue-100 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Nagłówek z gradientem */}
        <div className="relative px-8 pt-8 pb-6 text-center bg-gradient-to-b from-blue-50 to-transparent dark:from-neutral-900 dark:to-transparent">
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl grid place-items-center hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"><X size={16} /></button>
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white dark:bg-white dark:text-black grid place-items-center mx-auto mb-4 shadow-lg shadow-blue-600/25 dark:shadow-white/10">
            <Zap size={26} className="fill-current" />
          </div>
          <h3 className="text-xl font-black tracking-tight">{mode === 'login' ? 'Zaloguj się do SiteMorph' : 'Załóż konto SiteMorph'}</h3>
          <p className="text-xs font-semibold opacity-60 mt-1">Twoje leady i strony będą przypisane do konta</p>
        </div>

        <div className="px-8 pb-8 space-y-5">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 font-black text-[15px] hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 015.48 12c0-.73.13-1.43.36-2.09V7.07H2.18A11 11 0 001 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Kontynuuj przez Google
          </motion.button>

          <div className="flex items-center gap-3 text-[11px] font-bold opacity-40"><span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800"/><span>LUB EMAILEM</span><span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800"/></div>

          <form onSubmit={handleEmail} className="space-y-3.5">
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@firma.pl"
              className="w-full rounded-2xl border px-4 py-3.5 text-[15px] font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800" />
            <input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Hasło (min. 6 znaków)"
              className="w-full rounded-2xl border px-4 py-3.5 text-[15px] font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800" />
            {err && <p className="text-[13px] font-bold text-rose-600">{err}</p>}
            {msg && <p className="text-[13px] font-bold text-emerald-600">{msg}</p>}
            <motion.button whileTap={{ scale: 0.99 }} type="submit" disabled={loading}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white dark:bg-white dark:text-black font-black text-[15px] disabled:opacity-50 shadow-lg shadow-blue-600/25 dark:shadow-white/10">
              {loading ? 'Chwilka…' : mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
            </motion.button>
          </form>

          <p className="text-center text-sm font-semibold opacity-70">
            {mode === 'login' ? 'Nie masz jeszcze konta? ' : 'Masz już konto? '}
            <button onClick={()=>{setMode(mode==='login'?'register':'login'); setErr(''); setMsg('')}} className="font-black underline underline-offset-2">{mode === 'login' ? 'Zarejestruj się' : 'Zaloguj się'}</button>
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ============================================================================
export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('sitemorph-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [prefilledPrompt, setPrefilledPrompt] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [credits, setCredits] = useState(() => {
    try { return parseInt(localStorage.getItem('sitemorph-credits') || '25', 10); } catch { return 25; }
  });
  const [session, setSession] = useState<any>(null)
  const [showAuth, setShowAuth] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sitemorph-theme', theme);
    } catch {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem('sitemorph-credits', String(credits)); } catch {}
  }, [credits]);

  const handleEnterApp = (tab = 'dashboard') => {
    setActiveTab(tab);
    setCurrentView('app');
  };

  const handleLaunchBuilderWithPrompt = (prompt: string) => {
    setPrefilledPrompt(prompt);
    setActiveTab('builder');
    setCurrentView('app');
  };

  if (!showSplash && currentView === 'app' && activeTab === 'builder') {
    return (
      <>
        <GlobalStyles />
        <CookieBanner />
        <BuilderFullView
          theme={theme}
          initialPrompt={prefilledPrompt}
          onBack={() => setActiveTab('dashboard')}
          credits={credits}
          setCredits={setCredits}
        />
        <CookieBanner />
        <FloatingChat chatOpen={chatOpen} setChatOpen={setChatOpen} />
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen key="splash" onComplete={() => setShowSplash(false)} theme={theme} />
        ) : currentView === 'landing' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <PublicLandingView
              onEnterApp={handleEnterApp}
              theme={theme}
              setTheme={setTheme}
              session={session}
              onShowAuth={() => setShowAuth(true)}
              onLogout={async () => { await supabase.auth.signOut(); setSession(null) }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="app-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen flex bg-white dark:bg-black text-blue-600 dark:text-white transition-colors"
          >
            <MobileNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onExit={() => setCurrentView('landing')}
              theme={theme}
              setTheme={setTheme}
              credits={credits}
            />
            <DashboardSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onExit={() => setCurrentView('landing')}
              theme={theme}
              setTheme={setTheme}
              credits={credits}
            />

            <main className="flex-1 h-screen overflow-y-auto no-scrollbar relative z-10 pt-14 lg:pt-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={springTransition}
                  className="h-full"
                >
                  {activeTab === 'dashboard' && (
                    <DashboardMainView
                      setActiveTab={setActiveTab}
                      theme={theme}
                      onLaunchBuilderWithPrompt={handleLaunchBuilderWithPrompt}
                    />
                  )}
                  {activeTab === 'leadfinder' && (
                    <LeadFinderView
                      theme={theme}
                      onGenerateSiteForLead={(lead, opts) => {
                        const extra: string[] = [];
                        const anyLead = lead as any;
                        const ind = (lead as any).industry || (lead as any).category || 'usługi';
                        const cityName = (lead as any).city || (lead as any).location || '';
                        const countryName = (lead as any).country || '';
                        if (anyLead.address && anyLead.address !== '—') extra.push(`Adres: ${anyLead.address}.`);
                        if (lead.phone && lead.phone !== '—' && (lead.phone as string).trim() !== '') extra.push(`Telefon: ${lead.phone}.`);
                        if (anyLead.openingHours) extra.push(`Godziny otwarcia: ${anyLead.openingHours}.`);
                        if (anyLead.rating) extra.push(`Ocena Google: ${anyLead.rating} (${anyLead.userRatingsTotal} opinii).`);
                        if (anyLead.website) extra.push(`Strona: ${anyLead.website}.`);
                        const loc = [cityName, countryName].filter(Boolean).join(', ');
                        const base = `Stwórz premium stronę Vite+React+Tailwind dla firmy "${lead.name}" (${ind}) w ${loc || 'Polska'}. ${extra.join(' ')} Zadbaj o sekcje: Hero, Oferta, Cennik, Galeria, Opinie, Kontakt z mapą. Branża: ${ind}. Kolory: limonkowy #bef264 + neutralny. Styl: nowoczesny, premium, impeccable.`;
                        const withImages = opts?.withImages ? ' Użyj zdjęć AI wygenerowanych oraz znajdź podobne w przeglądarce i wstaw je do galerii.' : '';
                        handleLaunchBuilderWithPrompt(base + withImages);
                      }}
                    />
                  )}
                  {activeTab === 'pricing' && <StandalonePricingView />}
                  {activeTab === 'finance' && <FinanceSection />}
                  {activeTab === 'tutorials' && <TutorialsView />}
                  {activeTab === 'help' && <HelpView credits={credits} setCredits={setCredits} />}
                  {['domains', 'settings'].includes(activeTab) && (
                    <div className="max-w-2xl mx-auto py-24 text-center space-y-4">
                      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-lg bg-blue-600 text-white dark:bg-white dark:text-black font-black">
                        <Sparkles size={32} />
                      </div>
                      <h2 className="text-2xl font-black capitalize">
                        Sekcja: {activeTab === 'domains' ? 'Domeny' : 'Ustawienia'}
                      </h2>
                      <p className="text-xs font-bold max-w-sm mx-auto opacity-80">
                        Wdrożenie w toku. Kliknij przycisk poniżej, aby wrócić do pulpitu.
                      </p>
                      <Button variant="primary" size="sm" onClick={() => setActiveTab('dashboard')} className="shadow-md font-black">
                        Wróć do Pulpitu
                      </Button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            <CookieBanner />
        <FloatingChat chatOpen={chatOpen} setChatOpen={setChatOpen} />
          </motion.div>
        )}
      </AnimatePresence>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
    </>
  );
}

// ============================================================================
// 16. PŁYWAJĄCY CZAT
// ============================================================================
const FloatingChat = ({
  chatOpen,
  setChatOpen
}: {
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
}) => (
  <div className="fixed bottom-6 right-6 z-50">
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={springTransition}
          className="rounded-3xl shadow-2xl border w-80 p-4 mb-3 bg-white dark:bg-black border-blue-200 dark:border-neutral-900 text-blue-600 dark:text-white"
        >
          <div className="flex justify-between items-center border-b border-blue-100 dark:border-neutral-900 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-black text-xs">Wsparcie SiteMorph</span>
            </div>
            <motion.button 
              whileHover={{ scale: 1.15 }}
              onClick={() => setChatOpen(false)} 
              className="hover:text-emerald-400 cursor-pointer bg-transparent border-none text-inherit"
            >
              <X size={14} />
            </motion.button>
          </div>
          <div className="text-xs p-3 rounded-xl mb-3 border font-bold bg-blue-50/50 dark:bg-neutral-950 border-blue-100 dark:border-neutral-900">
            Cześć! W czym możemy Ci dzisiaj pomóc?
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Wpisz wiadomość..."
              className="flex-1 rounded-lg px-3 py-1.5 text-xs font-bold outline-none border text-blue-600 dark:text-white placeholder:text-blue-400 dark:placeholder:text-neutral-500 bg-blue-50/40 dark:bg-neutral-950 border-blue-200 dark:border-neutral-800"
            />
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="bg-blue-600 text-white dark:bg-white dark:text-black p-1.5 rounded-lg cursor-pointer border-none shadow-sm font-black"
            >
              <Send size={14} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    <motion.button
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.9 }}
      transition={springTransition}
      onClick={() => setChatOpen(!chatOpen)}
      className="w-12 h-12 rounded-full flex items-center justify-center font-black shadow-2xl cursor-pointer border-none bg-blue-600 text-white dark:bg-white dark:text-black"
    >
      <MessageSquare size={20} />
    </motion.button>
  </div>
);
