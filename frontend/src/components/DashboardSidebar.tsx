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
  <div className="flex items-center gap-2.5">
    <img src="/logo.svg" alt="" width="28" height="28" className="rounded-[8px]" />
    <span className="text-[17px] font-semibold tracking-[-0.03em]">
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
      className="hidden lg:flex w-[264px] shrink-0 select-none h-screen sticky top-0 flex-col justify-between z-30 bg-[var(--sm-sidebar)] text-[var(--sm-text)]"
    >
      <div>
        {/* Header */}
        <div className="h-16 flex items-center justify-between gap-2 px-5">
          <button
            onClick={onExit}
            className="flex min-h-[44px] items-center gap-2 rounded-[8px] border-none bg-transparent px-1.5 cursor-pointer text-[var(--sm-text)]"
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
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </motion.button>
        </div>

        {/* Main nav */}
        <nav className="px-3 space-y-0.5" aria-label="Menu główne">
          <div className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--sm-text-quiet)]">
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
        </nav>

        {/* Account nav */}
        <nav className="px-3 space-y-0.5 mt-2" aria-label="Konto">
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
      <div className="px-3 pb-4 space-y-2">
        {/* Credits */}
        <div className="flex items-center justify-between gap-2 rounded-[10px] bg-[var(--sm-surface)] p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[var(--sm-surface-hover)]">
              <Coins size={16} className="text-[var(--sm-text-quiet)]" />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold leading-tight">{credits} kredytów</div>
              <div className="text-[12px] text-[var(--sm-text-quiet)]">
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

        {/* User */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--sm-surface-hover)] text-[12px] font-semibold text-[var(--sm-text-quiet)]">
              {(session?.user?.email?.[0] || 'U').toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">
                {session?.user?.email?.split('@')[0] || 'Użytkownik'}
              </div>
            </div>
          </div>
          <button
            onClick={onExit}
            className="sm-icon-btn shrink-0 text-[var(--sm-text-quiet)] hover:text-[var(--sm-danger)]"
            title="Wyloguj"
            aria-label="Wyloguj"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
