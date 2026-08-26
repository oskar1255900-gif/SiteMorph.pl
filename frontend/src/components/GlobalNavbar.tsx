import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Moon,
  X,
  Menu,
} from 'lucide-react';
import { Button } from '../components/ui';
import { Lead } from '../types';

export const GlobalNavbar = ({
  theme, setTheme, session, onShowAuth, onLogout, onEnterApp, setActiveTab, currentView, setCurrentView,
}: {
  theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void;
  session: any; onShowAuth: () => void; onLogout: () => void;
  onEnterApp: (tab?: string) => void; setActiveTab: (t: string) => void;
  currentView: 'landing' | 'app'; setCurrentView: (v: 'landing' | 'app') => void;
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  // W panelu/app (dashboard, builder, leadfinder) - UKRYJ NAVBAR całkowicie (jest Sidebar/MobileNav)
  if (currentView === 'app') {
    return null;
  }
  const scrollToId = (id: string) => {
    if (currentView !== 'landing') { setCurrentView('landing'); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100); }
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };
  const goTab = (tab: string) => {
    if (currentView === 'landing') onEnterApp(tab);
    else setActiveTab(tab);
    setMobileOpen(false);
  };
  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none" style={{ paddingTop: '24px' }}>
      <div className="pointer-events-auto w-full max-w-5xl backdrop-blur-2xl border rounded-full px-5 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_18px_60px_rgba(0,0,0,0.18)] flex items-center justify-between h-16 bg-white/80 dark:bg-zinc-950/80 border-black/5 dark:border-white/10 text-zinc-900 dark:text-white" style={{ backdropFilter: 'blur(24px) saturate(180%)' }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none text-inherit">
          <img src="/logo.svg" alt="SiteMorph" width="28" height="28" className="rounded-lg" />
          <span className="font-black text-base tracking-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Site<span className="font-black text-base tracking-tight" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, color: '#a3e635' }}>MORPH</span></span>
        </button>
        <nav className="hidden md:flex items-center gap-6 text-xs font-bold opacity-90">
          <button onClick={() => scrollToId('jak-to-dziala')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Jak to działa</button>
          <button onClick={() => scrollToId('funkcje')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Funkcje</button>
          <button onClick={() => goTab('leadfinder')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Lead Finder</button>
          <button onClick={() => goTab('finance')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Rozliczenia</button>
          <button onClick={() => goTab('pricing')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Cennik</button>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 rounded-full hover:bg-[#F7F6F3] dark:hover:bg-neutral-900 cursor-pointer border-none bg-transparent" title="Zmień motyw">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="hidden sm:flex items-center gap-2">
            {session ? (
              <>
                <span className="text-xs font-bold opacity-60 max-w-[120px] truncate hidden lg:block">{session.user?.email}</span>
                <button onClick={onLogout} className="text-xs font-bold hover:text-rose-500 bg-transparent border-none cursor-pointer">Wyloguj</button>
              </>
            ) : (
              <button onClick={onShowAuth} className="text-xs font-bold hover:text-emerald-500 bg-transparent border-none cursor-pointer">Zaloguj się</button>
            )}
            <Button variant="primary" size="sm" onClick={() => goTab('dashboard')} className="px-4 font-black">Zacznij teraz</Button>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-full hover:bg-[#F7F6F3] dark:hover:bg-neutral-900 border-none bg-transparent cursor-pointer">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-[72px] left-4 right-4 bg-white dark:bg-black border border-[#EAEAEA] dark:border-neutral-800 rounded-2xl shadow-xl p-4 flex flex-col gap-2 md:hidden pointer-events-auto">
            {[
              ['Jak to działa', () => scrollToId('jak-to-dziala')],
              ['Funkcje', () => scrollToId('funkcje')],
              ['Lead Finder', () => goTab('leadfinder')],
              ['Rozliczenia', () => goTab('finance')],
              ['Cennik', () => goTab('pricing')],
            ].map(([label, fn]) => (
              <button key={label as string} onClick={fn as any} className="text-left px-3 py-2.5 rounded-xl hover:bg-[#F7F6F3] dark:hover:bg-neutral-900 font-bold text-sm">{label as string}</button>
            ))}
            <div className="border-t border-[#EAEAEA] dark:border-neutral-800 pt-3 flex gap-2">
              {session ? <Button variant="outline" size="sm" onClick={onLogout} className="flex-1">Wyloguj</Button> : <Button variant="outline" size="sm" onClick={onShowAuth} className="flex-1">Zaloguj się</Button>}
              <Button variant="primary" size="sm" onClick={() => goTab('dashboard')} className="flex-1">Zacznij</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

// ============================================================================
