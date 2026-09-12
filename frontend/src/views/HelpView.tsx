import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  Send,
  Check,
  X,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cineChild, cineParent, cineSoft, itemVariants, sha256Hex } from '../lib/shared';
import { apiFetch } from '../lib/api';

import { AdminPanel } from '../components/AdminPanel';
export const HelpView = ({ credits, setCredits }: { credits: number; setCredits: React.Dispatch<React.SetStateAction<number>> }) => {
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminErr, setAdminErr] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const inputClasses = "sm-input text-[15px]";

  const handleAdminLogin = async () => {
    if (!adminPass.trim()) { setAdminErr('Wpisz hasło'); return; }
    setAdminLoading(true);
    setAdminErr('');
    try {
      const hash = await sha256Hex(adminPass);
      const res = await apiFetch('/api/admin/verify', { method: 'POST', body: JSON.stringify({ hash }) });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        // Backend wymaga tego hasha w nagłówku X-Admin-Hash przy GET /api/admin/stats
        sessionStorage.setItem('sitemorph-admin-hash', hash);
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
      className="mx-auto max-w-5xl px-5 py-8 pb-16 text-[var(--sm-text)]"
      style={{ perspective: 1200 }}
    >
      <motion.div variants={cineSoft} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-blue-100 dark:bg-neutral-900 text-[#2563eb] dark:text-white border border-[#EAEAEA] dark:border-neutral-800">
          <HelpCircle size={22} />
        </div>
        <div>
          <h1 className="sm-h1">Pomoc</h1>
          <p className="text-[13px] font-bold opacity-80">Masz pytanie? Odpowiadamy zazwyczaj w 24h.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <motion.div variants={cineParent} initial="hidden" animate="visible" className="md:col-span-4 space-y-4">
          <motion.div variants={cineChild} className="rounded-2xl p-5 border shadow-xl bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900">
            <h3 className="text-sm font-semibold mb-1">Kontakt bezpośredni</h3>
            <p className="text-[13px] font-bold mb-3 opacity-80">Napisz bezpośrednio na nasz email:</p>
            <a href="mailto:support@sitemorph.ai" className="inline-flex min-h-[44px] items-center text-[15px] font-medium text-[var(--sm-accent)] hover:underline">support@sitemorph.ai</a>
          </motion.div>
          <div className="flex justify-center pt-1">
            <button onClick={() => setShowAdminLogin(true)} className="min-h-[44px] border-none bg-transparent px-3 text-[13px] font-medium uppercase tracking-widest opacity-[0.18] transition-opacity hover:opacity-60 cursor-pointer select-none">
              Panel
            </button>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="md:col-span-8 rounded-2xl p-8 border shadow-xl bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900">
          {sent ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12 space-y-3"
            >
              <div className="w-12 h-12 bg-emerald-400 text-black rounded-full flex items-center justify-center mx-auto mb-2 font-semibold shadow-md">
                <Check size={24} />
              </div>
              <h3 className="text-[19px] font-semibold">Wiadomość wysłana</h3>
              <p className="text-[13px] font-bold opacity-80">Odpowiadamy najszybciej jak to możliwe.</p>
              <button onClick={() => setSent(false)} className="text-[13px] font-semibold text-emerald-400 hover:underline pt-2 cursor-pointer bg-transparent border-none">Wyślij kolejną</button>
            </motion.div>
          ) : (
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <div>
                <label className="sm-label">Czego dotyczy zgłoszenie?</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Sugerowana funkcja', 'Błąd na stronie', 'Pytanie ogólne', 'Inne'].map((item, idx) => (
                    <label key={idx} className="sm-card-quiet flex min-h-[52px] cursor-pointer items-center gap-3 p-3 text-[15px] transition-colors hover:border-[var(--sm-border-strong)]">
                      <input type="radio" name="category" defaultChecked={idx === 0} className="h-5 w-5 accent-[var(--sm-accent)]" />
                      {item}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="sm-label">Twoja wiadomość</label>
                <textarea
                  rows={4}
                  required
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Opisz swój problem lub pytanie..."
                  className={`${inputClasses} resize-none`}
                />
              </div>

              <Button variant="primary" size="lg" type="submit" className="w-full">
                <Send size={17} /> Wyślij zgłoszenie
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
              transition={{ type: 'spring' as const, stiffness: 340, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-950 border border-[#EAEAEA] dark:border-neutral-800 shadow-2xl p-6 space-y-4"
            >
              <div className="relative flex items-center justify-between">
                <h3 className="text-base font-semibold" style={{ fontFamily: "'Inter', sans-serif" }}>Panel administratora</h3>
                <button onClick={() => { setShowAdminLogin(false); setAdminErr(''); }} className="w-7 h-7 rounded-full grid place-items-center bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-neutral-800 cursor-pointer">
                  <X size={12} />
                </button>
              </div>
              <p className="relative text-[13px] font-bold opacity-70">Wpisz hasło administratora. Weryfikacja odbywa się wyłącznie po stronie serwera.</p>
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin(); }}
                placeholder="Hasło administratora"
                className="sm-input text-[15px]"
                autoFocus
              />
              {adminErr && <p className="text-[13px] font-semibold text-rose-600 dark:text-rose-400">{adminErr}</p>}
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
// Auth Modal - Supabase Google + Email
// ============================================================================
