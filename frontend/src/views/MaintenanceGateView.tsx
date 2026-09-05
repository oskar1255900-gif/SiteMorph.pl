import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { sha256Hex } from '../lib/shared';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_124724_bc041163-d651-425f-aea3-2acc1efc2c96.mp4';

/**
 * Brama "Strona w budowie".
 * - Hasło NIE występuje w frontendzie: wysyłamy SHA-256 na /api/admin/gate/verify,
 *   backend porównuje z GATE_HASH (env) i ustawia httpOnly cookie.
 * - Frontend sprawdza cookie przez GET /api/admin/gate/check.
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f] text-white font-['Inter',sans-serif]">
      {/* tło wideo */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover pointer-events-none opacity-70"
          src={VIDEO_URL}
        />
        <div className="absolute inset-0 bg-black/45" />
      </div>

      {/* prawy górny róg — dyskretny przycisk Panel */}
      <div className="absolute top-5 right-6 z-20">
        <button
          onClick={() => setPanelOpen(true)}
          className="text-[11px] font-medium tracking-[0.22em] uppercase text-white/40 hover:text-white transition-colors duration-300 cursor-pointer"
        >
          Panel
        </button>
      </div>

      {/* treść główna */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-200" />
            </span>
      </div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/50">SiteMorph</p>
          <h1 className="text-4xl font-semibold tracking-tight leading-[1.02] md:text-6xl">
            Strona w budowie
          </h1>
          <p className="mt-5 max-w-md text-sm leading-[1.7] text-white/55">
            Składamy coś nowego. Wróć za chwilę — albo jeśli masz dostęp, wejdź przez Panel.
          </p>
        </motion.div>
      </div>

      {/* modal hasła */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#111118]/95 p-7 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <Lock size={16} className="text-white/80" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Dostęp do panelu</h3>
                  <p className="text-[11px] text-white/40">Wprowadź hasło, aby kontynuować</p>
                </div>
              </div>
              <input
                type="password"
                value={pass}
                autoFocus
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Hasło"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-cyan-300/50"
              />
              {err && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle size={12} /> {err}
                </p>
              )}
              <button
                onClick={submit}
                disabled={busy || !pass.trim()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
