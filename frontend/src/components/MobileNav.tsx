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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-[var(--sm-border)] bg-[var(--sm-bg)]/95 px-4 backdrop-blur-xl text-[var(--sm-text)]">
        <button
          onClick={onExit}
          className="flex min-h-[44px] items-center gap-2 rounded-[8px] bg-transparent border-none px-1 cursor-pointer text-[var(--sm-text)]"
        >
          <img src="/logo.svg" alt="" width="24" height="24" className="rounded-[6px]" />
          <span className="text-[16px] font-semibold tracking-[-0.03em]">
            Site<span className="sm-brand-gradient">Morph</span>
          </span>
        </button>

        <div className="flex items-center gap-1">
          <span className="hidden min-h-[32px] items-center gap-1.5 rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface-2)] px-3 text-[13px] font-medium sm:inline-flex">
            <Coins size={13} /> {credits} kr.
          </span>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Zmień motyw"
            className="sm-icon-btn"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setOpen(true)}
            aria-label="Otwórz menu"
            className="sm-icon-btn"
          >
            <Menu size={22} />
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
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/50"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 32 }}
              className="lg:hidden fixed top-0 bottom-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col justify-between border-r border-[var(--sm-border)] bg-[var(--sm-bg)] text-[var(--sm-text)] select-none"
              role="dialog"
              aria-modal="true"
              aria-label="Menu nawigacji"
            >
              <div className="min-h-0 flex-1 overflow-y-auto sm-scroll">
                <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--sm-border)] px-4">
                  <span className="text-[17px] font-semibold tracking-[-0.03em]">
                    Site<span className="sm-brand-gradient">Morph</span>
                  </span>
                  <button onClick={() => setOpen(false)} aria-label="Zamknij menu" className="sm-icon-btn">
                    <X size={20} />
                  </button>
                </div>

                <nav className="space-y-0.5 p-3" aria-label="Menu główne">
                  <div className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--sm-text-3)]">
                    Menu
                  </div>
                  {SIDEBAR_MENU.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className="sm-nav-item"
                      aria-current={activeTab === item.id ? 'page' : undefined}
                    >
                      <item.icon size={18} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                  <div className="sm-divider mx-3 my-2" />
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="sm-nav-item"
                    aria-current={activeTab === 'settings' ? 'page' : undefined}
                  >
                    <Settings size={18} className="shrink-0" />
                    <span className="truncate">Ustawienia</span>
                  </button>
                </nav>
              </div>

              {/* Bottom: credits + user */}
              <div className="space-y-2 border-t border-[var(--sm-border)] p-3">
                <div className="flex items-center justify-between gap-2 rounded-[8px] bg-[var(--sm-surface-2)] border border-[var(--sm-border)] p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[var(--sm-surface-3)]">
                      <Coins size={16} className="text-[var(--sm-text-2)]" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold">{credits} kredytów</div>
                      <div className="text-[12px] text-[var(--sm-text-3)]">
                        {credits > 0 ? 'Aktywny pakiet' : 'Darmowy plan'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('pricing')}
                    className="shrink-0 min-h-[36px] rounded-[8px] px-3 text-[13px] font-medium text-[var(--sm-accent)] hover:bg-[var(--sm-accent-muted)] cursor-pointer border-none bg-transparent transition-colors"
                  >
                    Doładuj
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sm-surface-3)] text-[13px] font-semibold text-[var(--sm-text-2)]">
                      {(session?.user?.email?.[0] || 'U').toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">
                        {session?.user?.email?.split('@')[0] || 'Użytkownik'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onExit}
                    className="sm-icon-btn shrink-0 text-[var(--sm-text-2)] hover:text-[var(--sm-danger)]"
                    title="Wyloguj"
                    aria-label="Wyloguj"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
