import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  Play,
  LayoutDashboard,
  CheckCircle2,
  Globe,
  Send,
  RefreshCw,
  Zap,
  Search,
  MapPin,
  Briefcase,
  X,
  Receipt,
  Wallet,
  Code as CodeIcon,
} from 'lucide-react';
import { Button, Badge } from '../components/ui';
import { cineChild, cineParent, cineSoft, springTransition } from '../lib/shared';
import { Lead } from '../types';

export const LANDING_HOW_STEPS = [
  {
    num: '01',
    title: 'Opisz pomysł jednym zdaniem',
    desc: 'Napisz, dla kogo jest strona. Jedno zdanie wystarczy — resztę dopracuje SiteMorph.',
    mockup: (
      <div className="w-full max-w-[250px] rounded-2xl border p-4 shadow-lg text-left bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
        <p className="text-xs font-bold mb-3">Stwórz stronę dla barbera z rezerwacją</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="text-[9px] font-black px-2 py-1 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black">Generuj</span>
            <span className="text-[9px] font-black px-2 py-1 rounded-full bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800">Styl</span>
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
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-white dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800 shadow-sm whitespace-nowrap">
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
      <div className="w-full max-w-[260px] rounded-2xl border p-4 shadow-lg text-left space-y-2.5 bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
        <div className="text-[10px] font-black uppercase tracking-wider opacity-70">Wiadomość do klienta</div>
        <div className="rounded-xl p-3 text-[10px] font-semibold leading-relaxed bg-[#F7F6F3]/70 dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800">
          „Cześć Anna! Przygotowałem darmowy projekt strony dla Studio Anna — zobacz: studio-anna.sitemorph.pl”
        </div>
        <div className="flex gap-1.5">
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black">E-mail</span>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800">SMS</span>
        </div>
      </div>
    )
  }
];

export const LANDING_FEATURE_TABS: Array<{ label: string; icon: any; title: string; desc: string; statBig: string; statSmall: string }> = [
  { label: 'Podgląd na żywo', icon: Globe, title: 'Pokaż postęp bez wysyłania plików', desc: 'Generujesz prywatny link. Klient ogląda każdą poprawkę na żywo — bez konta i bez załączników w mailu.', statBig: 'Na żywo', statSmall: 'podgląd dla klienta' },
  { label: 'Poprawki bez limitu', icon: RefreshCw, title: 'Dopracuj projekt do perfekcji', desc: 'Zmieniasz teksty, kolory i sekcje tak długo, jak trzeba. Historia wersji bez limitu i bez dopłat.', statBig: '∞ wersji', statSmall: 'bez dopłat' },
  { label: 'Projekt z AI', icon: Zap, title: 'Cała strona z jednego pomysłu', desc: 'AI dobiera układ, paletę i treści pod branżę klienta. Ty tylko zatwierdzasz efekt.', statBig: '2 min', statSmall: 'od pomysłu do projektu' },
  { label: 'Bez prowizji', icon: Wallet, title: 'Ty ustalasz stawkę', desc: 'Wyceniaj od 1 500 do 12 000 zł. Pieniądze trafiają bezpośrednio do Ciebie — 0% prowizji.', statBig: '0%', statSmall: 'prowizji od zleceń' }
];

// ----------------------------------------------------------------------------
// Panel administratora – hasło weryfikowane TYLKO po stronie backendu.
// Frontend wysyła SHA-256, backend porównuje z ADMIN_HASH (env). Brak hasła/hasha w kodzie.
// ----------------------------------------------------------------------------
export const LEGAL_DOCS: Record<'regulamin' | 'prywatnosc' | 'cookies', { title: string; updated: string; sections: Array<{ h: string; p: string }> }> = {
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
  const [activeFeature, setActiveFeature] = useState(0);
  const [legalDoc, setLegalDoc] = useState<null | 'regulamin' | 'prywatnosc' | 'cookies'>(null);

  const scrollToId = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="min-h-screen bg-white dark:bg-black text-[#111111] dark:text-white transition-colors overflow-x-hidden landing-scale">
      <div className="h-2" />
      {/* Hero Section — NOWY UKŁAD: centralny nagłówek + mockup poniżej, nie 1:1 */}
      <section className="max-w-6xl mx-auto px-6 pt-10 lg:pt-16 pb-12 lg:pb-16 space-y-10">
        <motion.div 
          initial={{ opacity: 0, y: 30, filter: 'blur(16px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring' as const, stiffness: 90, damping: 18, delay: 0.05 }}
          className="text-center space-y-6 max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold text-[#111111] dark:text-white bg-[#F7F6F3] dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800 shadow-sm">
            <Zap size={13} className="fill-current text-[#111111] dark:text-white" /> 
            <span>Zamień AI w stały zysk — bez kodowania</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95] text-[#111111] dark:text-white">
            Buduj strony.<br />
            <span className="inline-block" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, color: '#a3e635', letterSpacing: '-0.04em' }}>
              Zarabiaj.
            </span>
            <span className="inline-block w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-[#111111] dark:bg-white ml-1 align-super animate-pulse" />
          </h1>
          <p className="text-[#111111] dark:text-white text-sm sm:text-base font-semibold leading-relaxed max-w-xl mx-auto opacity-80">
            Jedno zdanie → gotowa strona dla lokalnej firmy. Wyceniaj od 1 500 do 12 000 zł. Preview, poprawki i faktura w jednym miejscu.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button variant="primary" size="lg" onClick={() => onEnterApp('dashboard')} className="font-black shadow-lg">
              Zacznij zarabiać <ArrowRight size={16} />
            </Button>
            <Button variant="outline" size="lg" onClick={() => onEnterApp('pricing')} className="font-black">
              <Play size={15} className="fill-current" /> Zobacz 90s demo
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold opacity-60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 2 847 stron zbudowanych w tym miesiącu
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 40, scale: 0.98, filter: 'blur(18px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ type: 'spring' as const, stiffness: 80, damping: 18, delay: 0.18 }}
          className="relative max-w-5xl mx-auto"
          style={{ perspective: 1400 }}
        >
          <div className="pointer-events-none absolute -inset-12 -z-10 morph-blob bg-gradient-to-tr from-lime-200 via-emerald-100 to-blue-100 dark:from-lime-500/15 dark:via-emerald-400/10 dark:to-blue-500/10 blur-3xl opacity-60" />
          <div className="rounded-[28px] p-4 sm:p-5 border shadow-2xl bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-900">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold">
                <span className="px-3 py-1 rounded-full bg-[#F7F6F3] dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">fryzjer-studio.pl — podgląd LIVE</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-[10px] font-bold opacity-60 hidden sm:block">2 online</div>
            </div>
            <div className="grid grid-cols-12 gap-4 pt-4">
              <div className="col-span-12 lg:col-span-5 space-y-4">
                <div className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300">Otwarte codziennie • Kraków</div>
                <h3 className="text-3xl font-black leading-tight">
                  Zmień styl.<br />Poczuj się pewnie.
                </h3>
                <p className="text-sm font-semibold opacity-70 leading-relaxed">Studio Anna — strzyżenie, broda, modelowanie. Rezerwacja online, kawa na miejscu.</p>
                <div className="flex gap-2">
                  <span className="bg-[#111111] text-white dark:bg-white dark:text-black text-xs font-bold px-4 py-2 rounded-full shadow-md">Umów termin</span>
                  <span className="border border-neutral-200 dark:border-neutral-800 text-xs font-bold px-4 py-2 rounded-full">Zobacz cennik</span>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-lime-300 to-emerald-400 border-2 border-white dark:border-neutral-950" />
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-white dark:border-neutral-950" />
                    <div className="w-7 h-7 rounded-full bg-neutral-900 text-white border-2 border-white dark:border-neutral-950 grid place-items-center text-[10px] font-black">+2k</div>
                  </div>
                  <span className="text-xs font-bold opacity-70">Zaufało nam 2 847 klientów</span>
                </div>
              </div>
              <div className="col-span-12 lg:col-span-7 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-28 rounded-2xl bg-gradient-to-br from-lime-200 to-emerald-300 shadow-sm border border-white dark:border-neutral-800" />
                  <div className="h-28 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-200 shadow-sm border border-white dark:border-neutral-800" />
                  <div className="h-28 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-300 shadow-sm border border-white dark:border-neutral-800 relative">
                    <div className="absolute bottom-2 right-2 bg-black text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1">● LIVE</div>
                  </div>
                </div>
                <div className="rounded-2xl border p-3 bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#111111] text-white grid place-items-center"><Wallet size={14} /></div>
                    <div><div className="text-xs font-black">9 600 zł w tym tygodniu</div><div className="text-[10px] opacity-60 font-bold">Zbudowano w 2m 45s • AI</div></div>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">+18%</span>
                </div>
              </div>
            </div>
          </div>
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity }} className="hidden lg:flex absolute -right-6 top-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-3 rounded-2xl shadow-xl items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#111111] text-white grid place-items-center"><Zap size={14} className="fill-current" /></div>
            <div><div className="text-xs font-black">Gotowe w 2m 45s</div><div className="text-[10px] opacity-60">Napędzane przez Laguna S-2.1</div></div>
          </motion.div>
        </motion.div>
      </section>

      {/* Ticker */}
      <div className="border-y py-3.5 overflow-hidden relative bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-10 text-[11px] font-bold text-[#111111] dark:text-white tracking-wide">
          {[
            'Bez kodowania', 'Strona w 5 minut', 'Powtarzalny przychód', '1500–12 000 zł za stronę', 'Natychmiastowy deploy',
            'Linki podglądu', 'Nielimitowane poprawki', 'Akceptacja klienta', 'Powered by SiteMorph AI', 'Bez kodowania', 'Strona w 5 minut',
            'Bez kodowania', 'Strona w 5 minut', 'Powtarzalny przychód', '1500–12 000 zł za stronę', 'Natychmiastowy deploy',
            'Linki podglądu', 'Nielimitowane poprawki', 'Akceptacja klienta', 'Powered by SiteMorph AI', 'Bez kodowania', 'Strona w 5 minut'
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#111111] dark:bg-white opacity-80" />
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
          <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[11px] font-black tracking-widest uppercase bg-[#F7F6F3] dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800">
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
              className="rounded-3xl border overflow-hidden flex flex-col bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-800 shadow-sm hover:shadow-xl transition-shadow"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="h-60 flex items-center justify-center px-6 border-b bg-gradient-to-b from-blue-50/50 to-transparent dark:from-neutral-950/60 dark:to-transparent border-[#EAEAEA] dark:border-neutral-900">{s.mockup}</div>
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
          <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[11px] font-black tracking-widest uppercase bg-[#F7F6F3] dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800">
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
                className={`px-5 py-2 rounded-full text-xs font-black border transition-colors cursor-pointer ${isActive ? 'bg-[#111111] dark:bg-white text-white dark:text-black border-transparent shadow-md' : 'bg-transparent border-[#EAEAEA] dark:border-neutral-800 hover:border-emerald-400'}`}
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
            transition={{ type: 'spring' as const, stiffness: 140, damping: 20 }}
            className="rounded-[28px] border p-8 lg:p-10 grid lg:grid-cols-2 gap-10 bg-[#F7F6F3]/40 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-900 shadow-xl"
            style={{ perspective: 1200 }}
          >
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#111111] dark:bg-white text-white dark:text-black shadow-md">
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

            <div className="rounded-2xl border p-6 bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-800 shadow-sm min-h-[340px] flex items-center justify-center">
              {activeFeature === 0 && (
                <div className="w-full space-y-3">
                  <div className="rounded-2xl border p-4 space-y-3 bg-[#F7F6F3]/40 dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800">
                    <div className="text-[9px] font-black uppercase tracking-wider opacity-70 flex items-center gap-1.5" style={{ fontFamily: "'SF Pro Display', sans-serif" }}><Globe size={10} /> Udostępnij podgląd</div>
                    <div className="flex items-center justify-between gap-2 rounded-full border px-3.5 py-1.5 bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-800">
                      <span className="text-[10px] font-mono truncate">podglad.sitemorph.pl/morph-8421</span>
                      <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black shrink-0">Kopiuj</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-bold">
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Podgląd otwarty</span>
                      <span className="opacity-60">przed chwilą</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-2xl border p-3 bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
                    <div className="w-7 h-7 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px] font-black shrink-0">AK</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black">„Wygląda świetnie, lecimy!”</div>
                    </div>
                    <span className="text-[9px] font-bold opacity-60 shrink-0">teraz</span>
                  </div>
                </div>
              )}
              {activeFeature === 1 && (
                <div className="w-full space-y-3 text-xs">
                  <div className="rounded-2xl border p-3 flex items-center justify-between bg-[#F7F6F3]/60 dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800">
                    <span className="font-bold">Zmień kolor przycisku na limonkowy</span>
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  </div>
                  <div className="text-[10px] font-black opacity-60 text-center">✓ Gotowe — 9 s</div>
                  <div className="rounded-2xl border p-3 flex items-center justify-between bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
                    <span className="font-bold">Przyciemnij tło galerii</span>
                    <RefreshCw size={14} className="animate-spin opacity-60" />
                  </div>
                </div>
              )}
              {activeFeature === 2 && (
                <div className="w-full space-y-3">
                  <div className="rounded-xl border px-3 py-2.5 flex items-center gap-2 bg-[#F7F6F3]/60 dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800">
                    <Sparkles size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-xs font-bold truncate">Stwórz stronę dla studia jogi w stylu boho</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-16 rounded-xl bg-gradient-to-br from-blue-600/20 to-emerald-400/20 border border-[#EAEAEA] dark:border-neutral-800 flex items-center justify-center">
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
                    <div key={r.name} className="flex items-center justify-between rounded-xl border p-3 bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
                      <span className="text-xs font-bold truncate pr-3">{r.name}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${r.status === 'Opłacona' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>{r.amount}</span>
                    </div>
                  ))}
                  <div className="rounded-xl p-3 flex items-center justify-between bg-[#111111] dark:bg-white text-white dark:text-black">
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800 text-[11px] font-black tracking-widest uppercase w-fit">
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
          transition={{ type: 'spring' as const, stiffness: 85, damping: 18 }}
          style={{ perspective: 1200 }}
          className="lg:col-span-7 rounded-[28px] border p-6 space-y-4 bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-800 shadow-2xl shadow-blue-600/5 dark:shadow-black/40"
        >
          <div className="flex gap-2">
            <div className="flex-1 rounded-2xl border p-3 bg-[#F7F6F3]/40 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
              <div className="text-[9px] font-black uppercase tracking-wider opacity-60 flex items-center gap-1"><Briefcase size={10} /> Branża</div>
              <div className="text-xs font-black mt-0.5">Gastronomia</div>
            </div>
            <div className="flex-1 rounded-2xl border p-3 bg-[#F7F6F3]/40 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
              <div className="text-[9px] font-black uppercase tracking-wider opacity-60 flex items-center gap-1"><MapPin size={10} /> Lokalizacja</div>
              <div className="text-xs font-black mt-0.5">Poznań</div>
            </div>
            <button className="w-12 h-12 rounded-2xl bg-[#111111] dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-xs shadow-md shrink-0 self-center">
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
              <div key={f.name} className="rounded-2xl border p-3.5 space-y-2.5 bg-[#F7F6F3]/30 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black grid place-items-center text-[10px] font-black">{f.ini}</div>
                  <div className="min-w-0">
                    <div className="text-xs font-black leading-none truncate">{f.name}</div>
                    <div className="text-[10px] font-bold opacity-60">{f.score} ★</div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-full bg-white dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800 px-2.5 py-1">
                  <span className="text-[10px] font-black">Brak strony</span>
                  <span className="text-[10px]">↗</span>
                </div>
                <div className="text-[10px] font-mono opacity-70">+48 {f.phone}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] font-black">
            <span className="opacity-80">41 wyników · 24 bez strony</span>
            <span className="px-2.5 py-1 rounded-full border bg-white dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800">⬇ CSV</span>
          </div>
        </motion.div>
      </section>

      {/* SEKCJA: ROZLICZENIA */}
      <section id="rozliczenia" className="max-w-7xl mx-auto px-6 lg:px-8 py-14 lg:py-20 grid lg:grid-cols-12 gap-10 items-center scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, x: -80, rotateY: -14, filter: 'blur(16px)' }}
          whileInView={{ opacity: 1, x: 0, rotateY: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ type: 'spring' as const, stiffness: 85, damping: 18 }}
          style={{ perspective: 1200 }}
          className="lg:col-span-6 order-2 lg:order-1 rounded-[28px] border p-6 space-y-4 bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-800 shadow-2xl shadow-blue-600/5"
        >
          <div className="flex items-center justify-between border-b border-[#EAEAEA] dark:border-neutral-900 pb-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Opłacona</span>
            <span className="text-[10px] font-mono opacity-60">FV 0042/2026</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-wider opacity-60">Od</div>
              <div className="text-sm font-black">Morph Studio</div>
              <div className="text-[10px] font-bold opacity-60">hello@morph.studio</div>
            </div>
            <div className="text-right rounded-xl px-3 py-2 bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800">
              <div className="text-[9px] font-black uppercase tracking-wider opacity-60">Razem</div>
              <div className="text-base font-black">1 830 zł</div>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between rounded-xl px-3 py-2.5 bg-[#F7F6F3]/60 dark:bg-neutral-950 border border-[#EAEAEA] dark:border-neutral-900"><span className="font-bold">Projekt i wdrożenie strony</span><span className="font-black">1 450 zł</span></div>
            <div className="flex justify-between rounded-xl px-3 py-2.5 bg-[#F7F6F3]/40 dark:bg-neutral-950 border border-[#EAEAEA] dark:border-neutral-900"><span className="font-bold">Copywriting + zdjęcia</span><span className="font-black">380 zł</span></div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 rounded-full py-2.5 text-xs font-black flex items-center justify-center gap-1.5 bg-[#111111] dark:bg-white text-white dark:text-black shadow-md"><Send size={13} /> Wyślij</button>
            <button className="px-5 rounded-full py-2.5 text-xs font-black border bg-white dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800">PDF</button>
          </div>
        </motion.div>

        <motion.div
          variants={cineSoft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="lg:col-span-6 order-1 lg:order-2 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800 text-[11px] font-black tracking-widest uppercase w-fit">
            <Receipt size={12} /> Rozliczenia
          </div>
          <h2 className="text-5xl sm:text-6xl font-black tracking-tighter leading-[0.95]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Strona gotowa.<br />Czas na przelew<span className="text-gradient-lime-soft">.</span>
          </h2>
          <p className="text-sm font-bold leading-relaxed opacity-80 max-w-md" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            Wbudowane faktury bez prowizji. Wystawiasz dokument, wysyłasz PDF i pilnujesz płatności — wszystko w jednym miejscu.
          </p>
          <div className="grid grid-cols-3 gap-6 pt-2 border-t border-[#EAEAEA] dark:border-neutral-900">
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
          transition={{ type: 'spring' as const, stiffness: 95, damping: 19 }}
          className="relative rounded-[28px] border p-10 sm:p-12 text-center space-y-5 bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-800 shadow-xl overflow-hidden"
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

      <footer className="border-t border-[#EAEAEA] dark:border-neutral-900 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-bold" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
          <div className="flex items-center gap-2 opacity-60">
            <span className="w-7 h-7 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black grid place-items-center font-black"><Zap size={12} className="fill-current" /></span>
            <span>© {new Date().getFullYear()} SiteMorph · Stworzone dla lokalnych firm.</span>
          </div>
          <div className="flex gap-1">
            {[
              ['Regulamin', '/regulamin'],
              ['Prywatność', '/prywatnosc'],
              ['Cookies', '/cookies']
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-full border border-transparent hover:border-[#EAEAEA] dark:hover:border-neutral-800 hover:bg-[#F7F6F3] dark:hover:bg-neutral-900 transition-colors cursor-pointer text-xs font-bold"
              >
                {label}
              </a>
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
              transition={{ type: 'spring' as const, stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[86vh] overflow-hidden rounded-3xl bg-white dark:bg-neutral-950 border border-[#EAEAEA] dark:border-neutral-800 shadow-2xl flex flex-col"
            >
              {/* morphing tło */}
              <div className="pointer-events-none absolute -top-24 -right-24 w-[340px] h-[340px] bg-gradient-to-tr from-lime-200 via-emerald-200 to-lime-100 opacity-30 blur-2xl legal-blob" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 w-[280px] h-[280px] bg-gradient-to-tr from-blue-100 via-sky-100 to-lime-100 opacity-25 blur-2xl legal-blob" style={{ animationDelay: '1.2s' }} />

              <div className="relative flex items-center justify-between p-6 border-b border-[#EAEAEA] dark:border-neutral-900 bg-white/80 dark:bg-neutral-950/80 backdrop-blur sticky top-0">
                <div>
                  <h3 className="text-lg font-black tracking-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{LEGAL_DOCS[legalDoc].title}</h3>
                  <p className="text-[10px] font-bold opacity-60 mt-0.5" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>{LEGAL_DOCS[legalDoc].updated}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.08, rotate: 90 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setLegalDoc(null)}
                  className="w-8 h-8 rounded-full grid place-items-center bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800 cursor-pointer"
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
