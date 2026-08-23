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
  
  // Na landingu pokaż navbar z linkami do sekcji
  // W app pokaż navbar z user menu
  // Na builderze nie pokazuj navbar (ma własny header)
  
  if (currentView === 'landing') {
    return (
      <header className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-3 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-5xl backdrop-blur-xl border rounded-xl py-2.5 px-5 shadow-lg flex items-center justify-between bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 text-blue-600 dark:text-white">
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
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-neutral-900 cursor-pointer border-none bg-transparent" title="Zmień motyw">
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
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-full hover:bg-blue-50 dark:hover:bg-neutral-900 border-none bg-transparent cursor-pointer">
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-[72px] left-4 right-4 bg-white dark:bg-black border border-blue-200 dark:border-neutral-800 rounded-2xl shadow-xl p-4 flex flex-col gap-2 md:hidden pointer-events-auto">
              {[
                ['Jak to działa', () => scrollToId('jak-to-dziala')],
                ['Funkcje', () => scrollToId('funkcje')],
                ['Lead Finder', () => goTab('leadfinder')],
                ['Rozliczenia', () => goTab('finance')],
                ['Cennik', () => goTab('pricing')],
              ].map(([label, fn]) => (
                <button key={label as string} onClick={fn as any} className="text-left px-3 py-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-neutral-900 font-bold text-sm">{label as string}</button>
              ))}
              <div className="border-t border-blue-100 dark:border-neutral-800 pt-3 flex gap-2">
                {session ? <Button variant="outline" size="sm" onClick={onLogout} className="flex-1">Wyloguj</Button> : <Button variant="outline" size="sm" onClick={onShowAuth} className="flex-1">Zaloguj się</Button>}
                <Button variant="primary" size="sm" onClick={() => goTab('dashboard')} className="flex-1">Zacznij</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    );
  }

  // App view navbar - uproszczony, bez linków do sekcji landingu
  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-5xl backdrop-blur-xl border rounded-xl py-2.5 px-5 shadow-lg flex items-center justify-between bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 text-blue-600 dark:text-white">
        <button onClick={() => setCurrentView('landing')} className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none text-inherit">
          <img src="/logo.svg" alt="SiteMorph" width="28" height="28" className="rounded-lg" />
          <span className="font-black text-base tracking-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Site<span className="font-black text-base tracking-tight" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, color: '#a3e635' }}>MORPH</span></span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-neutral-900 cursor-pointer border-none bg-transparent" title="Zmień motyw">
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
            <Button variant="primary" size="sm" onClick={() => setCurrentView('landing')} className="px-4 font-black">Powrót do strony</Button>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-full hover:bg-blue-50 dark:hover:bg-neutral-900 border-none bg-transparent cursor-pointer">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-[72px] left-4 right-4 bg-white dark:bg-black border border-blue-200 dark:border-neutral-800 rounded-2xl shadow-xl p-4 flex flex-col gap-2 md:hidden pointer-events-auto">
            <div className="border-t border-blue-100 dark:border-neutral-800 pt-3 flex gap-2">
              {session ? <Button variant="outline" size="sm" onClick={onLogout} className="flex-1">Wyloguj</Button> : <Button variant="outline" size="sm" onClick={onShowAuth} className="flex-1">Zaloguj się</Button>}
              <Button variant="primary" size="sm" onClick={() => setCurrentView('landing')} className="flex-1">Strona główna</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

// ============================================================================
