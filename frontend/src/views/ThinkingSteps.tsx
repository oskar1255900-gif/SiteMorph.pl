import { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';

export type ThinkingPhase = 'generate' | 'parse' | 'validate' | 'compile' | 'mount' | 'done';

const descriptions: Record<ThinkingPhase, [string, string]> = {
  generate: ['Projektuję Twoją stronę', 'Dobieram układ, typografię i treść do Twojej marki.'],
  parse: ['Odebrano projekt', 'Przygotowuję stronę do sprawdzenia.'],
  validate: ['Sprawdzam projekt', 'Weryfikuję pliki i style.'],
  compile: ['Przygotowuję podgląd', 'Łączę komponenty i style strony.'],
  mount: ['Uruchamiam stronę', 'Czekam na wyświetlenie podglądu.'],
  done: ['Strona gotowa', 'Możesz obejrzeć, zapisać i opublikować projekt.'],
};

const ORDER: ThinkingPhase[] = ['generate', 'parse', 'validate', 'compile', 'mount'];

export function ThinkingSteps({ phase, theme }: { mode: string; phase: ThinkingPhase; theme: 'light' | 'dark' }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentIndex = ORDER.indexOf(phase);
  const done = phase === 'done';

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 p-6" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)]">
          {done
            ? <Check size={20} className="text-[var(--sm-success)]" />
            : <Loader2 size={20} className="animate-spin text-[var(--sm-accent)] motion-reduce:animate-none" />}
        </span>
        <div>
          <p className="text-[17px] font-semibold">{descriptions[phase][0]}</p>
          <p className="mt-1 text-[15px] leading-[1.55] text-[var(--sm-text-2)]">{descriptions[phase][1]}</p>
        </div>
      </div>

      {/* Prawdziwe fazy aplikacji — bez udawanej telemetrii */}
      <ol className="space-y-2.5">
        {ORDER.map((p, i) => {
          const state = done || i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';
          return (
            <li key={p} className="flex items-center gap-3 text-[15px]">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${
                  state === 'done'
                    ? 'border-transparent bg-[var(--sm-success)] text-white'
                    : state === 'active'
                      ? 'border-[var(--sm-accent)] text-[var(--sm-accent)]'
                      : 'border-[var(--sm-border-strong)] text-[var(--sm-text-3)]'
                }`}
              >
                {state === 'done' ? <Check size={12} /> : state === 'active' ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--sm-accent)]" /> : null}
              </span>
              <span className={state === 'pending' ? 'text-[var(--sm-text-3)]' : 'text-[var(--sm-text-2)]'}>
                {descriptions[p][0]}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-[14px] tabular-nums text-[var(--sm-text-3)]">Czas: {seconds} s</p>
      {seconds >= 60 && phase === 'generate' && (
        <p className="text-[14px] leading-[1.55] text-[var(--sm-text-2)]">
          Model nadal pracuje. Czas zależy od złożoności strony i obciążenia usługi.
        </p>
      )}
    </div>
  );
}
