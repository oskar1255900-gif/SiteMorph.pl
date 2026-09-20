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
  session,
  plan = null,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onExit: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  credits: number;
  session: any;
  plan?: string | null;
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
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-[56px] flex items-center justify-between px-3"
        style={{ background: 'var(--sm-bg)' }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setOpen(true)}
            className="sm-icon-btn"
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>
          <img src="/logo.svg" alt="" width="26" height="26" className="rounded-[7px]" />
          <span className="text-[15.5px] font-semibold tracking-[-0.03em]">
            Site<span className="sm-brand-gradient">Morph</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-[10px] px-2.5 py-1" style={{ background: 'var(--sm-surface)' }}>
            <Coins size={15} style={{ color: 'var(--sm-accent)' }} />
            <span className="text-[13.5px] font-semibold">{credits}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={springTransition}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="sm-icon-btn"
            aria-label="Zmień motyw"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
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
              className="fixed left-0 top-0 bottom-0 w-[272px] z-[61] flex flex-col lg:hidden overflow-y-auto"
              style={{ background: 'var(--sm-sidebar)' }}
            >
              {/* Drawer header */}
              <div className="flex h-[64px] items-center justify-between px-5">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.svg" alt="" width="28" height="28" className="rounded-[7px]" />
                  <span className="text-[17px] font-semibold tracking-[-0.02em]">
                    Site<span className="sm-brand-gradient">Morph</span>
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="sm-icon-btn"
                  aria-label="Zamknij menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Nav items */}
              <nav className="flex-1 px-4 space-y-1" aria-label="Menu mobilne">
                <div className="px-3 pb-1.5 pt-1 text-[11.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--sm-text-quiet)' }}>
                  Menu
                </div>
                {SIDEBAR_MENU.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setOpen(false); }}
                      className="w-full flex items-center gap-3 rounded-[10px] border-none bg-transparent cursor-pointer transition-all"
                      style={{
                        minHeight: '48px',
                        padding: '0 12px',
                        fontSize: '15px',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--sm-text)' : 'var(--sm-text-secondary)',
                        background: isActive ? 'var(--sm-surface)' : 'transparent',
                      }}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <item.icon size={20} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
                <div className="pt-2" style={{ borderTop: '1px solid var(--sm-border-subtle)' }} />
                <button
                  onClick={() => { setActiveTab('settings'); setOpen(false); }}
                  className="w-full flex items-center gap-3 rounded-[10px] border-none bg-transparent cursor-pointer transition-all"
                  style={{
                    minHeight: '48px',
                    padding: '0 12px',
                    fontSize: '15px',
                    fontWeight: activeTab === 'settings' ? 600 : 500,
                    color: activeTab === 'settings' ? 'var(--sm-text)' : 'var(--sm-text-secondary)',
                    background: activeTab === 'settings' ? 'var(--sm-surface)' : 'transparent',
                  }}
                  aria-current={activeTab === 'settings' ? 'page' : undefined}
                >
                  <Settings size={20} className="shrink-0" />
                  <span className="truncate">Ustawienia</span>
                </button>
              </nav>

              {/* Bottom */}
              <div className="px-3.5 pb-5 space-y-2.5">
                {/* Credits card */}
                <div className="rounded-[12px] p-3.5" style={{ background: 'var(--sm-surface)' }}>
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px]" style={{ background: 'var(--sm-surface-hover)' }}>
                      <Zap size={17} style={{ color: 'var(--sm-accent)' }} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold leading-tight">{credits} kredytów</div>
                      <div className="text-[12.5px]" style={{ color: 'var(--sm-text-quiet)' }}>Pozostało</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setActiveTab('pricing'); setOpen(false); }}
                    className="flex w-full min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border-none text-[13.5px] font-medium transition-colors"
                    style={{ background: 'var(--sm-surface-hover)', color: 'var(--sm-text)' }}
                  >
                    <Coins size={15} /> Doładuj kredyty
                  </button>
                </div>

                {/* User */}
                <div className="flex items-center justify-between gap-2 px-1.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: 'var(--sm-surface-hover)' }}>
                      <span className="text-[12.5px] font-medium" style={{ color: 'var(--sm-text-quiet)' }}>
                        {(session?.user?.email?.[0] || 'U').toUpperCase()}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium" style={{ color: 'var(--sm-text)' }}>
                        {session?.user?.email?.split('@')[0] || 'Użytkownik'}
                      </div>
                      <div className="truncate text-[11.5px]" style={{ color: 'var(--sm-text-quiet)' }}>
                        {plan ? `Pakiet ${plan.charAt(0).toUpperCase() + plan.slice(1)}` : 'Bez pakietu'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onExit}
                    className="sm-icon-btn shrink-0"
                    style={{ color: 'var(--sm-text-quiet)' }}
                    aria-label="Wyloguj"
                  >
                    <LogOut size={17} />
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
