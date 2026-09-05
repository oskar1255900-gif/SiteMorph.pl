import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  Globe,
  Search,
  MapPin,
  Briefcase,
  X,
  Receipt,
  Wallet,
  Layers,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Paperclip,
  Menu,
  Star,
  Inbox,
  Send as SendIcon,
  FileEdit,
  Archive,
  UtensilsCrossed,
  Scissors,
  Wrench,
  Dumbbell,
  Flower2,
  Store,
  Check,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cineChild, cineParent, cineSoft, springTransition } from '../lib/shared';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4';

// ============================================================================
// EKSPORTOWANE STAŁE (używane też przez inne widoki)
// ============================================================================
export const LANDING_HOW_STEPS = [
  {
    num: '01',
    title: 'Opisz pomysł jednym zdaniem',
    desc: 'Napisz, dla kogo jest strona. Jedno zdanie wystarczy — resztę dopracuje SiteMorph.',
  },
  {
    num: '02',
    title: 'Poprawiaj bez ograniczeń',
    desc: 'Kliknij w sekcję albo napisz „rozjaśnij tło". Każda zmiana pojawia się od razu.',
  },
  {
    num: '03',
    title: 'Wyślij ofertę, która sprzedaje',
    desc: 'Gotowa wiadomość z linkiem do projektu. Klient ogląda stronę — Ty zbierasz przelew.',
  },
];

export const LANDING_FEATURE_TABS: Array<{ label: string; icon: any; title: string; desc: string; statBig: string; statSmall: string }> = [
  { label: 'Podgląd na żywo', icon: Globe, title: 'Pokaż postęp bez wysyłania plików', desc: 'Generujesz prywatny link. Klient ogląda każdą poprawkę na żywo — bez konta i bez załączników.', statBig: 'Na żywo', statSmall: 'podgląd dla klienta' },
  { label: 'Poprawki bez limitu', icon: RefreshCw, title: 'Dopracuj projekt do perfekcji', desc: 'Zmieniasz teksty, kolory i sekcje tak długo, jak trzeba. Historia wersji bez limitu i bez dopłat.', statBig: '∞ wersji', statSmall: 'bez dopłat' },
  { label: 'Projekt z AI', icon: Sparkles, title: 'Cała strona z jednego pomysłu', desc: 'AI dobiera układ, paletę i treści pod branżę klienta. Ty tylko zatwierdzasz efekt.', statBig: '2 min', statSmall: 'od pomysłu do projektu' },
  { label: 'Bez prowizji', icon: Wallet, title: 'Ty ustalasz stawkę', desc: 'Wyceniaj od 1 500 do 12 000 zł. Pieniądze trafiają bezpośrednio do Ciebie — 0% prowizji.', statBig: '0%', statSmall: 'prowizji od zleceń' },
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
// GLASS + KINEtyka CSS (scoped: .sm-landing)
// ============================================================================
const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
.sm-landing {
  --bg: #0c0c0c; --text: #ffffff; --muted: rgba(255,255,255,0.6);
  --accent-cyan: #00d2ff; --accent-deep: #0B2551; --accent-pale: #A4F4FD;
  --accent-pink: #b04090; --accent-lilac: #c8a0e0;
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  background: var(--bg); color: var(--text);
}
.sm-landing ::selection { background: rgba(0,210,255,0.3); }

/* ---------- shiny gradient headline ---------- */
@keyframes sm-shiny { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
.sm-animate-shiny { animation: sm-shiny 6s linear infinite; }
.sm-gradient-text {
  background-image: linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%);
  background-size: 200% auto;
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
  filter: url(#sm-noise);
}

/* ---------- liquid glass ---------- */
.sm-liquid-glass {
  background: rgba(255,255,255,0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
  position: relative; overflow: hidden;
}
.sm-liquid-glass::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none;
}

/* ---------- XERO HERO CARD z różowym łukiem ---------- */
.sm-hero-card {
  width: 100%; max-width: 1600px;
  border-radius: 20px; border: 1px solid rgba(255,255,255,0.07);
  overflow: hidden; position: relative;
  background: rgba(13,11,18,0.86);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  padding: 80px 40px 70px; min-height: 640px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.sm-hero-card::before {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(circle at 50% -70%,
      transparent 60%,
      rgba(176,48,136,0.03) 63%, rgba(176,48,136,0.08) 65%, rgba(176,48,136,0.16) 67%,
      rgba(176,48,136,0.28) 69%, rgba(176,48,136,0.40) 71%, rgba(176,48,136,0.52) 73%,
      rgba(176,48,136,0.64) 75%, rgba(176,48,136,0.74) 77%, rgba(176,48,136,0.82) 79%,
      rgba(210,70,175,0.92) 85%, rgba(240,110,210,0.88) 87%,
      rgba(255,205,250,0.92) 91%, rgba(255,240,255,0.98) 93%, #ffffff 95%),
    radial-gradient(circle at 50% 35%, rgba(120,40,180,0.08) 0%, transparent 50%);
}
.sm-hero-grid {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: radial-gradient(circle at 50% -70%, transparent 60%, black 78%);
  mask-image: radial-gradient(circle at 50% -70%, transparent 60%, black 78%);
}

/* ---------- ICON PIPELINE ---------- */
.sm-pipeline { position: relative; display: flex; align-items: center; justify-content: center; max-width: 700px; margin-bottom: 52px; z-index: 1; }
.sm-beam-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; z-index: 2; pointer-events: none; }
.sm-pipeline-line { width: 160px; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.07)); }
.sm-pipeline-line.right { background: linear-gradient(90deg, rgba(255,255,255,0.07), rgba(255,255,255,0.15)); }
.sm-node {
  width: 46px; height: 46px; border-radius: 50%; background: #1a1a24;
  display: flex; align-items: center; justify-content: center;
  cursor: default; z-index: 3; position: relative;
  box-shadow: 6px 6px 12px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.03),
    inset 1px 1px 1px rgba(255,255,255,0.05), inset 4px 4px 8px rgba(0,0,0,0.4);
  transition: transform .2s ease, box-shadow .2s ease;
}
.sm-node::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 1px dotted #1a1a24; }
.sm-node:hover { transform: translateY(-1px); }
.sm-node svg { width: 20px; height: 20px; stroke: rgba(255,255,255,0.7); stroke-width: 1.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.sm-node-center {
  width: 64px; height: 64px; border-radius: 50%; background: #1e1e2c;
  display: flex; align-items: center; justify-content: center; z-index: 3; position: relative;
  box-shadow: 8px 8px 16px rgba(0,0,0,0.5), -6px -6px 14px rgba(255,255,255,0.04),
    inset 1px 1px 2px rgba(255,255,255,0.06), inset 6px 6px 12px rgba(0,0,0,0.5);
}
.sm-node-center svg { width: 28px; height: 28px; fill: #fff; }
.sm-splash {
  width: 100px; height: 100px; border-radius: 50%;
  position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%) scale(0.4);
  background: radial-gradient(circle, rgba(255,77,200,0.6) 0%, transparent 70%);
  opacity: 0; z-index: 2; pointer-events: none;
}
@keyframes sm-splash-anim {
  0% { transform: translate(-50%,-50%) scale(0.4); opacity: 0.8; }
  40% { opacity: 0.6; }
  100% { transform: translate(-50%,-50%) scale(1.4); opacity: 0; }
}
.sm-splash.animate { animation: sm-splash-anim 0.8s ease-out forwards; }
.sm-node-light-right::before, .sm-node-light-left::before {
  content: ''; position: absolute; inset: -20px; border-radius: 50%; z-index: 4;
  opacity: 0; transition: opacity .3s ease; pointer-events: none;
}
.sm-node-light-right::before { background: radial-gradient(circle at right, rgba(200,200,200,0.45) 0%, transparent 70%); }
.sm-node-light-left::before { background: radial-gradient(circle at left, rgba(200,100,255,0.5) 0%, transparent 70%); }
.sm-node-light-right.active::before, .sm-node-light-left.active::before { opacity: 1; }

/* ---------- logo mark (SiteMorph quadrant) ---------- */
.sm-logomark { width: 32px; height: 32px; fill: #fff; }

/* ---------- PRICING (c3) ---------- */
.sm-pricing-section { position: relative; padding: 40px 20px 80px; display: flex; flex-direction: column; align-items: center; overflow-x: hidden; }
.sm-watermark-container { position: relative; width: 100%; max-width: 1100px; text-align: center; margin-top: 40px; z-index: 2; }
.sm-watermark-main { font-size: 9rem; font-weight: 800; line-height: 0.9; letter-spacing: -0.05em; filter: url(#sm-noise-pricing); display: flex; flex-direction: column; align-items: center; }
.sm-watermark-line-1 { color: #fff; }
.sm-watermark-line-2 { background: linear-gradient(to right, #091020 0%, #0B2551 25%, #A4F4FD 65%, #00d2ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
.sm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; width: 100%; max-width: 1100px; margin-top: 60px; transform: translateX(20px); position: relative; z-index: 3; }
.sm-card { background: linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0.4)); backdrop-filter: blur(14px) brightness(0.91); -webkit-backdrop-filter: blur(14px) brightness(0.91); border: 1px solid rgba(255,255,255,1); border-radius: 44px; padding: 50px 24px; min-height: 580px; display: flex; flex-direction: column; transition: all 0.6s cubic-bezier(.22,1,.36,1); overflow: hidden; position: relative; }
.sm-card::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%); pointer-events: none; }
.sm-card:hover { background: rgba(15,15,15,0.6); border-color: rgba(34,211,238,0.7); transform: translateY(-12px) scale(1.01); }
.sm-card-pro { background: linear-gradient(135deg, rgba(0,0,0,0.85), rgba(0,0,0,0.55)); }
.sm-tier-small { font-size: 1.1rem; font-weight: 400; color: rgba(255,255,255,0.6); }
.sm-tier-large { font-size: 2.8rem; font-weight: 500; letter-spacing: -0.02em; color: #fff; margin-top: 8px; }
.sm-desc { font-size: 0.88rem; color: rgba(255,255,255,0.45); min-height: 3.2em; margin-top: 16px; margin-bottom: 40px; line-height: 1.5; }
.sm-list { list-style: none; padding: 0; margin: 0; }
.sm-list li { display: flex; align-items: flex-start; gap: 14px; font-size: 0.92rem; color: rgba(255,255,255,0.8); margin-bottom: 18px; line-height: 1.4; }
.sm-check { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.15); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sm-btn { background: #fff; color: #000; padding: 10px 32px; border-radius: 100px; font-weight: 600; font-size: 0.88rem; margin-top: auto; border: none; cursor: pointer; align-self: center; transition: all 0.3s cubic-bezier(.22,1,.36,1); }
.sm-btn:hover { background: #f5f5f5; transform: scale(1.02); box-shadow: 0 8px 24px rgba(255,255,255,0.15); }
.sm-toggle-wrap { display: flex; align-items: center; justify-content: flex-end; gap: 12px; width: 100%; max-width: 1100px; margin-top: 32px; padding-right: 20px; }
.sm-toggle { width: 52px; height: 28px; background: #fff; border-radius: 100px; position: relative; cursor: pointer; border: none; transition: background 0.3s cubic-bezier(.4,0,.2,1); padding: 0; }
.sm-toggle-knob { width: 20px; height: 20px; background: #000; border-radius: 50%; position: absolute; top: 4px; left: 4px; transition: all 0.3s cubic-bezier(.4,0,.2,1); }
.sm-toggle.active { background: rgba(255,255,255,0.2); }
.sm-toggle.active .sm-toggle-knob { transform: translateX(24px); background: #fff; }
@media (max-width: 1024px) {
  .sm-watermark-main { font-size: 3.5rem; filter: none; }
  .sm-watermark-line-2 { background: none; -webkit-text-fill-color: #00d2ff; color: #00d2ff; }
  .sm-grid { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; transform: none; width: 100vw; padding: 0 20px; gap: 16px; scrollbar-width: none; }
  .sm-card { flex: 0 0 320px; scroll-snap-align: center; }
  .sm-grid::-webkit-scrollbar { display: none; }
  .sm-toggle-wrap { justify-content: center; padding-right: 0; }
}

/* ---------- responsive pipeline ---------- */
@media (max-width: 860px) {
  .sm-pipeline { gap: 0; margin-bottom: 40px; }
  .sm-pipeline-line { width: 80px; }
}
@media (max-width: 768px) {
  .sm-hero-card { padding: 60px 20px 60px; min-height: auto; border-radius: 16px; }
  .sm-node { width: 38px; height: 38px; }
  .sm-node-center { width: 52px; height: 52px; }
  .sm-node-center svg { width: 22px; height: 22px; }
}
`;

// ============================================================================
// LOGOMARK — abstrakcyjny znak 4-ćwiartkowy (SiteMorph)
// ============================================================================
const LogoMark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 256 256" className={`sm-logomark ${className}`} fill="currentColor" aria-hidden>
    <path d="M 0 128 C 70.692 128 128 185.308 128 256 L 64 256 C 64 220.654 35.346 192 0 192 Z M 256 192 C 220.654 192 192 220.654 192 256 L 128 256 C 128 185.308 185.308 128 256 128 Z M 128 0 C 128 70.692 70.692 128 0 128 L 0 64 C 35.346 64 64 35.346 64 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z" />
  </svg>
);

const gradientStyle: React.CSSProperties = {
  backgroundImage: 'linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  filter: 'url(#sm-noise)',
};

// ============================================================================
// BEAM PIPELINE — animowana linia energii między węzłami (prompt → SiteMorph → strona)
// ============================================================================
const BeamPipeline = () => {
  const pipelineRef = useRef<HTMLDivElement | null>(null);
  const nodeStackRef = useRef<HTMLDivElement | null>(null);
  const nodeXRef = useRef<HTMLDivElement | null>(null);
  const nodeShieldRef = useRef<HTMLDivElement | null>(null);
  const glowPathRef = useRef<SVGPathElement | null>(null);
  const corePathRef = useRef<SVGPathElement | null>(null);
  const gradientRef = useRef<SVGLinearGradientElement | null>(null);
  const splashRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    const nodeStack = nodeStackRef.current;
    const nodeX = nodeXRef.current;
    const nodeShield = nodeShieldRef.current;
    const glow = glowPathRef.current;
    const core = corePathRef.current;
    const grad = gradientRef.current;
    const splash = splashRef.current;
    if (!pipeline || !nodeStack || !nodeX || !nodeShield || !glow || !core || !grad || !splash) return;

    const drawPath = () => {
      const pRect = pipeline.getBoundingClientRect();
      const sRect = nodeStack.getBoundingClientRect();
      const xRect = nodeX.getBoundingClientRect();
      const shRect = nodeShield.getBoundingClientRect();
      const startX = sRect.left + sRect.width / 2 - pRect.left;
      const startY = sRect.top + sRect.height / 2 - pRect.top;
      const midX = xRect.left + xRect.width / 2 - pRect.left;
      const midY = xRect.top + xRect.height / 2 - pRect.top;
      const endX = shRect.left + shRect.width / 2 - pRect.left;
      const endY = shRect.top + shRect.height / 2 - pRect.top;
      const d = `M ${startX},${startY} L ${midX},${midY} L ${endX},${endY}`;
      glow.setAttribute('d', d);
      core.setAttribute('d', d);
    };
    drawPath();
    window.addEventListener('resize', drawPath);

    let percentage = 0;
    let state: 'p1' | 'splash' | 'p2' | 'idle' = 'p1';
    let lastStateChange = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const dt = now - lastStateChange;
      if (state === 'p1') {
        percentage = Math.min(0.5, percentage + (dt / 800) * 0.5);
        nodeStack.classList.toggle('active', percentage < 0.4);
        if (percentage >= 0.5) {
          state = 'splash'; lastStateChange = now;
          glow.style.opacity = '0'; core.style.opacity = '0';
          splash.classList.add('animate');
          nodeStack.classList.remove('active');
        }
      } else if (state === 'splash') {
        if (dt >= 800) {
          state = 'p2'; lastStateChange = now;
          splash.classList.remove('animate');
          glow.style.opacity = '1'; core.style.opacity = '1';
        }
      } else if (state === 'p2') {
        percentage = Math.min(1, percentage + (dt / 800) * 0.5);
        nodeShield.classList.toggle('active', percentage > 0.6);
        if (percentage >= 1) {
          state = 'idle'; lastStateChange = now;
          nodeShield.classList.remove('active');
        }
      } else if (dt >= 1000) {
        state = 'p1'; lastStateChange = now; percentage = 0;
      }
      const center = percentage * 100;
      grad.setAttribute('x1', `${center - 5}%`);
      grad.setAttribute('x2', `${center + 5}%`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', drawPath);
    };
  }, []);

  return (
    <div className="sm-pipeline" ref={pipelineRef} aria-hidden>
      <svg className="sm-beam-svg">
        <defs>
          <filter id="sm-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feComposite in="SourceGraphic" in2="coloredBlur" operator="over" />
          </filter>
          <linearGradient id="sm-beam-gradient" gradientUnits="userSpaceOnUse" x1="0%" x2="10%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#b04090" stopOpacity="0" />
            <stop offset="20%" stopColor="#b04090" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="80%" stopColor="#c8a0e0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#c8a0e0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path ref={glowPathRef} d="" stroke="url(#sm-beam-gradient)" strokeWidth="2" fill="none" filter="url(#sm-glow)" style={{ opacity: 0.6 }} />
        <path ref={corePathRef} d="" stroke="url(#sm-beam-gradient)" strokeWidth="0.8" fill="none" />
      </svg>

      <div className="sm-node sm-node-light-right" ref={nodeStackRef}>
        <svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
      </div>
      <div className="sm-pipeline-line" />
      <div style={{ position: 'relative' }}>
        <div className="sm-splash" ref={splashRef} />
        <div className="sm-node-center" ref={nodeXRef}>
          <LogoMark />
        </div>
      </div>
      <div className="sm-pipeline-line right" />
      <div className="sm-node sm-node-light-left" ref={nodeShieldRef}>
        <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>
      </div>
    </div>
  );
};

// ============================================================================
// MOCKUP KREATORA (okno w stylu macOS)
// ============================================================================
const BuilderMockup = () => {
  const projects = [
    { name: 'Kurczaki Ziemniaki Kebab', subject: 'Strona z menu i galerią', preview: 'Hero, Cennik, Opinie, Kontakt — gotowe.', time: '9:41', unread: true, active: true, ini: 'K' },
    { name: 'Studio Anna', subject: 'Portfolio + rezerwacje', preview: 'Sekcja galerii i formularz wizyt.', time: '8:12', unread: true, active: false, ini: 'A' },
    { name: 'Barber Kings', subject: 'Nowy układ cennika', preview: 'Strzyżenie 60 zł — broda 40 zł.', time: 'Wczoraj', unread: false, active: false, ini: 'B' },
    { name: 'FitForm Studio', subject: 'Karnety online', preview: 'Plan tygodniowy + zapisy na zajęcia.', time: 'Wczoraj', unread: false, active: false, ini: 'F' },
    { name: 'Złoty Grzebień', subject: 'Podgląd gotowy', preview: 'Klient otworzył link 2 min temu.', time: 'Pn', unread: false, active: false, ini: 'Z' },
    { name: 'Bella Vista', subject: 'Formularz rezerwacji', preview: 'Dodano pola: data, liczba gości.', time: 'Pn', unread: false, active: false, ini: 'B' },
  ];
  const nav = [
    { icon: Inbox, label: 'Projekty', count: 12, active: true },
    { icon: Search, label: 'Lead Finder', count: 3, active: false },
    { icon: SendIcon, label: 'Oferty', count: undefined, active: false },
    { icon: FileEdit, label: 'Szkice', count: 2, active: false },
    { icon: Archive, label: 'Archiwum', count: undefined, active: false },
    { icon: Trash2, label: 'Kosz', count: undefined, active: false },
  ];
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e1014]/90 shadow-[0_40px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="flex items-center border-b border-white/10 px-4 py-3">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <p className="flex-1 text-center text-xs text-white/50">SiteMorph — Kreator</p>
          <span className="w-12" />
        </div>
        <div className="grid h-[520px] grid-cols-12 text-left">
          {/* Sidebar */}
          <div className="col-span-3 hidden border-r border-white/10 bg-black/30 p-4 md:block">
            <button className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">
              <Sparkles size={12} /> Generuj z AI
            </button>
            <nav className="space-y-0.5">
              {nav.map((n) => (
                <div key={n.label} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${n.active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}>
                  <n.icon size={13} />
                  <span className="flex-1">{n.label}</span>
                  {n.count !== undefined && <span className="text-[10px] text-white/40">{n.count}</span>}
                </div>
              ))}
            </nav>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Branże</p>
            <div className="mt-2.5 space-y-2">
              {[['Restauracje', '#00d2ff'], ['Beauty', '#A4F4FD'], ['Usługi', '#f59e0b'], ['E-commerce', '#10b981']].map(([label, color]) => (
                <div key={label} className="flex items-center gap-2 text-xs text-white/60">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {label}
                </div>
              ))}
            </div>
          </div>
          {/* Lista projektów */}
          <div className="col-span-12 border-r border-white/10 md:col-span-4">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
              <Search size={12} className="text-white/30" />
              <span className="text-xs text-white/30">Szukaj projektu</span>
            </div>
            <div className="divide-y divide-white/5">
              {projects.map((p) => (
                <div key={p.name} className={`cursor-default px-3 py-3 ${p.active ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-xs ${p.unread ? 'font-semibold text-white' : 'text-white/70'}`}>{p.name}</span>
                    <span className="shrink-0 text-[10px] text-white/40">{p.time}</span>
                  </div>
                  <p className={`truncate text-[11px] ${p.unread ? 'font-medium text-white/80' : 'text-white/50'}`}>{p.subject}</p>
                  <p className="truncate text-[11px] text-white/35">{p.preview}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Podgląd */}
          <div className="col-span-5 hidden md:block">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
              {[Eye, RefreshCw, Download, Trash2].map((Ic, i) => (
                <span key={i} className="grid h-7 w-7 place-items-center rounded-md text-white/50 hover:bg-white/5"><Ic size={13} /></span>
              ))}
              <span className="ml-auto grid h-7 w-7 place-items-center rounded-md text-white/50"><Paperclip size={13} /></span>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <h4 className="text-sm font-semibold">Strona: Kurczaki Ziemniaki Kebab</h4>
                <div className="mt-2 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#00d2ff] to-[#0B2551] text-[10px] font-bold">K</span>
                  <span className="text-xs text-white/60">Restauracja · Słupsk</span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/50">Gotowa</span>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#A4F4FD' }}>
                  <Sparkles size={12} /> Podsumowanie AI
                </div>
                <p className="text-xs leading-relaxed text-white/60">Wygenerowano 6 sekcji, 14 zdjęć i cennik. Strona gotowa do publikacji — link podglądu wysłany do klienta.</p>
              </div>
              <div className="space-y-2 text-xs leading-relaxed text-white/55">
                <p>Hero z godzinami otwarcia i oceną 4,5 (196 opinii).</p>
                <p>Menu z cenami: kebab w bułce 22 zł, zestaw rodzinny 89 zł.</p>
                <p>Formularz kontaktowy z walidacją i mapą dojazdu.</p>
                <p className="text-white/40">— SiteMorph AI</p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/60">
                <Paperclip size={11} /> kebab-preview.html
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const [clock] = useState(() => new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));

  const scrollToId = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const plans = [
    {
      tier: 'Starter', monthly: '49 zł/m', yearly: '490 zł/rok',
      desc: 'Dla twórców, którzy zaczynają sprzedawać pierwsze strony.',
      features: ['100 kredytów AI miesięcznie', 'Kreator stron AI', 'Lead Finder — 10 firm/mies.', '3 projekty', 'Podgląd na żywo'],
      pro: false,
    },
    {
      tier: 'Pro', monthly: '99 zł/m', yearly: '990 zł/rok',
      desc: 'Dla freelancerów, którzy robią strony regularnie.',
      features: ['200 kredytów AI miesięcznie', 'Lead Finder — 30 firm/mies.', '10 projektów', 'Galeria i animacje', 'Wsparcie priorytetowe'],
      pro: false,
    },
    {
      tier: 'Business', monthly: '199 zł/m', yearly: '1 990 zł/rok',
      desc: 'Dla agencji i zespołów pracujących z klientami.',
      features: ['500 kredytów AI miesięcznie', 'Lead Finder — 100 firm/mies.', 'Nieograniczone projekty', 'Własna domena', 'Fakturowanie 0% prowizji'],
      pro: true,
    },
  ];

  const niches = [
    { icon: UtensilsCrossed, label: 'Restauracje' },
    { icon: Scissors, label: 'Barbery' },
    { icon: Flower2, label: 'Salony beauty' },
    { icon: Wrench, label: 'Warsztaty' },
    { icon: Dumbbell, label: 'Siłownie' },
    { icon: Store, label: 'Sklepy lokalne' },
  ];

  return (
    <div className="sm-landing relative min-h-screen overflow-x-hidden bg-[#0c0c0c] text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{LANDING_CSS}</style>

      {/* noise filter globalny */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="sm-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
        </filter>
      </svg>

      {/* wideo w tle */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <video autoPlay loop muted playsInline className="pointer-events-none h-full w-full object-cover" src={VIDEO_URL} />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      {/* pionowe linie prowadzące */}
      <div className="pointer-events-none fixed inset-y-0 left-1/2 z-[5] hidden w-px -translate-x-[calc(50%+36rem)] bg-white/10 md:block" />
      <div className="pointer-events-none fixed inset-y-0 left-1/2 z-[5] hidden w-px translate-x-[calc(-50%+36rem)] bg-white/10 md:block" />

      {/* ================= NAVBAR ================= */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 pt-6"
      >
        <div className="flex items-center gap-3">
          <LogoMark />
          <span className="text-sm font-semibold tracking-tight">SiteMorph</span>
        </div>
        <div className="hidden items-center gap-8 md:flex">
          {[['Funkcje', 'funkcje'], ['Lead Finder', 'leady'], ['Opinie', 'opinie'], ['Cennik', 'cennik']].map(([label, id], i) => (
            <motion.button
              key={id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
              onClick={() => scrollToId(id)}
              className="cursor-pointer text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {label}
            </motion.button>
          ))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {session ? (
            <button onClick={() => onEnterApp('dashboard')} className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-[0.98]">
              Wróć do aplikacji <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <>
              <button onClick={onShowAuth} className="cursor-pointer text-sm font-medium text-white/70 transition-colors hover:text-white">Zaloguj się</button>
              <button onClick={() => onEnterApp('dashboard')} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-[0.98]">
                Zacznij zarabiać
              </button>
            </>
          )}
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          <Menu size={18} />
        </button>
      </motion.nav>

      {/* mobilne menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed inset-x-4 top-20 z-30 rounded-2xl border border-white/10 bg-[#0e0e14]/95 p-6 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-4">
              {[['Funkcje', 'funkcje'], ['Lead Finder', 'leady'], ['Opinie', 'opinie'], ['Cennik', 'cennik']].map(([label, id]) => (
                <button key={id} onClick={() => scrollToId(id)} className="cursor-pointer text-left text-sm font-medium text-white/70 hover:text-white">{label}</button>
              ))}
              <button onClick={() => { setMenuOpen(false); session ? onEnterApp('dashboard') : onShowAuth(); }} className="mt-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black">
                {session ? 'Wróć do aplikacji' : 'Zacznij zarabiać'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= HERO CARD (Xero arc) ================= */}
      <section className="relative z-10 px-3 pt-4 sm:px-4">
        <div className="sm-hero-card mx-auto">
          <div className="sm-hero-grid" />

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="z-10 flex flex-col items-center"
          >
            <BeamPipeline />

            <h1 className="text-4xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
              Buduj strony.
              <br />
              <span className="sm-animate-shiny sm-gradient-text">Zarabiaj.</span>
            </h1>

            <p className="mt-8 max-w-md text-base leading-[1.6] text-white/60">
              SiteMorph to studio AI dla twórców stron. Jedno zdanie — gotowa witryna dla lokalnej firmy.
              Ty znajdujesz klienta, reszta dzieje się sama.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                onClick={() => onEnterApp('dashboard')}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-[0.98]"
              >
                Zacznij zarabiać <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <span className="text-xs text-white/40">15 kredytów na start · bez karty · anulujesz kiedy chcesz</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= PASEK APLIKACJI (macOS strip) ================= */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        className="relative z-10 mt-6 border-y border-white/10 bg-black/40 backdrop-blur-md"
      >
        <div className="mx-auto flex h-10 max-w-6xl items-center justify-between px-6 text-xs">
          <div className="flex items-center gap-4">
            <LogoMark className="!h-3.5 !w-3.5" />
            <span className="font-bold text-white">SiteMorph</span>
            {['Pulpit', 'Kreator', 'Leady'].map((m) => (
              <span key={m} className="hidden text-white/60 sm:inline">{m}</span>
            ))}
            {['Faktury', 'Pomoc'].map((m) => (
              <span key={m} className="hidden text-white/60 md:inline">{m}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-white/60">
            <Search size={12} /> {clock}
          </div>
        </div>
      </motion.div>

      {/* ================= NISZE (brands row) ================= */}
      <div className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-10">
        {niches.map((n) => (
          <span key={n.label} className="flex items-center gap-2 text-sm font-medium text-white/35 transition-colors hover:text-white/80">
            <n.icon size={16} /> {n.label}
          </span>
        ))}
      </div>

      {/* ================= MOCKUP KREATORA ================= */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10"
      >
        <BuilderMockup />
      </motion.div>

      {/* ================= LEAD FINDER (triage) ================= */}
      <section id="leady" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-20 md:py-28">
        <div className="grid items-start gap-10 md:grid-cols-2 md:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> Triage
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/50">Lead Finder</span>
            </div>
            <h2 className="mt-5 text-3xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              Wyczyść listę firm
              <br />
              w jednym przejściu.
            </h2>
            <p className="mt-6 max-w-md text-base leading-[1.6] text-white/60">
              SiteMorph znajduje lokalne firmy z Google, sprawdza kto nie ma strony i grupuje kontakty
              pod gotową ofertę. Ty tylko dzwonisz.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {['Filtr „bez strony"', 'Telefony i adresy', 'AI scoring', 'Eksport CSV'].map((c) => (
                <span key={c} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70">{c}</span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="sm-liquid-glass rounded-2xl p-5"
          >
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-white/50">Dziś · 42 firmy przejrzane</p>
            <div className="space-y-3">
              {[
                { title: 'Priorytet', count: 4, color: '#ffffff', items: ['Kurczaki Ziemniaki Kebab — brak strony', 'Studio Anna — brak strony'] },
                { title: 'Follow-up', count: 7, color: '#e5e5e5', items: ['Barber Kings — oferta wysłana', 'FitForm — przypomnienie za 3 dni'] },
                { title: 'Aktualizacje', count: 18, color: '#a3a3a3', items: ['Złoty Grzebień — podgląd otwarty', 'Bella Vista — nowy komentarz'] },
                { title: 'Archiwum', count: 13, color: '#525252', items: ['Wypłaty · Newsletter · Faktury'] },
              ].map((g) => (
                <div key={g.title} className="sm-liquid-glass rounded-lg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: g.color }}>{g.title}</span>
                    <span className="text-xs text-white/40">{g.count}</span>
                  </div>
                  {g.items.map((it) => (
                    <p key={it} className="text-[11px] leading-relaxed text-white/45">— {it}</p>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= OPINIE ================= */}
      <section id="opinie" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 border-t border-white/10 px-6 py-20 md:py-28">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { q: 'SiteMorph dał mi cztery godziny w tygodniu z powrotem. Strony, które kiedyś robiłem tydzień, schodzą w jeden wieczór.', name: 'Kuba M.', role: 'Freelancer webdesign', co: 'Warszawa' },
            { q: 'Filtr „bez strony" w Lead Finder to złoto. Podświetla firmy, które naprawdę czekają na ofertę.', name: 'Marta K.', role: 'Właścicielka agencji lokalnej', co: 'Poznań' },
            { q: 'Klient ogląda podgląd na żywo i sam pisze „lecimy". Zamknięcie sprzedaży zajmuje mi jednego maila.', name: 'Tomek Z.', role: 'Studio kreatywne', co: 'Słupsk' },
          ].map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="sm-liquid-glass rounded-2xl p-6"
            >
              <blockquote className="text-sm leading-[1.6] text-white/80">„{t.q}"</blockquote>
              <figcaption className="mt-6 border-t border-white/10 pt-5">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-white/50">{t.role}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white">{t.co}</div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* ================= CENNIK ================= */}
      <section id="cennik" className="relative z-10 scroll-mt-24">
        <div className="sm-pricing-section">
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
            <filter id="sm-noise-pricing">
              <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" stitchTiles="stitch" />
              <feComponentTransfer><feFuncA type="linear" slope="0.075" /></feComponentTransfer>
              <feComposite in2="SourceGraphic" operator="in" result="noise" />
              <feBlend in="SourceGraphic" in2="noise" mode="overlay" />
            </filter>
          </svg>

          <div className="sm-watermark-container">
            <div className="sm-watermark-main">
              <span className="sm-watermark-line-1">Buduj strony.</span>
              <span className="sm-watermark-line-2">Zarabiaj.</span>
            </div>
          </div>

          <div className="sm-grid">
            {plans.map((p) => (
              <div key={p.tier} className={`sm-card ${p.pro ? 'sm-card-pro' : ''}`}>
                <div className="sm-tier-small">{p.tier}</div>
                <div className="sm-tier-large">{yearly ? p.yearly : p.monthly}</div>
                <p className="sm-desc">{p.desc}</p>
                <ul className="sm-list">
                  {p.features.map((f) => (
                    <li key={f}>
                      <span className="sm-check"><Check size={13} color="#fff" /></span> {f}
                    </li>
                  ))}
                </ul>
                <button className="sm-btn" onClick={() => onEnterApp('pricing')}>Wybierz plan</button>
              </div>
            ))}
          </div>

          <div className="sm-toggle-wrap">
            <span className="text-xs text-white/60">Rocznie (2 mies. gratis)</span>
            <button
              className={`sm-toggle ${yearly ? 'active' : ''}`}
              onClick={() => setYearly(!yearly)}
              aria-label="Przełącz rozliczenie roczne"
            >
              <span className="sm-toggle-knob" />
            </button>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="sm-liquid-glass relative overflow-hidden rounded-3xl px-8 py-16 text-center md:py-24"
        >
          <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: 'radial-gradient(600px circle at 50% 0%, rgba(255,255,255,0.15), transparent 70%)' }} />
          <h2 className="relative text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
            Jedno zdanie.
            <br />
            Gotowa strona.
          </h2>
          <p className="relative mx-auto mt-6 max-w-md text-sm leading-[1.6] text-white/60">
            Dołącz do twórców, którzy sprzedają strony lokalnym firmom — bez kodowania, bez prowizji, bez stresu.
          </p>
          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => onEnterApp('dashboard')} className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-[0.98]">
              Zbuduj pierwszą stronę <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button onClick={() => scrollToId('cennik')} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5">
              Zobacz cennik <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="relative z-10 border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-[11px] font-medium text-white/50 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10"><LogoMark className="!h-3.5 !w-3.5" /></span>
            <span>© {new Date().getFullYear()} SiteMorph · Stworzone dla lokalnych firm.</span>
          </div>
          <div className="flex gap-1">
            {([['Regulamin', 'regulamin'], ['Prywatność', 'prywatnosc'], ['Cookies', 'cookies']] as const).map(([label, key]) => (
              <button
                key={key}
                onClick={() => setLegalDoc(key)}
                className="cursor-pointer rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-white/50 transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white"
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
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLegalDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e14] shadow-2xl"
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#0e0e14]/90 p-6 backdrop-blur">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{LEGAL_DOCS[legalDoc].title}</h3>
                  <p className="mt-0.5 text-[10px] font-medium text-white/40">{LEGAL_DOCS[legalDoc].updated}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.08, rotate: 90 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setLegalDoc(null)}
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/5"
                >
                  <X size={14} />
                </motion.button>
              </div>
              <div className="relative space-y-5 overflow-y-auto p-6">
                {LEGAL_DOCS[legalDoc].sections.map((s) => (
                  <div key={s.h} className="space-y-1.5">
                    <h4 className="text-sm font-semibold">{s.h}</h4>
                    <p className="text-xs leading-relaxed text-white/60">{s.p}</p>
                  </div>
                ))}
                <div className="flex justify-end pt-4">
                  <button onClick={() => setLegalDoc(null)} className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-black">Rozumiem</button>
                </div>
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
