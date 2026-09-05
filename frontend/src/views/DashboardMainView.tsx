import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  Paperclip,
  ArrowUp,
  Search,
  GraduationCap,
  Clock,
  Wrench,
  Receipt,
  Image as ImageIcon,
  Figma,
  Palette,
} from 'lucide-react';
import { cineChild, cineParent, springTransition } from '../lib/shared';
import { API_BASE } from '../lib/api';

/* ============================================================================
   FASTSHOT-STYLE COMPOSER HERO — jednostka skali --u (1560×1008 reference frame)
   Toolbar: lewe chipsy (flex), prawy klaster ABSOLUTNY wg zmierzonych współrzędnych:
   model 510.2u, attach 599.15u, send 640u (35u circle, wystaje 7u pod chip row 30u)
   ========================================================================== */

const COMPOSER_CSS = `
.dm-root {
  --u: min(0.06410256vw, 0.12400794vh);
  --vu: 0.09920635vh;
  --inset-top: 41; --inset-bottom: 106;
  --font-text: Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --w-regular:400; --w-display-wght:410; --w-medium:500; --w-semibold:600;
  --w-display: var(--w-display-wght); --w-cta: 520; --w-proof: 480;
  --h1-fs: 36.25; --display-ls: 0.0018em;
  --nav-ls: -0.0115em; --brand-ls: -0.0154em; --cta-ls: -0.0127em; --body-ls: 0.007em; --proof-ls: 0.0065em;
  --card-w: 708; --card-h: 143; --card-r: 26;
  --ph-fs: 9.97; --chip-h: 30; --chip-r: 9; --chip-fs: 9.0; --chip-gap: 5.5;
  --son-fs: 10.4; --son-top: 15.5;
  --send-d: 35;
  font-family: var(--font-text);
  font-synthesis: none; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: geometricPrecision;
  min-height: 100%; position: relative;
}
.dm-aurora { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; background: #0a0d12; }
.dm-aurora::before, .dm-aurora::after {
  content: ''; position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55;
  animation: dm-drift 22s ease-in-out infinite alternate;
}
.dm-aurora::before { width: 60%; height: 70%; top: -25%; left: -10%; background: radial-gradient(circle, rgba(60,90,180,0.5), transparent 65%); }
.dm-aurora::after { width: 55%; height: 65%; bottom: -30%; right: -12%; background: radial-gradient(circle, rgba(150,60,130,0.35), transparent 65%); animation-delay: -8s; }
@keyframes dm-drift { from { transform: translate(0,0) scale(1); } to { transform: translate(6%, 4%) scale(1.12); } }

.dm-frame { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center;
  padding: calc(var(--inset-top)*var(--vu)) 24px calc(var(--inset-bottom)*var(--vu)); gap: calc(51*var(--vu)); min-height: 72vh; }

.dm-h1 { color: #fff; font-size: clamp(28px, 3.4vw, 46px); font-weight: var(--w-display);
  line-height: 1.10; letter-spacing: var(--display-ls);
  font-variation-settings: 'opsz' 32; text-shadow: 0 2px 22px rgba(0,0,0,.30); text-align: center; }

/* ---------- composer card ---------- */
.dm-card { width: 100%; max-width: 708px;
  height: 143px; border-radius: 26px;
  background: rgba(41,41,43,.955); backdrop-filter: blur(26px) saturate(112%); -webkit-backdrop-filter: blur(26px) saturate(112%);
  box-shadow: inset 0 0 0 1px rgba(214,228,255,.14), 0 22px 60px rgba(0,0,0,.30);
  position: relative; display: flex; flex-direction: column; }
.dm-ph { position: absolute; left: 27px; right: 24px; top: 33px; color: #8B8C8E;
  font-size: 13.5px; font-weight: var(--w-regular); line-height: 1.35; letter-spacing: var(--body-ls);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; transition: opacity .15s ease; }
.dm-ph.hidden { opacity: 0; }
.dm-input { position: absolute; inset: 0; width: 100%; padding: 33px 150px 45px 27px; background: transparent;
  border: 0; outline: none; color: #f2f2f3; font-size: 13.5px; font-weight: var(--w-regular);
  letter-spacing: var(--body-ls); line-height: 1.35; resize: none; }
.dm-input::placeholder { color: transparent; }

/* tools strip — lewa część flexowa */
.dm-tools { position: absolute; left: 19px; right: -1px; top: auto; bottom: 13px; height: 30px; display: flex; align-items: center; }
.dm-chips { display: flex; align-items: center; gap: 5.5px; }
.dm-chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px;
  border-radius: 9px; font-size: 11px; font-weight: var(--w-medium); color: #909093; line-height: 1;
  background: linear-gradient(180deg, rgba(255,255,255,.088) 0%, rgba(255,255,255,.050) 45%, rgba(255,255,255,.038) 100%);
  border: 1px solid rgba(255,255,255,.05); cursor: pointer; transition: all .18s ease; white-space: nowrap; }
.dm-chip svg { width: 12px; height: 12px; }
.dm-chip span { transform: translateY(2px); }
.dm-chip:hover { background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.07)); color: #c8c8cb; }

/* prawy klaster — ABSOLUTNY, offsety od prawej krawędzi karty */
.dm-right { position: absolute; right: 14px; bottom: 10px; height: 35px; display: flex; align-items: center; pointer-events: none; }
.dm-right > * { pointer-events: auto; }
.dm-model { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: var(--w-regular);
  color: #98999C; line-height: 1; margin-right: 18px; cursor: pointer; }
.dm-model svg { width: 8px; height: 8px; }
.dm-attach { color: #A9AAAD; background: none; border: 0; cursor: pointer; display: flex; align-items: center; padding: 0; transition: color .15s ease; margin-right: 21px; }
.dm-attach svg { width: 18px; height: 18px; }
.dm-attach:hover { color: #fff; }
.dm-send { width: 35px; height: 35px; border-radius: 50%; border: 0; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(163deg, #FBBC94 0%, #F49D70 46%, #E88654 100%);
  box-shadow: 0 3px 12px rgba(210,110,60,.34); transition: all .18s ease; }
.dm-send svg { width: 12px; height: 12px; color: #fff; }
.dm-send:hover { filter: brightness(1.07); }
.dm-send:active { transform: scale(.95); }
.dm-send:disabled { opacity: .55; cursor: default; }
.dm-send:focus-visible, .dm-chip:focus-visible, .dm-input:focus-visible { outline: 2px solid #F8B285; outline-offset: 3px; border-radius: 6px; }

/* ---------- proof footer ---------- */
.dm-proof { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.dm-proof-cap { color: rgba(255,255,255,.95); font-size: 13px; font-weight: var(--w-proof);
  letter-spacing: var(--proof-ls); font-variation-settings: 'opsz' 32; text-shadow: 0 1px 12px rgba(0,0,0,.35); }
.dm-proof-logos { display: flex; align-items: center; gap: clamp(28px, 5vw, 62px); }
.dm-proof-logos svg { height: 17px; width: auto; color: #fff; filter: drop-shadow(0 1px 10px rgba(0,0,0,.30)); }

/* ---------- LIGHT VARIANT (dashboard) ---------- */
.dm-light .dm-aurora { background: #f4f5f8; }
.dm-light .dm-aurora::before { background: radial-gradient(circle, rgba(120,150,230,0.22), transparent 65%); }
.dm-light .dm-aurora::after { background: radial-gradient(circle, rgba(230,150,200,0.18), transparent 65%); }
.dm-light .dm-h1 { color: #0a0a0a; text-shadow: none; }
.dm-light .dm-card { background: rgba(255,255,255,.92); box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08), 0 22px 60px rgba(0,0,0,0.08); }
.dm-light .dm-ph { color: #8a8a8f; }
.dm-light .dm-input { color: #18181b; }
.dm-light .dm-chip { background: linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.025) 45%, rgba(0,0,0,.02) 100%); border-color: rgba(0,0,0,0.08); color: #52525b; }
.dm-light .dm-chip:hover { background: linear-gradient(180deg, rgba(0,0,0,.09), rgba(0,0,0,.05)); color: #18181b; }
.dm-light .dm-model { color: #71717a; }
.dm-light .dm-attach { color: #71717a; }
.dm-light .dm-attach:hover { color: #000; }
.dm-light .dm-proof-cap { color: #3f3f46; text-shadow: none; }
.dm-light .dm-proof-logos svg { color: #18181b; filter: none; }
.dm-light .text-white { color: #0a0a0a !important; }
.dm-light [class*="text-white/3"], .dm-light [class*="text-white/4"], .dm-light [class*="text-white/5"] { color: #71717a !important; }
.dm-light [class*="text-white/6"], .dm-light [class*="text-white/7"], .dm-light [class*="text-white/8"] { color: #3f3f46 !important; }
.dm-light [class*="border-white"] { border-color: rgba(0,0,0,0.09) !important; }
.dm-light [class*="bg-white/"] { background-color: rgba(0,0,0,0.04) !important; }
.dm-light button.bg-white { background-color: #0a0a0a !important; color: #ffffff !important; }

/* ---------- wejściowe animacje ---------- */
@keyframes dm-settle-down { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
@keyframes dm-focus { from { opacity: 0; transform: translateY(14px); filter: blur(6px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes dm-panel { from { opacity: 0; transform: translateY(18px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes dm-populate { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes dm-send-pop { from { transform: scale(.82); } to { transform: scale(1); } }
@media (prefers-reduced-motion: no-preference) {
  .dm-a-brand { animation: dm-settle-down .58s cubic-bezier(.22,1,.36,1) .06s both; }
  .dm-a-h1 { animation: dm-focus 1s cubic-bezier(.16,1,.3,1) .3s both; }
  .dm-a-card { animation: dm-panel .9s cubic-bezier(.16,1,.3,1) .62s both; }
  .dm-a-chips { animation: dm-populate .5s cubic-bezier(.22,1,.36,1) .94s both; }
  .dm-a-right { animation: dm-populate .5s cubic-bezier(.22,1,.36,1) 1s both; }
  .dm-a-send { animation: dm-send-pop .5s cubic-bezier(.16,1,.3,1) 1s both; }
  .dm-a-proof { animation: dm-populate .55s cubic-bezier(.22,1,.36,1) 1.08s both; }
  .dm-a-logos { animation: dm-populate .55s cubic-bezier(.22,1,.36,1) 1.16s both; }
}

@media (max-width: 900px) {
  .dm-frame { min-height: auto; padding-top: 24px; padding-bottom: 40px; gap: 28px; }
  .dm-card { height: auto; min-height: 150px; }
}
@media (max-width: 599px) {
  .dm-h1 { font-size: clamp(27px, 7.6vw, 42px); }
  .dm-card { width: 100%; }
  .dm-chip:nth-child(3) { display: none; }
}
`;



export const DashboardMainView = ({
  setActiveTab,
  theme,
  onLaunchBuilderWithPrompt
}: {
  setActiveTab: (t: string) => void;
  theme: 'light' | 'dark';
  onLaunchBuilderWithPrompt: (prompt: string) => void;
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [activeTabSub, setActiveTabSub] = useState<'my' | 'recent'>('my');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [styleLabel, setStyleLabel] = useState('Styl dnia');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const styleOpts = ['Styl dnia', 'Dark premium', 'Jasny minimal', 'Neon'];
  const cycleStyle = () =>
    setStyleLabel((p) => styleOpts[(styleOpts.indexOf(p) + 1) % styleOpts.length]);
  const onAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const res = await fetch(`${API_BASE}/api/builder/upload`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (data?.urls?.length) setAttachments((prev) => [...prev, ...data.urls]);
    } catch {
      // offline - zostaw local names
      setAttachments((prev) => [...prev, ...files.map((f) => f.name)]);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleSendPrompt = () => {
    if (!promptInput.trim() && attachments.length === 0) return;
    let full = promptInput.trim();
    if (attachments.length) full += `
Zdjęcia do wykorzystania na stronie (użyj jako src w <img>): ${attachments.join(', ')}`;
    if (styleLabel !== 'Styl dnia') full += `
Styl: ${styleLabel}`;
    onLaunchBuilderWithPrompt(full);
    setAttachments([]);
    setStyleLabel('Styl dnia');
  };

  const quickActions = [
    { label: 'Lead Finder', desc: 'Klienci bez strony www — telefon i adres od razu', icon: Search, tab: 'leadfinder', span: 'md:col-span-2' },
    { label: 'Faktury', desc: '0% prowizji, PDF', icon: Receipt, tab: 'finance', span: '' },
    { label: 'Kreator AI', desc: 'Pełny edytor i podgląd', icon: Wrench, tab: 'builder', span: '' },
    { label: 'Akademia', desc: 'Sprzedawaj z głową', icon: GraduationCap, tab: 'tutorials', span: '' },
  ];

  return (
    <div className={`dm-root ${theme === 'light' ? 'dm-light' : ''}`}>
      <style>{COMPOSER_CSS}</style>

      {/* ===================== COMPOSER HERO ===================== */}
      <div className="dm-aurora" aria-hidden />
      <div className="dm-frame">
        <h1 className="dm-h1 dm-a-h1">Opisz stronę. My ją zbudujemy.</h1>

        <form
          className="dm-card dm-a-card"
          onSubmit={(e) => { e.preventDefault(); handleSendPrompt(); }}
        >
          <p className={`dm-ph ${promptInput ? 'hidden' : ''}`}>
            Stwórz stronę dla restauracji z menu, galerią i rezerwacją online...
          </p>
          <textarea
            className="dm-input"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            aria-label="Opis strony do wygenerowania"
          />

          {/* tools: chipsy po lewej */}
          <div className="dm-tools">
            <div className="dm-chips dm-a-chips">
              <button type="button" className="dm-chip" onClick={() => fileRef.current?.click()}>
                <ImageIcon /> <span>{uploading ? 'Wysyłam...' : attachments.length ? `${attachments.length} zdjęć` : 'Załącz zdjęcia'}</span>
              </button>
              <button type="button" className="dm-chip" onClick={() => fileRef.current?.click()}>
                <Figma /> <span>Dodaj logo</span>
              </button>
              <button type="button" className="dm-chip" onClick={cycleStyle}>
                <Palette /> <span>{styleLabel}</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onAttach} />
            </div>

            {/* prawy klaster — absolutny: model · attach · send */}
            <div className="dm-right dm-a-right">
              <span className="dm-model">SiteMorph 1</span>
              <button type="button" className="dm-attach" aria-label="Załącz plik">
                <Paperclip />
              </button>
              <button
                type="submit"
                className="dm-send dm-a-send"
                aria-label="Buduj"
                disabled={!promptInput.trim() && attachments.length === 0}
              >
                <ArrowUp strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </form>

      </div>

      {/* ===================== SZYBKIE AKCJE — dark glass ===================== */}
      <motion.div variants={cineParent} initial="hidden" animate="visible" className="relative z-10 mx-auto max-w-4xl grid grid-cols-1 gap-4 px-6 pb-6 md:grid-cols-3">
        {quickActions.map((a, i) => (
          <motion.button
            key={a.label}
            variants={cineChild}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={() => setActiveTab(a.tab)}
            className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-left shadow-[0_2px_12px_rgba(0,0,0,0.2)] transition-all cursor-pointer hover:border-white/[0.16] hover:bg-white/[0.06] ${a.span}`}
          >
            <div className="grid h-9 w-9 place-items-center rounded-[10px] border border-white/10 bg-white/[0.06]">
              <a.icon size={15} className="text-white/80" />
            </div>
            <div className="mt-4">
              <div className="text-[16px] font-semibold tracking-[-0.02em] leading-none text-white">{a.label}</div>
              <div className="mt-1.5 text-[13px] leading-[1.5] text-white/45">{a.desc}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* ===================== PROJEKTY — dark glass ===================== */}
      <motion.div
        variants={cineChild}
        className="relative z-10 mx-auto max-w-4xl rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
        style={{ marginBottom: 40 }}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-xs font-semibold">
          <div className="relative flex gap-2">
            {(['my', 'recent'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTabSub(tab)}
                className={`relative cursor-pointer border-none px-4 py-1.5 text-xs font-semibold transition-colors ${
                  activeTabSub === tab ? 'text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                {activeTabSub === tab && (
                  <motion.div
                    layoutId="dashboardSubTab"
                    transition={springTransition}
                    className="absolute inset-0 rounded-full bg-white shadow-md"
                  />
                )}
                <span className="relative z-10">{tab === 'my' ? 'Moje projekty' : 'Ostatnio przeglądane'}</span>
              </button>
            ))}
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-white/30">
            <Sparkles size={11} /> AI ready
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTabSub}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }}
            transition={springTransition}
            className="flex flex-col items-center justify-center space-y-3 py-14 text-center"
          >
            <motion.div
              animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }}
              transition={{ duration: 5, repeat: Infinity }}
              className="mb-1 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent"
            >
              {activeTabSub === 'my' ? <Sparkles size={26} className="text-white/70" /> : <Clock size={26} className="text-white/50" />}
            </motion.div>
            <h3 className="text-lg font-semibold text-white">{activeTabSub === 'my' ? 'Brak aktywnych projektów' : 'Nic tu jeszcze nie ma'}</h3>
            <p className="max-w-xs text-xs font-medium text-white/45">
              {activeTabSub === 'my'
                ? 'Opisz swój pomysł w polu powyżej — strona powstanie w kilka minut.'
                : 'Projekty, które otworzysz, pojawią się tutaj.'}
            </p>
            <button
              onClick={() => setActiveTab('builder')}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.98]"
            >
              <Wrench size={14} /> Otwórz Kreator Stron <ArrowRight size={13} />
            </button>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
