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
      <div className="absolute inset-0 bg-black/60 " onClick={onClose} />
      <motion.div initial={{ y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, scale: 0.97, opacity: 0 }} transition={springTransition} className="relative w-full max-w-[460px] rounded-2xl border bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800 shadow-[0_16px_48px_rgba(37,99,235,0.12)] overflow-hidden text-[#2563eb] dark:text-white">
        {/* Nagłówek z gradientem */}
        <div className="relative px-8 pt-8 pb-6 text-center bg-gradient-to-b from-blue-50 to-transparent dark:from-neutral-900 dark:to-transparent">
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-2xl grid place-items-center hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors text-[#2563eb] dark:text-white"><X size={16} /></button>
          <div className="w-14 h-14 rounded-2xl bg-[#111111] text-white dark:bg-white dark:text-black grid place-items-center mx-auto mb-4 shadow-lg shadow-blue-600/25 dark:shadow-white/10">
            <Zap size={26} className="fill-current" />
          </div>
          <h3 className="text-xl font-black tracking-tight text-[#2563eb] dark:text-white">{mode === 'login' ? 'Zaloguj się do SiteMorph' : 'Załóż konto SiteMorph'}</h3>
          <p className="text-xs font-semibold opacity-60 mt-1 text-[#2563eb] dark:text-white">Twoje leady i strony będą przypisane do konta</p>
        </div>

        <div className="px-8 pb-8 space-y-5">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 font-black text-[15px] text-[#2563eb] dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 015.48 12c0-.73.13-1.43.36-2.09V7.07H2.18A11 11 0 001 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Kontynuuj przez Google
          </motion.button>

          <div className="flex items-center gap-3 text-[11px] font-bold opacity-40 text-[#2563eb] dark:text-white"><span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800"/><span>LUB EMAILEM</span><span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800"/></div>

          <form onSubmit={handleEmail} className="space-y-3.5">
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@firma.pl"
              className="w-full rounded-2xl border px-4 py-3.5 text-[15px] font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-[#2563eb] dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500" />
            <input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Hasło (min. 6 znaków)"
              className="w-full rounded-2xl border px-4 py-3.5 text-[15px] font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-[#2563eb] dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500" />
            {err && <p className="text-[13px] font-bold text-rose-600">{err}</p>}
            {msg && <p className="text-[13px] font-bold text-emerald-600">{msg}</p>}
            <motion.button whileTap={{ scale: 0.99 }} type="submit" disabled={loading}
              className="w-full py-4 rounded-2xl bg-[#111111] text-white dark:bg-white dark:text-black font-black text-[15px] disabled:opacity-50 shadow-lg shadow-blue-600/25 dark:shadow-white/10">
              {loading ? 'Chwilka…' : mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
            </motion.button>
          </form>

          <p className="text-center text-sm font-semibold opacity-70 text-[#2563eb] dark:text-white">
            {mode === 'login' ? 'Nie masz jeszcze konta? ' : 'Masz już konto? '}
            <button onClick={()=>{setMode(mode==='login'?'register':'login'); setErr(''); setMsg('')}} className="font-black underline underline-offset-2 text-[#2563eb] dark:text-white">{mode === 'login' ? 'Zarejestruj się' : 'Zaloguj się'}</button>
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Globalny sticky navbar - zawsze widoczny (landing + app)
