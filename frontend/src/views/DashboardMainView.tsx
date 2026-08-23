import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  Paperclip,
  Send,
  Search,
  GraduationCap,
  Clock,
  Wrench,
  Receipt,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cineChild, cineParent, itemVariants, springTransition } from '../lib/shared';
import { Lead } from '../types';

export const DashboardMainView = ({
  setActiveTab,
  onLaunchBuilderWithPrompt
}: {
  setActiveTab: (t: string) => void;
  theme: 'light' | 'dark';
  onLaunchBuilderWithPrompt: (prompt: string) => void;
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [activeTabSub, setActiveTabSub] = useState<'my' | 'recent'>('my');

  const handleSendPrompt = () => {
    if (!promptInput.trim()) return;
    onLaunchBuilderWithPrompt(promptInput);
  };

  const quickActions = [
    { label: 'Kreator AI', desc: 'Strona z jednego zdania', icon: Wrench, tab: 'builder', accent: 'from-lime-400 to-emerald-500' },
    { label: 'Lead Finder', desc: 'Klienci bez strony www', icon: Search, tab: 'leadfinder', accent: 'from-emerald-500 to-teal-500' },
    { label: 'Nowa faktura', desc: 'Bez prowizji, w PDF', icon: Receipt, tab: 'finance', accent: 'from-fuchsia-500 to-purple-600' },
    { label: 'Akademia', desc: 'Sprzedawaj z głową', icon: GraduationCap, tab: 'tutorials', accent: 'from-amber-400 to-orange-500' }
  ];

  return (
    <motion.div 
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto py-8 px-6 space-y-8 pb-20 text-blue-600 dark:text-white"
    >
      <motion.div variants={itemVariants} className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black border shadow-sm bg-white dark:bg-neutral-950 border-blue-200 dark:border-neutral-800 text-blue-600 dark:text-white">
          <span className="bg-blue-600 text-white dark:bg-white dark:text-black text-[9px] font-black px-1.5 py-0.5 rounded-md">NOWOŚĆ</span>
          Generowanie serwisów www nowej generacji <ArrowRight size={12} />
        </div>
      </motion.div>

      <motion.div variants={cineChild} className="text-center space-y-6 relative">
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[480px] h-[200px] morph-blob bg-gradient-to-tr from-lime-100 via-emerald-50 to-lime-100 dark:from-lime-500/10 dark:via-emerald-400/5 dark:to-lime-400/10 blur-3xl opacity-70" />
        <h2 className="relative text-4xl sm:text-5xl font-black tracking-tighter text-blue-600 dark:text-white leading-[0.95]" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
          Co dzisiaj stworzymy?
        </h2>

        <motion.div
          layout
          whileHover={{ scale: 1.01 }}
          transition={springTransition}
          className="relative rounded-2xl p-2 pl-5 shadow-2xl border text-left flex items-center gap-4 bg-white/95 dark:bg-black/95 border-blue-300 dark:border-neutral-700 text-blue-600 dark:text-white overflow-hidden"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 w-48 h-48 morph-blob bg-gradient-to-tr from-lime-300/40 via-emerald-300/20 to-lime-300/40 blur-2xl" />
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            placeholder="Stwórz stronę dla siłowni z systemem rezerwacji online..."
            className="relative flex-1 bg-transparent border-none outline-none text-sm sm:text-base font-bold placeholder:text-blue-400 dark:placeholder:text-neutral-500 py-3 text-blue-600 dark:text-white"
          />
          <div className="relative flex items-center gap-2 pr-1">
            <motion.button whileHover={{ scale: 1.1 }} className="p-2 text-blue-600 dark:text-white hover:opacity-80 cursor-pointer bg-transparent border-none">
              <Paperclip size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleSendPrompt}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-lime-400 to-emerald-500 text-white dark:from-white dark:to-neutral-200 dark:text-black flex items-center justify-center font-black shadow-lg cursor-pointer border-none"
            >
              <Send size={16} />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Szybkie akcje */}
      <motion.div variants={cineParent} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((a, i) => (
          <motion.button
            key={a.label}
            variants={cineChild}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab(a.tab)}
            className="rounded-2xl border p-4 text-left space-y-6 bg-white dark:bg-black border-blue-100 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-shadow cursor-pointer group"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${a.accent} text-white grid place-items-center shadow-md`}>
              <a.icon size={18} />
            </div>
            <div>
              <div className="text-xs font-black">{a.label}</div>
              <div className="text-[10px] font-bold opacity-60 mt-0.5">{a.desc}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      <motion.div 
        variants={cineChild}
        className="rounded-3xl p-6 border shadow-xl space-y-6 bg-white dark:bg-black border-blue-100 dark:border-neutral-900 text-blue-600 dark:text-white"
      >
        <div className="flex items-center gap-2 text-xs font-bold border-b border-blue-100 dark:border-neutral-900 pb-3">
          <div className="relative flex gap-2">
            {(['my', 'recent'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTabSub(tab)}
                className={`relative px-4 py-1.5 rounded-full transition-colors cursor-pointer border-none font-black text-xs ${
                  activeTabSub === tab ? 'text-white dark:text-black' : 'text-blue-600 dark:text-white hover:opacity-75'
                }`}
              >
                {activeTabSub === tab && (
                  <motion.div
                    layoutId="dashboardSubTab"
                    transition={springTransition}
                    className="absolute inset-0 bg-blue-600 dark:bg-white rounded-full shadow-md"
                  />
                )}
                <span className="relative z-10">{tab === 'my' ? 'Moje projekty' : 'Ostatnio przeglądane'}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTabSub}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }}
            transition={springTransition}
            className="py-14 flex flex-col items-center justify-center text-center space-y-3"
          >
            <motion.div 
              animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }}
              transition={{ duration: 5, repeat: Infinity }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-lime-50 dark:from-neutral-900 dark:to-neutral-950 text-blue-600 dark:text-white flex items-center justify-center mb-1 border border-blue-200 dark:border-neutral-800 shadow-inner"
            >
              {activeTabSub === 'my' ? <Sparkles size={28} className="text-emerald-400" /> : <Clock size={28} className="opacity-60" />}
            </motion.div>
            <h3 className="text-lg font-black">{activeTabSub === 'my' ? 'Brak aktywnych projektów' : 'Nic tu jeszcze nie ma'}</h3>
            <p className="text-xs font-bold max-w-xs opacity-80">
              {activeTabSub === 'my'
                ? 'Opisz swój pomysł w polu powyżej lub kliknij przycisk, aby uruchomić kreator.'
                : 'Projekty, które otworzysz, pojawią się tutaj.'}
            </p>
            <Button variant="primary" size="md" onClick={() => setActiveTab('builder')} className="mt-2 font-black">
              <Wrench size={15} /> Otwórz Kreator Stron
            </Button>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// 9. WIDOK: KREATOR AI (BUILDER)
// ============================================================================
