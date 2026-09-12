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
  Palette,
} from 'lucide-react';
import { cineChild, cineParent, springTransition } from '../lib/shared';
import { API_BASE } from '../lib/api';

/* ============================================================================
   PULPIT — composer na górze, szybkie akcje w zbalansowanej siatce,
   lista projektów widoczna już w pierwszym ekranie.
   ========================================================================== */

const COMPOSER_CSS = `
.dm-root { position: relative; min-height: 100%; }

/* Spokojne tło: jeden bardzo subtelny, neutralno-turkusowy oddech. Bez magenty. */
.dm-glow { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.dm-glow::before {
  content: ''; position: absolute; width: 70%; height: 60%; top: -30%; left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle, color-mix(in srgb, var(--sm-accent) 14%, transparent), transparent 70%);
  filter: blur(90px);
  opacity: .55;
}
.dm-glow::after {
  content: ''; position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--sm-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--sm-border) 1px, transparent 1px);
  background-size: 64px 64px;
  -webkit-mask-image: radial-gradient(ellipse 70% 50% at 50% 0%, black 0%, transparent 75%);
  mask-image: radial-gradient(ellipse 70% 50% at 50% 0%, black 0%, transparent 75%);
  opacity: .4;
}

.dm-shell { position: relative; z-index: 1; padding: 28px 20px 40px; }
@media (min-width: 768px) { .dm-shell { padding: 44px 32px 56px; } }

.dm-h1 {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.032em;
  color: var(--sm-text);
}

/* Composer — jedyny element z większym promieniem (główna akcja ekranu). */
.dm-card {
  width: 100%;
  border: 1px solid var(--sm-border);
  border-radius: 16px;
  background: var(--sm-surface);
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 148px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
  transition: border-color .15s ease;
}
.dm-card:focus-within { border-color: var(--sm-accent); }
html:not(.dark) .dm-card { box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06); }

.dm-input {
  flex: 1;
  width: 100%;
  min-height: 84px;
  padding: 16px 16px 8px;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--sm-text);
  font-family: inherit;
  font-size: 16px;
  line-height: 1.5;
  resize: none;
}
.dm-input::placeholder { color: var(--sm-text-3); }

.dm-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 10px;
  flex-wrap: wrap;
}
.dm-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--sm-border);
  background: var(--sm-surface-2);
  color: var(--sm-text-2);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background-color .15s ease, color .15s ease, border-color .15s ease;
  white-space: nowrap;
}
.dm-chip:hover { background: var(--sm-surface-3); color: var(--sm-text); }

.dm-send {
  width: 44px; height: 44px;
  border-radius: 12px;
  border: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: var(--sm-accent);
  color: var(--sm-accent-ink);
  transition: filter .15s ease, opacity .15s ease;
}
.dm-send:hover:not(:disabled) { filter: brightness(1.07); }
.dm-send:active:not(:disabled) { transform: scale(.96); }
.dm-send:disabled { opacity: .45; cursor: not-allowed; }

.dm-count {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--sm-text-3);
  padding: 0 4px;
}

@media (prefers-reduced-motion: no-preference) {
  .dm-a-in { animation: dm-rise .5s cubic-bezier(.16,1,.3,1) both; }
  .dm-a-in-2 { animation: dm-rise .5s cubic-bezier(.16,1,.3,1) .1s both; }
}
@keyframes dm-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
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
    { label: 'Kreator AI', desc: 'Opisz stronę i generuj podgląd', icon: Wrench, tab: 'builder' },
    { label: 'Lead Finder', desc: 'Firmy bez strony www', icon: Search, tab: 'leadfinder' },
    { label: 'Faktury', desc: 'Rozliczenia bez prowizji', icon: Receipt, tab: 'finance' },
    { label: 'Akademia', desc: 'Materiały o sprzedaży', icon: GraduationCap, tab: 'tutorials' },
  ];

  const canSend = Boolean(promptInput.trim()) || attachments.length > 0;

  return (
    <div className={`dm-root ${theme === 'light' ? 'dm-light' : ''}`}>
      <style>{COMPOSER_CSS}</style>
      <div className="dm-glow" aria-hidden />
      <div className="dm-shell">
        <div className="mx-auto max-w-4xl">
          {/* ===================== COMPOSER ===================== */}
          <h1 className="dm-h1 dm-a-in">Opisz stronę, a ja ją zbuduję.</h1>
          <p className="mt-3 max-w-xl text-[16px] leading-[1.55] text-[var(--sm-text-2)] dm-a-in">
            Wklej dane firmy z Map Google albo opisz ją własnymi słowami. Resztę — układ,
            typografię i treści — dobiorę do tej konkretnej branży.
          </p>

          <form
            className="dm-card dm-a-in-2 mt-6"
            onSubmit={(e) => { e.preventDefault(); handleSendPrompt(); }}
          >
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
              placeholder="Stwórz stronę dla restauracji z menu, galerią i rezerwacją online..."
              aria-label="Opisz stronę do wygenerowania"
            />
            <div className="dm-tools">
              <button type="button" className="dm-chip" onClick={() => fileRef.current?.click()}>
                <ImageIcon size={16} />
                {uploading ? 'Wysyłam…' : attachments.length ? `${attachments.length} zdjęć` : 'Załącz zdjęcia'}
              </button>
              <button type="button" className="dm-chip" onClick={cycleStyle}>
                <Palette size={16} /> {styleLabel}
              </button>
              <button
                type="button"
                className="dm-chip"
                onClick={() => fileRef.current?.click()}
                title="Logo lub zdjęcia produktów"
              >
                <Paperclip size={16} /> Dodaj logo
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onAttach} />

              <div className="ml-auto flex items-center gap-3">
                <span className="dm-count">15 kredytów</span>
                <button
                  type="submit"
                  className="dm-send"
                  aria-label="Wygeneruj stronę"
                  title="Wygeneruj stronę"
                  disabled={!canSend || uploading}
                >
                  <ArrowUp size={20} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </form>

          {/* ===================== SZYBKIE AKCJE (zbalansowana siatka 2×2 / 1×4) ===================== */}
          <motion.div
            variants={cineParent}
            initial="hidden"
            animate="visible"
            className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
            {quickActions.map((a) => (
              <motion.button
                key={a.label}
                variants={cineChild}
                onClick={() => setActiveTab(a.tab)}
                className="sm-card flex min-h-[112px] flex-col items-start gap-3 p-4 text-left transition-colors cursor-pointer hover:border-[var(--sm-border-strong)]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)]">
                  <a.icon size={18} className="text-[var(--sm-accent)]" />
                </span>
                <span className="block">
                  <span className="block text-[15px] font-semibold tracking-[-0.01em]">{a.label}</span>
                  <span className="mt-1 block text-[13px] leading-[1.45] text-[var(--sm-text-2)]">{a.desc}</span>
                </span>
              </motion.button>
            ))}
          </motion.div>

          {/* ===================== PROJEKTY ===================== */}
          <div className="sm-card mt-6 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1" role="tablist" aria-label="Widok projektów">
                {(['my', 'recent'] as const).map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={activeTabSub === tab}
                    onClick={() => setActiveTabSub(tab)}
                    className={`relative min-h-[44px] rounded-[8px] px-3.5 text-[14px] font-medium transition-colors cursor-pointer border-none bg-transparent ${
                      activeTabSub === tab ? 'text-[var(--sm-text)]' : 'text-[var(--sm-text-2)] hover:text-[var(--sm-text)]'
                    }`}
                  >
                    {activeTabSub === tab && (
                      <motion.span
                        layoutId="dashboardSubTab"
                        transition={springTransition}
                        className="absolute inset-0 rounded-[8px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)]"
                      />
                    )}
                    <span className="relative z-10">{tab === 'my' ? 'Moje projekty' : 'Ostatnio przeglądane'}</span>
                  </button>
                ))}
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-[var(--sm-text-3)]">
                <Sparkles size={14} /> Gotowe do pracy
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTabSub}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col items-start gap-3 border-t border-[var(--sm-border)] pt-5 sm:flex-row sm:items-center"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)]">
                  {activeTabSub === 'my' ? <Sparkles size={20} className="text-[var(--sm-text-3)]" /> : <Clock size={20} className="text-[var(--sm-text-3)]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-semibold">
                    {activeTabSub === 'my' ? 'Brak projektów' : 'Nic tu jeszcze nie ma'}
                  </div>
                  <p className="mt-0.5 text-[14px] text-[var(--sm-text-2)]">
                    {activeTabSub === 'my'
                      ? 'Opisz stronę w polu powyżej — projekt pojawi się tutaj po zapisaniu.'
                      : 'Projekty, które otworzysz, pojawią się na tej liście.'}
                  </p>
                </div>
                <button onClick={() => setActiveTab('builder')} className="sm-btn shrink-0">
                  <Wrench size={17} /> Otwórz kreator <ArrowRight size={16} />
                </button>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
