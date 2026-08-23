import React from 'react';
import { Sun, Moon, Search, Layout, Settings, Database } from 'lucide-react';

export const Navbar = ({ activeTab, setActiveTab, darkMode, setDarkMode }: any) => {
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <Layout className="w-4 h-4" /> },
    { id: 'leads', name: 'Lead Finder', icon: <Search className="w-4 h-4" /> },
    { id: 'builder', name: 'AI Builder', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <nav className="w-full sticky top-0 z-50 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-blue-200 dark:border-neutral-900 transition-colors">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer select-none" 
          onClick={() => setActiveTab('dashboard')}
        >
          <div className="w-7 h-7 rounded-lg bg-lime-400 text-black flex items-center justify-center font-black text-xs shadow-sm shadow-lime-400/30">
            SM
          </div>
          <span className="font-black text-lg tracking-tight text-blue-600 dark:text-white">
            Site<span className="text-lime-600 dark:text-lime-400">Morph</span>
          </span>
        </div>

        {/* Menu */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 text-sm font-bold transition-all cursor-pointer bg-transparent border-none ${
                  isActive 
                    ? 'text-blue-600 dark:text-white font-black' 
                    : 'text-blue-600/70 dark:text-white/70 hover:text-blue-600 dark:hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-blue-600 dark:text-white' : 'text-blue-600/70 dark:text-white/70'}>
                  {item.icon}
                </span>
                {item.name}
              </button>
            );
          })}
        </div>

        {/* Prawa strona */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-neutral-800 text-xs font-bold text-blue-600 dark:text-white">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse"></span>
            v2.0 AI Live
          </div>
          
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-neutral-900 text-blue-600 dark:text-white transition-colors cursor-pointer border-none bg-transparent"
            title="Zmień motyw"
          >
            {darkMode ? <Sun className="w-5 h-5 text-lime-400" /> : <Moon className="w-5 h-5 text-blue-600" />}
          </button>
        </div>
      </div>
    </nav>
  );
};