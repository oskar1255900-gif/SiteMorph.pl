import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  X,
  MessageSquare,
} from 'lucide-react';

export const FloatingChat = ({
  chatOpen,
  setChatOpen
}: {
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
}) => (
  <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18 }}
          className="mb-3 w-[min(360px,calc(100vw-2.5rem))] rounded-[14px] border border-[var(--sm-border)] bg-[var(--sm-surface)] p-4 text-[var(--sm-text)] shadow-2xl"
          role="dialog"
          aria-label="Wsparcie SiteMorph"
        >
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--sm-border)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--sm-success)]" />
              <span className="text-[16px] font-semibold">Wsparcie SiteMorph</span>
            </div>
            <button onClick={() => setChatOpen(false)} aria-label="Zamknij czat" className="sm-icon-btn">
              <X size={18} />
            </button>
          </div>

          <div className="sm-card-quiet mb-3 p-3.5 text-[15px] leading-[1.55] text-[var(--sm-text-2)]">
            Cześć! W czym możemy Ci dzisiaj pomóc?
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Wpisz wiadomość…"
              aria-label="Treść wiadomości"
              className="sm-input flex-1 text-[15px]"
            />
            <button aria-label="Wyślij wiadomość" className="sm-btn sm-btn-primary shrink-0 px-3.5">
              <Send size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <motion.button
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.15 }}
      onClick={() => setChatOpen(!chatOpen)}
      aria-label={chatOpen ? 'Zamknij wsparcie' : 'Otwórz wsparcie'}
      className="grid place-items-center rounded-full border border-transparent bg-[var(--sm-accent)] text-[var(--sm-accent-ink)] shadow-2xl cursor-pointer"
      style={{ width: 52, height: 52 }}
    >
      <MessageSquare size={22} />
    </motion.button>
  </div>
);
