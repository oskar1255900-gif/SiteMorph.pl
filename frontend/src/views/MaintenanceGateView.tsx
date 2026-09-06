import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { sha256Hex } from '../lib/shared';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260820_010308_b1636845-4c15-4ab6-b0c9-9a29bfb0c6e3.mp4';

/**
 * Brama "Strona w budowie" - premium cinematic landing.
 * - Password verified server-side via SHA-256 hash
 * - Background: Palomar lake landscape video with blur + tint
 * - Headline: animated gradient text (pink → green → blue)
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070709] text-white font-sans">
      {/* Gradient keyframe styles */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-word {
          background: linear-gradient(
            135deg,
            #c9b8a8 0%,
            #e8ddd3 25%,
            #f5f0eb 50%,
            #d4c5b5 75%,
            #c9b8a8 100%
          );
          background-size: 200% 200%;
          animation: gradient-shift 8s ease infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* Background video with subtle blur */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover pointer-events-none"
          style={{ filter: 'blur(3px) brightness(0.55) saturate(0.9)' }}
          src={VIDEO_URL}
        />
        {/* Dark tint */}
        <div className="absolute inset-0 bg-[#070709]/40" />
        {/* Subtle vignette */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(7,7,9,0.5) 100%)'
        }} />
      </div>

      {/* Panel button - top right */}
      <div className="absolute top-5 right-6 z-20">
        <button
          onClick={() => setPanelOpen(true)}
          className="group relative px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[11px] font-medium tracking-[0.22em] uppercase text-white/40 hover:text-white/80 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
        >
          <span className="relative z-10">Panel</span>
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
          {/* Brand mark */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400/30 to-blue-400/30 border border-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <span className="text-sm font-medium tracking-[0.3em] uppercase text-white/30">SiteMorph</span>
          </motion.div>

          {/* Headline: 'Budowa' has gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] text-white"
          >
            Strona w <span className="gradient-word">budowie</span>
          </motion.h1>

          {/* Subtitle: 'nowego' has gradient */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-md text-base md:text-lg leading-[1.6] text-white/40"
          >
            Składamy coś <span className="gradient-word">nowego</span>. Wróć za chwilę.
          </motion.p>

          {/* Decorative line */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        </motion.div>
      </div>

      {/* Password modal */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
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
