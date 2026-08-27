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
    <header className="fixed top-0 left-0 right-0 z-40 flex justify-center px-6 pointer-events-none bg-[#151515] text-white" style={{ paddingTop: 0 }}>
      <div className="pointer-events-auto w-full max-w-[1440px] border-b border-white/20 px-0 flex items-center justify-between h-20">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none text-inherit">
          <img src="/logo.svg" alt="SiteMorph" width="28" height="28" className="rounded-lg" />
          <span className="font-bold text-base tracking-[-0.04em]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Site<span className="font-bold text-base tracking-[-0.04em]" style={{ fontFamily: "'Inter', sans-serif", color: '#ffffff' }}>MORPH</span></span>
        </button>
        <nav className="hidden md:flex items-center gap-6 text-xs font-bold opacity-90">
          <button onClick={() => scrollToId('jak-to-dziala')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Jak to działa</button>
          <button onClick={() => scrollToId('funkcje')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Funkcje</button>
          <button onClick={() => goTab('leadfinder')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Lead Finder</button>
          <button onClick={() => goTab('finance')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Rozliczenia</button>
          <button onClick={() => goTab('pricing')} className="hover:text-emerald-500 transition-colors bg-transparent border-none font-bold cursor-pointer">Cennik</button>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer border-none bg-transparent text-white" title="Zmień motyw">
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
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-full hover:bg-white/10 border-none bg-transparent text-white cursor-pointer">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-[72px] left-4 right-4 bg-[#151515] text-white border border-white/20 shadow-xl p-4 flex flex-col gap-2 md:hidden pointer-events-auto">
            {[
              ['Jak to działa', () => scrollToId('jak-to-dziala')],
              ['Funkcje', () => scrollToId('funkcje')],
              ['Lead Finder', () => goTab('leadfinder')],
              ['Rozliczenia', () => goTab('finance')],
              ['Cennik', () => goTab('pricing')],
            ].map(([label, fn]) => (
              <button key={label as string} onClick={fn as any} className="text-left px-3 py-2.5 hover:bg-white/10 font-bold text-sm">{label as string}</button>
            ))}
            <div className="border-t border-white/20 pt-3 flex gap-2">
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
