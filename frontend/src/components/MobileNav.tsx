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
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] z-[61] flex flex-col lg:hidden"
              style={{ background: 'var(--sm-sidebar)' }}
            >
              {/* Drawer header */}
              <div className="h-[72px] flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                  <img src="/logo.svg" alt="" width="32" height="32" className="rounded-[10px]" />
                  <span className="text-[18px] font-semibold tracking-[-0.03em]">
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
              <nav className="flex-1 px-4 space-y-1 overflow-y-auto" aria-label="Menu mobilne">
                {SIDEBAR_MENU.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setOpen(false); }}
                    className="sm-nav-item"
                    style={{ minHeight: '52px', fontSize: '16px', paddingLeft: '14px', gap: '14px' }}
                    aria-current={activeTab === item.id ? 'page' : undefined}
                  >
                    <item.icon size={22} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
                <div className="pt-2" style={{ borderTop: '1px solid var(--sm-border-subtle)' }} />
                <button
                  onClick={() => { setActiveTab('settings'); setOpen(false); }}
                  className="sm-nav-item"
                  style={{ minHeight: '52px', fontSize: '16px', paddingLeft: '14px', gap: '14px' }}
                  aria-current={activeTab === 'settings' ? 'page' : undefined}
                >
                  <Settings size={22} className="shrink-0" />
                  <span className="truncate">Ustawienia</span>
                </button>
              </nav>

              {/* Bottom */}
              <div className="px-4 pb-6 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--sm-surface)] p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[var(--sm-surface-hover)]">
                      <Coins size={18} style={{ color: 'var(--sm-text-quiet)' }} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold leading-tight">{credits} kredytów</div>
                      <div className="text-[13px]" style={{ color: 'var(--sm-text-quiet)' }}>
                        {credits > 0 ? 'Aktywny pakiet' : 'Darmowy plan'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setActiveTab('pricing'); setOpen(false); }}
                    className="shrink-0 min-h-[40px] rounded-[10px] px-4 text-[14px] font-medium cursor-pointer border-none bg-transparent transition-colors"
                    style={{ color: 'var(--sm-accent)' }}
                  >
                    Doładuj
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 px-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sm-surface-hover)] text-[13px] font-medium" style={{ color: 'var(--sm-text-quiet)' }}>
                      {(session?.user?.email?.[0] || 'U').toUpperCase()}
                    </span>
                    <div className="truncate text-[14px] font-medium">
                      {session?.user?.email?.split('@')[0] || 'Użytkownik'}
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
