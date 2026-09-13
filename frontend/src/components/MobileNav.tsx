import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  Settings,
  Sun,
  Moon,
  X,
  Coins,
  Menu,
  Zap,
} from 'lucide-react';
import { springTransition } from '../lib/shared';
import { SIDEBAR_MENU } from './DashboardSidebar';

export const MobileNav = ({
  activeTab,
  setActiveTab,
  onExit,
  theme,
  setTheme,
  credits,
  session
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onExit: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  credits: number;
  session: any;
}) => {
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [activeTab])

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return (
    <>
      {/* Top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-[60px] flex items-center justify-between px-4"
        style={{ background: 'var(--sm-bg)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="sm-icon-btn"
            aria-label="Menu"
          >
            <Menu size={22} />
          </button>
          <img src="/logo.svg" alt="" width="28" height="28" className="rounded-[8px]" />
          <span className="text-[17px] font-semibold tracking-[-0.03em]">
            Site<span className="sm-brand-gradient">Morph</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px]" style={{ background: 'var(--sm-surface)' }}>
            <Coins size={16} style={{ color: 'var(--sm-accent)' }} />
            <span className="text-[15px] font-semibold">{credits}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={springTransition}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="sm-icon-btn"
            aria-label="Zmień motyw"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </motion.button>
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] z-[61] flex flex-col lg:hidden overflow-y-auto"
              style={{ background: '#000000' }}
            >
              {/* Drawer header */}
              <div className="h-[72px] flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                  <img src="/logo.svg" alt="" width="32" height="32" className="rounded-[8px]" />
                  <span className="text-[19px] font-semibold tracking-[-0.02em]">
                    Site<span className="sm-brand-gradient">Morph</span>
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="sm-icon-btn"
                  aria-label="Zamknij menu"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Nav items */}
              <nav className="flex-1 px-4 space-y-1" aria-label="Menu mobilne">
                <div className="px-3 pb-2 pt-2 text-[12px] font-semibold uppercase tracking-widest" style={{ color: 'var(--sm-text-quiet)' }}>
                  Menu
                </div>
                {SIDEBAR_MENU.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setOpen(false); }}
                      className="w-full flex items-center gap-3.5 rounded-[10px] border-none bg-transparent cursor-pointer transition-all"
                      style={{
                        minHeight: '52px',
                        padding: '0 14px',
                        fontSize: '16px',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--sm-text)' : 'var(--sm-text-secondary)',
                        background: isActive ? 'var(--sm-surface)' : 'transparent',
                      }}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <item.icon size={22} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
                <div className="pt-2" style={{ borderTop: '1px solid var(--sm-border-subtle)' }} />
                <button
                  onClick={() => { setActiveTab('settings'); setOpen(false); }}
                  className="w-full flex items-center gap-3.5 rounded-[10px] border-none bg-transparent cursor-pointer transition-all"
                  style={{
                    minHeight: '52px',
                    padding: '0 14px',
                    fontSize: '16px',
                    fontWeight: activeTab === 'settings' ? 600 : 500,
                    color: activeTab === 'settings' ? 'var(--sm-text)' : 'var(--sm-text-secondary)',
                    background: activeTab === 'settings' ? 'var(--sm-surface)' : 'transparent',
                  }}
                  aria-current={activeTab === 'settings' ? 'page' : undefined}
                >
                  <Settings size={22} className="shrink-0" />
                  <span className="truncate">Ustawienia</span>
                </button>
              </nav>

              {/* Bottom */}
              <div className="px-4 pb-6 space-y-3">
                {/* Credits card */}
                <div className="rounded-[12px] p-4" style={{ background: '#0A0A0B' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px]" style={{ background: '#111113' }}>
                      <Zap size={18} style={{ color: 'var(--sm-accent)' }} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[16px] font-semibold leading-tight">{credits} kredytów</div>
                      <div className="text-[13px]" style={{ color: 'var(--sm-text-quiet)' }}>Pozostało</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setActiveTab('pricing'); setOpen(false); }}
                    className="w-full min-h-[42px] rounded-[10px] text-[14px] font-medium cursor-pointer border-none transition-colors flex items-center justify-center gap-2"
                    style={{ background: '#111113', color: 'var(--sm-text)' }}
                  >
                    <Coins size={15} /> Doładuj kredyty
                  </button>
                </div>

                {/* User */}
                <div className="flex items-center justify-between gap-3 px-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: '#111113' }}>
                      <span className="text-[13px] font-medium" style={{ color: 'var(--sm-text-quiet)' }}>
                        {(session?.user?.email?.[0] || 'U').toUpperCase()}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium" style={{ color: 'var(--sm-text)' }}>
                        {session?.user?.email?.split('@')[0] || 'Użytkownik'}
                      </div>
                      <div className="text-[12px]" style={{ color: 'var(--sm-text-quiet)' }}>Free Plan</div>
                    </div>
                  </div>
                  <button
                    onClick={onExit}
                    className="sm-icon-btn shrink-0"
                    style={{ color: 'var(--sm-text-quiet)' }}
                    aria-label="Wyloguj"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
