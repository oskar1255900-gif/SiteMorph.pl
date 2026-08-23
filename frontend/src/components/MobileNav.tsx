import { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  LogOut,
  Settings,
  Sun,
  Moon,
  X,
  Coins,
  Menu,
} from 'lucide-react';
import { springTransition } from '../lib/shared';
import { SIDEBAR_MENU } from './DashboardSidebar';

export const MobileNav = ({
  activeTab,
  setActiveTab,
  onExit,
  theme,
  setTheme,
  credits
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onExit: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  credits: number;
}) => {
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [activeTab])
  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 z-40 flex items-center justify-between px-3 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-blue-100 dark:border-neutral-900 text-blue-600 dark:text-white">
        <button onClick={onExit} className="flex items-center gap-2 cursor-pointer bg-transparent border-none text-inherit p-1.5 rounded-lg active:scale-95 transition-transform">
            <img src="/logo.svg" alt="SiteMorph" width="28" height="28" className="rounded-lg shadow-md" />
            <span className="font-black text-sm tracking-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Site<span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, color: '#a3e635' }}>MORPH</span></span>
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-black px-2 py-1 rounded-full bg-blue-50 dark:bg-neutral-900 border border-blue-100 dark:border-neutral-800">{credits} kr.</span>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Motyw" className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-neutral-900 cursor-pointer border-none bg-transparent text-blue-600 dark:text-white">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => setOpen(true)} aria-label="Menu" className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-neutral-900 cursor-pointer border-none bg-transparent text-blue-600 dark:text-white">
            <Menu size={18} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring' as const, stiffness: 380, damping: 34 }}
              className="lg:hidden fixed top-0 bottom-0 left-0 w-[272px] z-50 flex flex-col justify-between bg-white dark:bg-black border-r border-blue-100 dark:border-neutral-900 shadow-2xl text-blue-600 dark:text-white select-none"
            >
              <div>
                <div className="h-14 flex items-center justify-between px-4 border-b border-blue-100 dark:border-neutral-900">
                  <span className="font-black text-base tracking-tight" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Site<span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, color: '#a3e635' }}>MORPH</span></span>
                  <button onClick={() => setOpen(false)} aria-label="Zamknij" className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-neutral-900 cursor-pointer border-none bg-transparent"><X size={17} /></button>
                </div>
                <LayoutGroup id="mobile-nav">
                  <div className="p-3 space-y-1">
                    <div className="text-[10px] font-black tracking-wider uppercase px-3 py-2 opacity-70">MENU GŁÓWNE</div>
                    {SIDEBAR_MENU.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full relative flex items-center justify-between px-3 py-3 rounded-xl text-xs font-black transition-colors cursor-pointer border-none ${
                            isActive ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white hover:bg-blue-50/60 dark:hover:bg-neutral-900/60'
                          }`}
                        >
                          {isActive && (
                            <motion.div layoutId="mobileActivePill" transition={springTransition} className="absolute inset-0 bg-blue-600 dark:bg-white rounded-xl shadow-md" />
                          )}
                          <div className="flex items-center gap-2.5 relative z-10">
                            <item.icon size={16} className={isActive ? 'text-white dark:text-black' : ''} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className={`relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white text-blue-600 dark:bg-black dark:text-white' : 'bg-blue-100 text-blue-800 dark:bg-neutral-800 dark:text-white'}`}>{item.badge}</span>
                          )}
                        </motion.button>
                      );
                    })}
                    <button
                      onClick={() => setActiveTab('settings')}
                      className={`w-full relative flex items-center gap-2.5 px-3 py-3 mt-2 rounded-xl text-xs font-black transition-colors cursor-pointer border-none ${
                        activeTab === 'settings' ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white hover:bg-blue-50/60 dark:hover:bg-neutral-900/60'
                      }`}
                    >
                      <Settings size={16} className="relative z-10" />
                      <span className="relative z-10">Ustawienia</span>
                    </button>
                  </div>
                </LayoutGroup>
              </div>
              <div className="p-3 space-y-2 border-t border-blue-100 dark:border-neutral-900">
                <div className="p-3 rounded-2xl border flex items-center justify-between bg-blue-50/50 dark:bg-neutral-950 border-blue-200 dark:border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white dark:bg-white dark:text-black flex items-center justify-center font-black"><Coins size={16} /></div>
                    <div>
                      <div className="text-xs font-black">{credits} kredytów</div>
                      <div className="text-[10px] font-bold opacity-80">{credits > 0 ? 'Pakiet aktywny' : 'Darmowy pakiet'}</div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('pricing')} className="text-[11px] font-black text-emerald-500 dark:text-emerald-400 hover:underline cursor-pointer bg-transparent border-none">Doładuj</button>
                </div>
                <div className="p-2 flex items-center justify-between rounded-xl hover:bg-blue-50 dark:hover:bg-neutral-900 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white dark:bg-white dark:text-black font-black text-xs flex items-center justify-center shadow-sm">O</div>
                    <div className="min-w-0">
                      <div className="text-xs font-black truncate">oskar1255900</div>
                      <div className="text-[10px] font-bold opacity-80">Darmowy plan</div>
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={onExit} className="p-1 text-blue-600 dark:text-white hover:text-rose-500 cursor-pointer bg-transparent border-none" title="Wyloguj">
                    <LogOut size={15} />
                  </motion.button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ============================================================================
// 8. WIDOK: DASHBOARD GŁÓWNY
// ============================================================================
