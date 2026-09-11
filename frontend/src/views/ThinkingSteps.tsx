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

export function ThinkingSteps({ phase, theme }: { mode: string; phase: ThinkingPhase; theme: 'light' | 'dark' }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return <div className={`flex-1 flex flex-col justify-center p-6 gap-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} aria-live="polite">
    {phase === 'done' ? <Check size={24} className="text-green-500" /> : <Loader2 size={24} className="animate-spin motion-reduce:animate-none text-green-500" />}
    <div><p className="text-sm font-semibold">{descriptions[phase][0]}</p>
      <p className="mt-2 text-xs opacity-60 leading-relaxed">{descriptions[phase][1]}</p></div>
    <p className="text-xs opacity-50 tabular-nums">Czas: {seconds} s</p>
    {seconds >= 60 && phase === 'generate' && <p className="text-xs opacity-60">Model nadal pracuje. Czas zależy od złożoności strony i obciążenia usługi.</p>}
  </div>;
}
