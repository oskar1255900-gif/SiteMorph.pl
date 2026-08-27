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
      className="max-w-4xl mx-auto py-8 px-6 space-y-8 pb-20 text-[#2563eb] dark:text-white"
    >
      <motion.div variants={itemVariants} className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black border shadow-sm bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800 text-[#2563eb] dark:text-white">
          <span className="bg-[#111111] text-white dark:bg-white dark:text-black text-[9px] font-black px-1.5 py-0.5 rounded-md">NOWOŚĆ</span>
          Generowanie serwisów www nowej generacji <ArrowRight size={12} />
        </div>
      </motion.div>

      <motion.div variants={cineChild} className="text-center space-y-6">
        <h2 className="text-4xl md:text-6xl font-[700] tracking-[-0.03em] leading-none text-[#2563eb] dark:text-white" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
          Co dzisiaj stworzymy?
        </h2>

        <motion.div
          layout
          className="relative rounded-[12px] p-2 pl-5 bg-white dark:bg-zinc-950 border border-[#EAEAEA] dark:border-white/[0.08] flex items-center gap-4 overflow-hidden"
        >
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
            className="flex-1 bg-transparent border-none outline-none text-[17px] leading-[1.5] placeholder:text-[#2563eb] py-3 text-[#2563eb] dark:text-white"
          />
          <div className="flex items-center gap-2 pr-1">
            <motion.button whileHover={{ scale: 1.02 }} className="p-2 text-[#2563eb] hover:text-[#111111] cursor-pointer bg-transparent border-none">
              <Paperclip size={18} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSendPrompt}
              className="w-10 h-10 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black flex items-center justify-center cursor-pointer border-none"
              style={{ transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
            >
              <Send size={16} />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Szybkie akcje - Bento 1+3 per skill (nie 4 równe), warm monochrome */}
      <motion.div variants={cineParent} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((a, i) => (
          <motion.button
            key={a.label}
            variants={cineChild}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={() => setActiveTab(a.tab)}
            className={`text-left p-6 bg-white dark:bg-zinc-950 border border-[#EAEAEA] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-all cursor-pointer ${i===0 ? 'md:col-span-2 rounded-[16px]' : 'rounded-[12px]'}`}
          >
            <div className="w-8 h-8 rounded-[8px] bg-[#111111] dark:bg-white text-white dark:text-black grid place-items-center">
              <a.icon size={14} />
            </div>
            <div className="mt-4">
              <div className="text-[17px] font-[600] tracking-[-0.02em] leading-none">{a.label}</div>
              <div className="text-[13px] leading-[1.5] text-[#2563eb] dark:text-zinc-400 mt-1">{a.desc}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      <motion.div 
        variants={cineChild}
        className="rounded-3xl p-6 border shadow-xl space-y-6 bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900 text-[#2563eb] dark:text-white"
      >
        <div className="flex items-center gap-2 text-xs font-bold border-b border-[#EAEAEA] dark:border-neutral-900 pb-3">
          <div className="relative flex gap-2">
            {(['my', 'recent'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTabSub(tab)}
                className={`relative px-4 py-1.5 rounded-full transition-colors cursor-pointer border-none font-black text-xs ${
                  activeTabSub === tab ? 'text-white dark:text-black' : 'text-[#2563eb] dark:text-white hover:opacity-75'
                }`}
              >
                {activeTabSub === tab && (
                  <motion.div
                    layoutId="dashboardSubTab"
                    transition={springTransition}
                    className="absolute inset-0 bg-[#111111] dark:bg-white rounded-full shadow-md"
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
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-lime-50 dark:from-neutral-900 dark:to-neutral-950 text-[#2563eb] dark:text-white flex items-center justify-center mb-1 border border-[#EAEAEA] dark:border-neutral-800 shadow-inner"
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
