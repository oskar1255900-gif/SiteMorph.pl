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
  Zap,
} from 'lucide-react';
import { springTransition } from '../lib/shared';

export const SIDEBAR_MENU = [
  { id: 'dashboard', label: 'Panel główny', icon: LayoutDashboard },
  { id: 'builder', label: 'Kreator', icon: Wrench },
  { id: 'leadfinder', label: 'Leady', icon: Search },
  { id: 'pricing', label: 'Cennik i plany', icon: DollarSign },
  { id: 'finance', label: 'Płatności', icon: Receipt },
  { id: 'tutorials', label: 'Poradniki', icon: GraduationCap },
  { id: 'help', label: 'Pomoc', icon: HelpCircle },
];

const Logo = () => (
  <div className="flex items-center gap-2.5">
    <img src="/logo.svg" alt="" width="28" height="28" className="rounded-[7px]" />
    <span className="text-[17.5px] font-semibold tracking-[-0.02em]">
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
  return (
    <aside
      className="hidden lg:flex w-[264px] shrink-0 select-none h-screen sticky top-0 flex-col justify-between z-30"
      style={{ background: 'var(--sm-sidebar)' }}
    >
      <div>
        {/* Header */}
        <div className="flex h-[64px] items-center px-5">
          <button
            onClick={onExit}
            className="flex min-h-[48px] items-center gap-3 rounded-[10px] border-none bg-transparent cursor-pointer"
            style={{ color: 'var(--sm-text)' }}
            aria-label="SiteMorph — strona główna"
          >
            <Logo />
          </button>
        </div>

        {/* Main nav */}
        <nav className="px-4 space-y-1" aria-label="Menu główne">
          <div className="px-3 pb-1.5 pt-1 text-[11.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--sm-text-quiet)' }}>
            Menu
          </div>
          {SIDEBAR_MENU.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center gap-3 rounded-[10px] border-none bg-transparent cursor-pointer transition-all"
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--sm-text)' : 'var(--sm-text-secondary)',
                  background: isActive ? 'var(--sm-control-bg)' : 'transparent',
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon size={18} className="shrink-0" style={isActive ? { color: 'var(--sm-accent)' } : undefined} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Account nav */}
        <nav className="px-4 space-y-1 mt-3" aria-label="Konto">
          <button
            onClick={() => setActiveTab('settings')}
            className="w-full flex items-center gap-3 rounded-[10px] border-none bg-transparent cursor-pointer transition-all"
            style={{
              minHeight: '44px',
              padding: '0 12px',
              fontSize: '14px',
              fontWeight: activeTab === 'settings' ? 600 : 500,
              color: activeTab === 'settings' ? 'var(--sm-text)' : 'var(--sm-text-secondary)',
              background: activeTab === 'settings' ? 'var(--sm-control-bg)' : 'transparent',
            }}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
          >
            <Settings size={18} className="shrink-0" style={activeTab === 'settings' ? { color: 'var(--sm-accent)' } : undefined} />
            <span className="truncate">Ustawienia</span>
          </button>
        </nav>
      </div>

      {/* Bottom: credits + user */}
      <div className="px-3.5 pb-4 space-y-2.5">
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
            onClick={() => setActiveTab('pricing')}
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
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="sm-icon-btn"
              style={{ color: 'var(--sm-text-quiet)' }}
              title="Zmień motyw"
              aria-label="Zmień motyw"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              onClick={onExit}
              className="sm-icon-btn"
              style={{ color: 'var(--sm-text-quiet)' }}
              title="Wyloguj"
              aria-label="Wyloguj"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
