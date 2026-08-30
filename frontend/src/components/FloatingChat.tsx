import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  X,
  MessageSquare,
} from 'lucide-react';
import { springTransition } from '../lib/shared';

export const FloatingChat = ({
  chatOpen,
  setChatOpen
}: {
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
}) => (
  <div className="fixed bottom-6 right-6 z-50">
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={springTransition}
          className="rounded-2xl shadow-[0_16px_48px_rgba(37,99,235,0.12)] border w-80 p-4 mb-3 bg-white dark:bg-black border-[#EAEAEA] dark:border-neutral-900 text-[#2563eb] dark:text-white"
        >
          <div className="flex justify-between items-center border-b border-[#EAEAEA] dark:border-neutral-900 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-black text-xs">Wsparcie SiteMorph</span>
            </div>
            <motion.button 
              whileHover={{ scale: 1.15 }}
              onClick={() => setChatOpen(false)} 
              className="hover:text-emerald-400 cursor-pointer bg-transparent border-none text-inherit"
            >
              <X size={14} />
            </motion.button>
          </div>
          <div className="text-xs p-3 rounded-2xl mb-3 border font-bold bg-[#F7F6F3]/50 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-900">
            Cześć! W czym możemy Ci dzisiaj pomóc?
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Wpisz wiadomość..."
              className="flex-1 rounded-lg px-3 py-1.5 text-xs font-bold outline-none border text-[#2563eb] dark:text-white placeholder:text-blue-400 dark:placeholder:text-neutral-500 bg-[#F7F6F3]/40 dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800"
            />
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="bg-[#111111] text-white dark:bg-white dark:text-black p-1.5 rounded-lg cursor-pointer border-none shadow-sm font-black"
            >
              <Send size={14} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    <motion.button
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.9 }}
      transition={springTransition}
      onClick={() => setChatOpen(!chatOpen)}
      className="w-12 h-12 rounded-full flex items-center justify-center font-black shadow-[0_16px_48px_rgba(37,99,235,0.12)] cursor-pointer border-none bg-[#111111] text-white dark:bg-white dark:text-black"
    >
      <MessageSquare size={20} />
    </motion.button>
  </div>
);
