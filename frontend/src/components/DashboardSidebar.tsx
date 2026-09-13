import { motion } from 'framer-motion';
import {
  LogOut,
  Settings,
  Sun,
  Moon,
  Coins,
  LayoutDashboard,
  Wrench,
  Search,
  DollarSign,
  Receipt,
  GraduationCap,
  HelpCircle,
} from 'lucide-react';
import { springTransition } from '../lib/shared';

export const SIDEBAR_MENU = [
  { id: 'dashboard', label: 'Pulpit', icon: LayoutDashboard },
  { id: 'builder', label: 'Kreator AI', icon: Wrench },
  { id: 'leadfinder', label: 'Lead Finder', icon: Search },
  { id: 'pricing', label: 'Cennik i plany', icon: DollarSign },
  { id: 'finance', label: 'Finanse', icon: Receipt },
  { id: 'tutorials', label: 'Akademia', icon: GraduationCap },
  { id: 'help', label: 'Pomoc', icon: HelpCircle },
];

const Logo = () => (
  <div className="flex items-center gap-3">
    <img src="/logo.svg" alt="" width="32" height="32" className="rounded-[10px]" />
    <span className="text-[18px] font-semibold tracking-[-0.03em]">
      Site<span className="sm-brand-gradient">Morph</span>
    </span>
  </div>
);

export const DashboardSidebar = ({
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
  return (
    <aside
      className="hidden lg:flex w-[280px] shrink-0 select-none h-screen sticky top-0 flex-col justify-between z-30 bg-[var(--sm-sidebar)] text-[var(--sm-text)]"
    >
      <div>
        {/* Header */}
        <div className="h-[72px] flex items-center justify-between gap-3 px-6">
          <button
            onClick={onExit}
            className="flex min-h-[48px] items-center gap-3 rounded-[10px] border-none bg-transparent px-2 cursor-pointer text-[var(--sm-text)]"
            aria-label="SiteMorph — strona główna"
          >
            <Logo />
          </button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={springTransition}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="sm-icon-btn"
            title={theme === 'dark' ? 'Motyw jasny' : 'Motyw ciemny'}
            aria-label="Zmień motyw"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </motion.button>
        </div>

        {/* Main nav */}
        <nav className="px-4 space-y-1" aria-label="Menu główne">
          <div className="px-3 pb-3 pt-3 text-[13px] font-medium uppercase tracking-wider" style={{ color: 'var(--sm-text-quiet)' }}>
            Menu
          </div>
          {SIDEBAR_MENU.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="sm-nav-item"
              style={{ minHeight: '48px', fontSize: '15px', paddingLeft: '14px', gap: '14px' }}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Account nav */}
        <nav className="px-4 space-y-1 mt-3" aria-label="Konto">
          <button
            onClick={() => setActiveTab('settings')}
            className="sm-nav-item"
            style={{ minHeight: '48px', fontSize: '15px', paddingLeft: '14px', gap: '14px' }}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
          >
            <Settings size={20} className="shrink-0" />
            <span className="truncate">Ustawienia</span>
          </button>
        </nav>
      </div>

      {/* Bottom: credits + user */}
      <div className="px-4 pb-5 space-y-3">
        {/* Credits */}
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
            onClick={() => setActiveTab('pricing')}
            className="shrink-0 min-h-[40px] rounded-[10px] px-4 text-[14px] font-medium cursor-pointer border-none bg-transparent transition-colors"
            style={{ color: 'var(--sm-accent)' }}
          >
            Doładuj
          </button>
        </div>

        {/* User */}
        <div className="flex items-center justify-between gap-3 px-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sm-surface-hover)] text-[13px] font-medium" style={{ color: 'var(--sm-text-quiet)' }}>
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
            className="sm-icon-btn shrink-0"
            style={{ color: 'var(--sm-text-quiet)' }}
            title="Wyloguj"
            aria-label="Wyloguj"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};
