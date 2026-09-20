import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

export type ThinkingPhase = 'generate' | 'parse' | 'validate' | 'compile' | 'mount' | 'done';

/**
 * Stan pracy nad stroną pokazuje WYŁĄCZNIE zdarzenia, które aplikacja zna:
 *  - `generate` — trwa jedno żądanie do modelu (czekamy na odpowiedź),
 *  - `compile`  — odpowiedź dotarła, kompilowany jest podgląd React,
 *  - `done`     — podgląd wystartował w ramce.
 *
 * Nie ma tu wymyślonej sekwencji „Dobieram kolory / Analizuję projekt” ani
 * procentu postępu: przy jednym żądaniu aplikacja nie zna wewnętrznych etapów
 * pracy modelu, więc nie może ich pokazywać jako ukończonych.
 */
const STATUS: Record<ThinkingPhase, [string, string]> = {
  generate: ['Tworzę Twoją stronę…', 'Model pracuje nad strukturą, treścią i stylem.'],
  parse: ['Przygotowuję podgląd…', 'Sprawdzam odpowiedź i składam projekt.'],
  validate: ['Przygotowuję podgląd…', 'Sprawdzam odpowiedź i składam projekt.'],
  compile: ['Przygotowuję podgląd…', 'Kompiluję projekt React w przeglądarce.'],
  mount: ['Przygotowuję podgląd…', 'Uruchamiam podgląd w ramce.'],
  done: ['Strona jest gotowa', 'Możesz ją obejrzeć, zapisać albo opublikować.'],
};

export function ThinkingSteps({ phase }: { mode: string; phase: ThinkingPhase; theme: 'light' | 'dark' }) {
  // Komponent montuje się raz na jedno generowanie, więc licznik pokazuje
  // łączny czas od wysłania opisu do gotowego podglądu.
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const done = phase === 'done';
  const [title, description] = STATUS[phase] ?? STATUS.generate;

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 p-6" aria-live="polite" aria-busy={!done}>
      <div className="flex items-center gap-3.5">
        <motion.span
          animate={done ? {} : { scale: [1, 1.06, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]"
          style={{ background: done ? 'color-mix(in srgb, var(--sm-success) 12%, transparent)' : 'var(--sm-accent-muted)' }}
        >
          {done
            ? <Check size={20} style={{ color: 'var(--sm-success)' }} />
            : <Sparkles size={20} style={{ color: 'var(--sm-accent)' }} />}
        </motion.span>
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.p
              key={title}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="text-[17px] font-semibold"
            >
              {title}
            </motion.p>
          </AnimatePresence>
          <p className="mt-0.5 text-[13px] leading-[1.5]" style={{ color: 'var(--sm-text-secondary)' }}>
            {description}
          </p>
        </div>
      </div>

      {/* Nieokreślony wskaźnik: brak udawanego procentu, liczy się realny czas. */}
      {!done ? (
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--sm-surface-hover)' }}>
            <motion.div
              className="h-full w-1/3 rounded-full"
              style={{ background: 'var(--sm-accent)' }}
              animate={{ x: ['-110%', '310%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--sm-text-quiet)' }}>
            {seconds}s
          </span>
        </div>
      ) : null}

      {!done && seconds >= 45 ? (
        <p className="text-[13px] leading-[1.5]" style={{ color: 'var(--sm-text-secondary)' }}>
          Złożone strony potrzebują więcej czasu. Możesz zostawić tę kartę otwartą.
        </p>
      ) : null}
    </div>
  );
}
