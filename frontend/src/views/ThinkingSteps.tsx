import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

export type ThinkingPhase = 'generate' | 'parse' | 'validate' | 'compile' | 'mount' | 'done';

const descriptions: Record<ThinkingPhase, [string, string]> = {
  generate: ['Tworzę projekt', 'Dobieram kolory, układ i treści do Twojej marki.'],
  parse: ['Analizuję projekt', 'Sprawdzam, czy wszystko się zgadza.'],
  validate: ['Poprawiam detale', 'Dbam o każdy szczegół strony.'],
  compile: ['Składam stronę', 'Łączę wszystkie elementy w całość.'],
  mount: ['Uruchamiam podgląd', 'Twoja strona prawie gotowa!'],
  done: ['Strona gotowa!', 'Możesz ją zobaczyć, zapisać lub opublikować.'],
};

const ORDER: ThinkingPhase[] = ['generate', 'parse', 'validate', 'compile', 'mount'];

export function ThinkingSteps({ phase }: { mode: string; phase: ThinkingPhase; theme: 'light' | 'dark' }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentIndex = ORDER.indexOf(phase);
  const done = phase === 'done';

  return (
    <div className="flex flex-1 flex-col justify-center gap-8 p-6" aria-live="polite">
      {/* Main status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <motion.div
          animate={done ? {} : { scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-[14px]"
          style={{ background: done ? 'rgba(22,163,74,0.1)' : 'var(--sm-accent-muted)' }}
        >
          {done
            ? <Check size={24} style={{ color: 'var(--sm-success)' }} />
            : <Sparkles size={24} style={{ color: 'var(--sm-accent)' }} />}
        </motion.div>
        <div>
          <AnimatePresence mode="wait">
            <motion.p
              key={phase}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="text-[20px] font-semibold"
            >
              {descriptions[phase][0]}
            </motion.p>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p
              key={phase + '-desc'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[15px] mt-1"
              style={{ color: 'var(--sm-text-secondary)' }}
            >
              {descriptions[phase][1]}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Progress steps */}
      <div className="space-y-3">
        {ORDER.map((p, i) => {
          const state = done || i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';
          return (
            <motion.div
              key={p}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3"
            >
              <div
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full transition-all duration-300"
                style={{
                  background: state === 'done' ? 'var(--sm-success)' : state === 'active' ? 'var(--sm-accent-muted)' : 'var(--sm-surface-hover)',
                  color: state === 'done' ? '#fff' : state === 'active' ? 'var(--sm-accent)' : 'var(--sm-text-quiet)',
                }}
              >
                {state === 'done' ? <Check size={14} /> : state === 'active' ? <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="h-2 w-2 rounded-full" style={{ background: 'var(--sm-accent)' }} /> : null}
              </div>
              <span
                className="text-[15px] font-medium transition-colors"
                style={{ color: state === 'pending' ? 'var(--sm-text-quiet)' : 'var(--sm-text)' }}
              >
                {descriptions[p][0]}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Timer */}
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--sm-surface-hover)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--sm-accent)' }}
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min(95, (currentIndex / ORDER.length) * 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[14px] tabular-nums font-medium" style={{ color: 'var(--sm-text-quiet)' }}>{seconds}s</span>
      </div>

      {seconds >= 60 && phase === 'generate' && (
        <p className="text-[15px]" style={{ color: 'var(--sm-text-secondary)' }}>
          To może chwilę potrwać. Złożone strony potrzebują więcej czasu.
        </p>
      )}
    </div>
  );
}
