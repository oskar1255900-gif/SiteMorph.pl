import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ArrowUp,
  Search,
  GraduationCap,
  Wrench,
  Receipt,
  Image as ImageIcon,
  Palette,
} from 'lucide-react';
import { cineChild, cineParent, springTransition } from '../lib/shared';
import { API_BASE } from '../lib/api';

/* ============================================================================
   DASHBOARD CSS — no borders, surface differences, clean composition
   ========================================================================== */

const COMPOSER_CSS = `
.dm-root { position: relative; min-height: 100%; }

.dm-shell { position: relative; z-index: 1; padding: 28px 20px 40px; }
@media (min-width: 768px) { .dm-shell { padding: 40px 32px 56px; } }

.dm-h1 {
  font-size: clamp(24px, 2.8vw, 32px);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.032em;
  color: var(--sm-text);
}

/* Composer — the central element, no border, surface difference */
.dm-composer {
  width: 100%;
  border-radius: 15px;
  background: var(--sm-surface);
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 144px;
  transition: background-color 0.15s ease;
}
.dm-composer:focus-within {
  background: var(--sm-surface-elevated);
  box-shadow: var(--sm-shadow);
}

.dm-input {
  flex: 1;
  width: 100%;
  min-height: 84px;
  padding: 16px 16px 6px;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--sm-text);
  font-family: inherit;
  font-size: 15px;
  line-height: 1.55;
  resize: none;
}
.dm-input::placeholder { color: var(--sm-text-quiet); }

.dm-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 12px;
  flex-wrap: wrap;
}
.dm-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: none;
  background: var(--sm-surface-hover);
  color: var(--sm-text-secondary);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}
.dm-chip:hover { background: var(--sm-surface-elevated); color: var(--sm-text); }

.dm-send {
  width: 44px; height: 44px;
  border-radius: 12px;
  border: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: var(--sm-accent);
  color: var(--sm-accent-ink);
  transition: background-color 0.15s ease, opacity 0.15s ease;
}
.dm-send:hover:not(:disabled) { background: var(--sm-accent-hover); }
.dm-send:active:not(:disabled) { transform: scale(0.96); }
.dm-send:disabled { opacity: 0.4; cursor: not-allowed; }

.dm-count {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--sm-text-quiet);
  padding: 0 4px;
}

/* Quick actions — surface difference, no border */
.dm-action {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 17px;
  border-radius: 13px;
  background: var(--sm-surface);
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
  width: 100%;
}
.dm-action:hover { background: var(--sm-surface-hover); }

/* Projects section — no border, surface difference */
.dm-projects {
  border-radius: 15px;
  background: var(--sm-surface);
  padding: 20px;
}

@media (prefers-reduced-motion: no-preference) {
  .dm-a-in { animation: dm-rise 0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .dm-a-in-2 { animation: dm-rise 0.45s cubic-bezier(0.16,1,0.3,1) 0.08s both; }
}
@keyframes dm-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
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
      setAttachments((prev) => [...prev, ...files.map((f) => f.name)]);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleSendPrompt = () => {
    if (!promptInput.trim() && attachments.length === 0) return;
    let full = promptInput.trim();
    if (attachments.length) full += `\nZdjęcia do wykorzystania na stronie (użyj jako src w <img>): ${attachments.join(', ')}`;
    if (styleLabel !== 'Styl dnia') full += `\nStyl: ${styleLabel}`;
    onLaunchBuilderWithPrompt(full);
    setAttachments([]);
    setStyleLabel('Styl dnia');
  };

  const quickActions = [
    { label: 'Kreator AI', desc: 'Opisz stronę i generuj podgląd', icon: Wrench, tab: 'builder' },
    { label: 'Lead Finder', desc: 'Firmy bez strony', icon: Search, tab: 'leadfinder' },
    { label: 'Płatności', desc: 'Faktury bez prowizji', icon: Receipt, tab: 'finance' },
    { label: 'Poradniki', desc: 'Materiały o sprzedaży', icon: GraduationCap, tab: 'tutorials' },
  ];

  const canSend = Boolean(promptInput.trim()) || attachments.length > 0;

  return (
    <div className="dm-root">
      <style>{COMPOSER_CSS}</style>
      <div className="dm-shell">
        <div className="mx-auto max-w-4xl">
          {/* COMPOSER */}
          <h1 className="dm-h1 dm-a-in">Opisz stronę, a ja ją zbuduję.</h1>
          <p className="mt-2.5 max-w-xl text-[14.5px] leading-[1.6] text-[var(--sm-text-secondary)] dm-a-in">
            Napisz kilka zdań o firmie. Układ, kolory i teksty dobiorę do Twojej branży.
          </p>

          <form
            className="dm-composer dm-a-in-2 mt-6"
            onSubmit={(e) => { e.preventDefault(); handleSendPrompt(); }}
          >
            <textarea
              className="dm-input"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault(); handleSendPrompt();
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
              <button type="button" className="dm-chip" onClick={cycleStyle} title="Wybierz nastrój strony">
                <Palette size={16} /> {styleLabel}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onAttach} />

              <div className="ml-auto flex items-center gap-3">
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

          {/* QUICK ACTIONS — surface-based, no borders */}
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
                className="dm-action"
              >
                <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--sm-surface-hover)]">
                  <a.icon size={17} className="text-[var(--sm-accent)]" />
                </span>
                <span className="block">
                  <span className="block text-[14px] font-semibold tracking-[-0.01em]">{a.label}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-[var(--sm-text-secondary)]">{a.desc}</span>
                </span>
              </motion.button>
            ))}
          </motion.div>

          {/* PROJECTS — no border, surface difference */}
          <div className="dm-projects mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Moje projekty</h2>
              <button
                onClick={() => setActiveTab('builder')}
                className="sm-btn sm-btn-ghost ml-auto min-h-[44px]"
              >
                <Wrench size={16} /> Nowy projekt
              </button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col items-start gap-3 pt-5 sm:flex-row sm:items-center"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[var(--sm-surface-hover)]">
                <Sparkles size={18} className="text-[var(--sm-text-quiet)]" />
              </span>
              <p className="min-w-0 flex-1 text-[14px] leading-[1.55] text-[var(--sm-text-secondary)]">
                Nie masz jeszcze projektów. Opisz stronę w polu powyżej.
              </p>
              <button onClick={() => setActiveTab('builder')} className="sm-btn shrink-0">
                <Wrench size={16} /> Otwórz kreator <ArrowRight size={15} />
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
