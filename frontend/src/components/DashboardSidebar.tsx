import { motion, LayoutGroup } from 'framer-motion';
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
  { id: 'builder', label: 'Kreator AI', icon: Wrench, badge: 'NOWOŚĆ' },
  { id: 'leadfinder', label: 'Lead Finder', icon: Search },
  { id: 'pricing', label: 'Cennik & Plany', icon: DollarSign },
  { id: 'finance', label: 'Finanse', icon: Receipt },
  { id: 'tutorials', label: 'Akademia', icon: GraduationCap },
  { id: 'help', label: 'Pomoc', icon: HelpCircle },
];

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
  const menuItems = SIDEBAR_MENU;

  return (
    <motion.aside
      layout
      className="hidden lg:flex w-64 border-r h-screen sticky top-0 flex-col justify-between z-30 shrink-0 select-none bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900 text-[#2563eb] dark:text-white"
    >
      <div>
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#EAEAEA] dark:border-neutral-900">
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onExit} 
            className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none text-inherit"
          >
            <img src="/logo.svg" alt="SiteMorph" width="28" height="28" className="rounded-lg shadow-md" />
            <span className="font-black text-base tracking-tight text-[#2563eb] dark:text-white">
              Site<span className="font-story-script text-xl px-0.5" style={{ background: 'linear-gradient(135deg,#06b6d4 0%,#22d3ee 50%,#a3e635 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Morph</span>
            </span>
          </motion.button>

          <motion.button
            whileHover={{ rotate: 180, scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={springTransition}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg hover:bg-[#F7F6F3] dark:hover:bg-neutral-900 text-[#2563eb] dark:text-white cursor-pointer border-none bg-transparent"
          >
            {theme === 'dark' ? <Sun size={15} className="text-white" /> : <Moon size={15} className="text-[#2563eb]" />}
          </motion.button>
        </div>

        <LayoutGroup id="sidebar-nav">
          <div className="p-3 space-y-1">
            <div className="text-[10px] font-black tracking-wider uppercase px-3 py-2 text-[#2563eb] dark:text-white opacity-70">
              MENU GŁÓWNE
            </div>
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black transition-colors cursor-pointer border-none ${
                    isActive ? 'text-white dark:text-black' : 'text-[#2563eb] dark:text-white hover:bg-[#F7F6F3]/60 dark:hover:bg-neutral-900/60'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActivePill"
                      transition={springTransition}
                      className="absolute inset-0 bg-[#111111] dark:bg-white rounded-xl shadow-md"
                    />
                  )}
                  <div className="flex items-center gap-2.5 relative z-10">
                    <item.icon size={16} className={isActive ? 'text-white dark:text-black' : 'text-[#2563eb] dark:text-white'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-white text-[#111111] dark:bg-black dark:text-white' : 'bg-blue-100 text-blue-800 dark:bg-neutral-800 dark:text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="p-3 pt-0">
            <div className="text-[10px] font-black tracking-wider uppercase px-3 py-2 text-[#2563eb] dark:text-white opacity-70">
              KONTO
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab('settings')}
              className={`w-full relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-colors cursor-pointer border-none ${
                activeTab === 'settings' ? 'text-white dark:text-black' : 'text-[#2563eb] dark:text-white hover:bg-[#F7F6F3]/60 dark:hover:bg-neutral-900/60'
              }`}
            >
              {activeTab === 'settings' && (
                <motion.div
                  layoutId="sidebarActivePill"
                  transition={springTransition}
                  className="absolute inset-0 bg-[#111111] dark:bg-white rounded-xl shadow-md"
                />
              )}
              <Settings size={16} className={`relative z-10 ${activeTab === 'settings' ? 'text-white dark:text-black' : 'text-[#2563eb] dark:text-white'}`} />
              <span className="relative z-10">Ustawienia</span>
            </motion.button>
          </div>
        </LayoutGroup>
      </div>

      <div className="p-3 space-y-2 border-t border-[#EAEAEA] dark:border-neutral-900">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="p-3 rounded-2xl border flex items-center justify-between bg-[#F7F6F3]/50 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800 text-[#2563eb] dark:text-white"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#111111] text-white dark:bg-white dark:text-black flex items-center justify-center font-black">
              <Coins size={16} />
            </div>
            <div>
              <div className="text-xs font-black">{credits} kredytów</div>
              <div className="text-[10px] font-bold opacity-80">{credits > 0 ? 'Pakiet aktywny' : 'Darmowy pakiet'}</div>
            </div>
          </div>
          <button onClick={() => setActiveTab('pricing')} className="text-[11px] font-black text-emerald-500 dark:text-emerald-400 hover:underline cursor-pointer bg-transparent border-none">
            Doładuj
          </button>
        </motion.div>

        <div className="p-2 flex items-center justify-between rounded-xl hover:bg-[#F7F6F3] dark:hover:bg-neutral-900 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#111111] text-white dark:bg-white dark:text-black font-black text-xs flex items-center justify-center shadow-sm">
              O
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black truncate">{session?.user?.email?.split('@')[0] || 'Użytkownik'}</div>
              <div className="text-[10px] font-bold opacity-80">{credits > 0 ? 'Pakiet aktywny' : 'Darmowy plan'}</div>
            </div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.2, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            onClick={onExit} 
            className="p-1 text-[#2563eb] dark:text-white hover:text-rose-500 cursor-pointer bg-transparent border-none" 
            title="Wyloguj"
          >
            <LogOut size={15} />
          </motion.button>
        </div>
      </div>
    </motion.aside>
  );
};

// Pasek górny + szuflada nawigacji na telefonach (< lg)
