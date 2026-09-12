import * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  X,
} from 'lucide-react';
import { springTransition } from '../lib/shared';
import { supabase } from '../lib/supabase';

export const AuthModal = ({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) => {
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
    // redirect nastąpi - nie trzeba zamykać
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setMsg(''); setLoading(true)
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Sprawdź email - wysłaliśmy link potwierdzający. Potem zaloguj się.')
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, scale: 0.97, opacity: 0 }} transition={springTransition} className="sm-scroll relative max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-[14px] border border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text)]">
        {/* Nagłówek z gradientem */}
        <div className="relative px-6 pb-5 pt-7 text-center sm:px-8">
          <button onClick={onClose} aria-label="Zamknij" className="sm-icon-btn absolute right-3 top-3"><X size={19} /></button>
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[12px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)]">
            <Zap size={26} className="text-[var(--sm-accent)]" />
          </div>
          <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{mode === 'login' ? 'Zaloguj się do SiteMorph' : 'Załóż konto SiteMorph'}</h3>
          <p className="mt-1.5 text-[15px] text-[var(--sm-text-2)]">Twoje leady i strony będą przypisane do konta</p>
        </div>

        <div className="space-y-5 px-6 pb-7 sm:px-8">
          <motion.button whileTap={{ scale: 0.99 }} onClick={handleGoogle} disabled={loading}
            className="sm-btn min-h-[48px] w-full gap-3 text-[15px]">
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 015.48 12c0-.73.13-1.43.36-2.09V7.07H2.18A11 11 0 001 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Kontynuuj przez Google
          </motion.button>

          <div className="flex items-center gap-3 text-[13px] font-medium text-[var(--sm-text-3)]">
            <span className="h-px flex-1 bg-[var(--sm-border)]"/><span>LUB EMAILEM</span><span className="h-px flex-1 bg-[var(--sm-border)]"/>
          </div>

          <form onSubmit={handleEmail} className="space-y-3.5">
            <div>
              <label className="sm-label" htmlFor="auth-email">Adres e-mail</label>
              <input id="auth-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@firma.pl" className="sm-input text-[15px]" />
            </div>
            <div>
              <label className="sm-label" htmlFor="auth-password">Hasło</label>
              <input id="auth-password" type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 6 znaków" className="sm-input text-[15px]" />
            </div>
            {err && <p className="text-[14px] text-[var(--sm-danger)]" role="alert">{err}</p>}
            {msg && <p className="text-[14px] text-[var(--sm-success)]" role="status">{msg}</p>}
            <motion.button whileTap={{ scale: 0.99 }} type="submit" disabled={loading}
              className="sm-btn sm-btn-lg sm-btn-primary w-full">
              {loading ? 'Chwilka…' : mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
            </motion.button>
          </form>

          <p className="text-center text-[15px] text-[var(--sm-text-2)]">
            {mode === 'login' ? 'Nie masz jeszcze konta? ' : 'Masz już konto? '}
            <button onClick={()=>{setMode(mode==='login'?'register':'login'); setErr(''); setMsg('')}} className="bg-transparent border-none p-0 text-[15px] font-medium text-[var(--sm-accent)] underline underline-offset-2 cursor-pointer">{mode === 'login' ? 'Zarejestruj się' : 'Zaloguj się'}</button>
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Globalny sticky navbar - zawsze widoczny (landing + app)
