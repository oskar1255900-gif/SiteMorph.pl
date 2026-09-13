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
  <div className="flex items-center gap-3">
    <img src="/logo.svg" alt="" width="32" height="32" className="rounded-[8px]" />
    <span className="text-[19px] font-semibold tracking-[-0.02em]">
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
      className="hidden lg:flex w-[272px] shrink-0 select-none h-screen sticky top-0 flex-col justify-between z-30"
      style={{ background: '#000000' }}
    >
      <div>
        {/* Header */}
        <div className="h-[72px] flex items-center px-6">
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
          <div className="px-3 pb-2 pt-2 text-[12px] font-semibold uppercase tracking-widest" style={{ color: 'var(--sm-text-quiet)' }}>
            Menu
          </div>
          {SIDEBAR_MENU.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center gap-3.5 rounded-[10px] border-none bg-transparent cursor-pointer transition-all"
                style={{
                  minHeight: '48px',
                  padding: '0 14px',
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
        </nav>

        {/* Account nav */}
        <nav className="px-4 space-y-1 mt-3" aria-label="Konto">
          <button
            onClick={() => setActiveTab('settings')}
            className="w-full flex items-center gap-3.5 rounded-[10px] border-none bg-transparent cursor-pointer transition-all"
            style={{
              minHeight: '48px',
              padding: '0 14px',
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
      </div>

      {/* Bottom: credits + user */}
      <div className="px-4 pb-5 space-y-3">
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
            onClick={() => setActiveTab('pricing')}
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
