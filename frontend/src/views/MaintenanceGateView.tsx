import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { sha256Hex } from '../lib/shared';

/**
 * Brama "Strona w budowie".
 * - Hasło weryfikowane po stronie serwera przez SHA-256
 * - Czyste tło i powierzchnie z tokenów motywu — bez dekoracyjnego wideo
 *   i bez gradientów
 * - Font: SF Pro Display (Apple system font fallback)
 */
export const MaintenanceGateView = ({ onUnlock }: { onUnlock: () => void }) => {
  const [checking, setChecking] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/gate/check', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { unlocked: false }))
      .then((d) => {
        if (d?.unlocked) onUnlock();
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [onUnlock]);

  const submit = async () => {
    if (!pass.trim() || busy) return;
    setBusy(true);
    setErr('');
    try {
      const hash = await sha256Hex(pass);
      const res = await fetch('/api/admin/gate/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash }),
      });
      if (res.ok) {
        onUnlock();
      } else {
        const d = await res.json().catch(() => null);
        setErr(d?.detail || 'Nieprawidłowe hasło');
        setPass('');
      }
    } catch {
      setErr('Brak połączenia z serwerem');
    } finally {
      setBusy(false);
    }
  };

  // Zanim poznamy wynik `/api/admin/gate/check`, nie pokazujemy ani komunikatu
  // „Strona w budowie”, ani treści aplikacji — użytkownik z ważnym dostępem
  // nie może zobaczyć błęnego ekranu przy każdym wejściu czy po logowaniu.
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--sm-bg)] text-[var(--sm-text)]" role="status" aria-live="polite">
        <span
          className="h-5 w-5 animate-spin rounded-full"
          style={{ border: '2px solid var(--sm-surface-hover)', borderTopColor: 'var(--sm-accent)' }}
          aria-label="Sprawdzam dostęp"
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--sm-bg)] font-sans text-[var(--sm-text)]">

      {/* Wejście do panelu — celowo dyskretne, ale z pełnym obszarem dotyku 44px */}
      <div className="absolute right-4 top-3 z-20">
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Dostęp do panelu"
          className="inline-flex min-h-[44px] cursor-pointer items-center border-none bg-transparent px-3 text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--sm-text-quiet)] transition-colors duration-300 hover:text-[var(--sm-text)]"
        >
          Panel
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center max-w-2xl"
        >
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--sm-text)] md:text-[54px]"
          >
            Strona w budowie
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 max-w-md text-[16px] leading-[1.6] text-[var(--sm-text-secondary)]"
          >
            Wracamy za chwilę. Odśwież stronę za kilka minut.
          </motion.p>

        </motion.div>
      </div>

      {/* Password modal */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPanelOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 14, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[18px] bg-[var(--sm-surface-elevated)] p-7 shadow-[var(--sm-shadow-lg)]"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--sm-surface-hover)]">
                  <Lock size={18} className="text-[var(--sm-text-secondary)]" />
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-[var(--sm-text)]">Dostęp do panelu</h3>
                  <p className="text-[14px] text-[var(--sm-text-secondary)]">Wprowadź hasło, aby kontynuować</p>
                </div>
              </div>
              <input
                type="password"
                value={pass}
                autoFocus
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Hasło"
                className="min-h-[48px] w-full rounded-[14px] border-none bg-[var(--sm-control-bg)] px-4 py-3 text-[16px] text-[var(--sm-text)] outline-none transition-shadow placeholder:text-[var(--sm-text-quiet)] focus-visible:ring-2 focus-visible:ring-[var(--sm-accent)]"
              />
              {err && (
                <p className="mt-3 flex items-center gap-1.5 text-[14px] text-[var(--sm-danger)]">
                  <AlertTriangle size={14} /> {err}
                </p>
              )}
              <button
                onClick={submit}
                disabled={busy || !pass.trim()}
                className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--sm-accent)] px-5 text-[15px] font-semibold text-[var(--sm-accent-ink)] transition-all hover:bg-[var(--sm-accent-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Wejdź
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
