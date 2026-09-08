import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Loader2 } from 'lucide-react';

export type ThinkingPhase =
  | 'generate'
  | 'parse'
  | 'validate'
  | 'compile'
  | 'mount'
  | 'done';

/**
 * Rozumiemy realny flow: jeden request DeepSeek V4 Pro (generate),
 * potem lokalne fazy frontendu: parse → validate → compile → mount → done.
 * Podczas długiego requestu pokazujemy obracające się OPISY pracy
 * (nie fałszywe eventy backendu), a po odpowiedzi — prawdziwe fazy.
 */
const GENERATE_DESCRIPTIONS = [
  { title: 'Rozumiem markę', sub: 'Analizuję produkt, odbiorców i charakter biznesu' },
  { title: 'Układam kierunek wizualny', sub: 'Typografia, kolor, rytm i charakter strony' },
  { title: 'Projektuję doświadczenie', sub: 'Hierarchia, sekcje i kluczowe interakcje' },
  { title: 'Buduję stronę', sub: 'Generuję kompletny projekt React' },
];

const REAL_PHASES: { key: ThinkingPhase; title: string; sub: string }[] = [
  { key: 'parse', title: 'Projekt wygenerowany', sub: 'DeepSeek V4 Pro zwrócił kompletny projekt' },
  { key: 'validate', title: 'Sprawdzam komponenty', sub: 'Weryfikuję strukturę i zależności' },
  { key: 'compile', title: 'Kompiluję React', sub: 'Buduję bundel w przeglądarce (esbuild)' },
  { key: 'mount', title: 'Uruchamiam podgląd', sub: 'Montuję stronę i czekam na render' },
  { key: 'done', title: 'Strona gotowa', sub: 'Gotowa do publikacji' },
];

const PHASE_PROGRESS: Record<ThinkingPhase, number> = {
  generate: 0, // asymptotyczny w UI
  parse: 72,
  validate: 82,
  compile: 90,
  mount: 97,
  done: 100,
};

export const ThinkingSteps = ({
  mode,
  phase,
  theme,
}: {
  mode: string;
  phase: ThinkingPhase;
  theme: 'light' | 'dark';
}) => {
  const dk = theme === 'dark';

  const colors = {
    text: dk ? '#ffffff' : '#111827',
    textMuted: dk ? 'rgba(255,255,255,0.42)' : '#9ca3af',
    textFaint: dk ? 'rgba(255,255,255,0.24)' : '#c4c9d2',
    rail: dk ? 'rgba(255,255,255,0.08)' : '#e7e9ee',
    card: dk ? 'rgba(255,255,255,0.03)' : 'rgba(17,24,39,0.03)',
    green: '#10b981',
    greenSoft: dk ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.12)',
    dot: dk ? 'rgba(255,255,255,0.16)' : '#d4d7dd',
  };

  // Rotating descriptive steps while the single AI request is in flight.
  const [rot, setRot] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== 'generate') return;
    const t = setInterval(() => {
      setRot((r) => Math.min(r + 1, GENERATE_DESCRIPTIONS.length - 1));
      setElapsed((e) => e + 1);
    }, 6000);
    return () => clearInterval(t);
  }, [phase]);

  // Asymptotic progress during the long generation, real values afterwards.
  const progress = useMemo(() => {
    if (phase !== 'generate') return PHASE_PROGRESS[phase];
    // 6% → ~68% asymptotically over ~5 minutes of a single request.
    const base = 6 + 62 * (1 - Math.exp(-elapsed / 48));
    return Math.min(68, base);
  }, [phase, elapsed]);

  const modelLabel = mode === 'ultra+' ? 'Ultra+ · DeepSeek V4 Pro' : mode === 'ultra' ? 'Ultra · DeepSeek V4 Pro' : 'DeepSeek V4 Pro';

  const buildRows = () => {
    if (phase === 'generate') {
      return GENERATE_DESCRIPTIONS.map((d, i) => {
        const isActive = i === rot;
        const isDone = i < rot;
        return (
          <motion.div
            key={`gen-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-start gap-3"
            style={{ padding: '9px 10px', borderRadius: 12, background: isActive ? colors.card : 'transparent' }}
          >
            <div className="relative shrink-0 mt-0.5 w-4 h-4 grid place-items-center">
              {isDone ? (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-4 h-4 rounded-full grid place-items-center"
                  style={{ background: colors.greenSoft, color: colors.green }}
                >
                  <Check size={10} strokeWidth={3} />
                </motion.div>
              ) : (
                <motion.div
                  animate={isActive ? { scale: [1, 1.18, 1] } : {}}
                  transition={isActive ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
                  className="w-4 h-4 rounded-full grid place-items-center"
                  style={{ background: isActive ? colors.greenSoft : colors.dot }}
                >
                  {isActive && <motion.div className="w-2 h-2 rounded-full" style={{ background: colors.green }} />}
                </motion.div>
              )}
              {i < GENERATE_DESCRIPTIONS.length - 1 && (
                <span className="absolute top-4 left-2 w-px" style={{ height: 22, background: colors.rail }} />
              )}
            </div>
            <div className="min-w-0">
              <div
                className="text-xs font-semibold transition-colors duration-300"
                style={{ color: isActive ? colors.text : isDone ? colors.textMuted : colors.textFaint }}
              >
                {d.title}
              </div>
              {isActive && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={rot}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className="text-[10px] leading-relaxed mt-0.5"
                    style={{ color: colors.textMuted }}
                  >
                    {d.sub}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        );
      });
    }

    const activeIdx = REAL_PHASES.findIndex((p) => p.key === phase);
    return REAL_PHASES.map((p, i) => {
      const isDone = i < activeIdx || phase === 'done';
      const isActive = i === activeIdx;
      return (
        <motion.div
          key={p.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-start gap-3"
          style={{ padding: '9px 10px', borderRadius: 12, background: isActive ? colors.card : 'transparent' }}
        >
          <div className="relative shrink-0 mt-0.5 w-4 h-4 grid place-items-center">
            {isDone ? (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-4 h-4 rounded-full grid place-items-center"
                style={{ background: colors.greenSoft, color: colors.green }}
              >
                <Check size={10} strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div
                animate={isActive ? { scale: [1, 1.18, 1] } : {}}
                transition={isActive ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
                className="w-4 h-4 rounded-full grid place-items-center"
                style={{ background: isActive ? colors.greenSoft : colors.dot }}
              >
                {isActive && <motion.div className="w-2 h-2 rounded-full" style={{ background: colors.green }} />}
              </motion.div>
            )}
            {i < REAL_PHASES.length - 1 && (
              <span className="absolute top-4 left-2 w-px" style={{ height: 22, background: colors.rail }} />
            )}
          </div>
          <div className="min-w-0">
            <div
              className="text-xs font-semibold transition-colors duration-300"
              style={{ color: isActive ? colors.text : isDone ? colors.textMuted : colors.textFaint }}
            >
              {p.title}
            </div>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-[10px] leading-relaxed mt-0.5"
                style={{ color: colors.textMuted }}
              >
                {p.sub}
              </motion.div>
            )}
          </div>
        </motion.div>
      );
    });
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
          style={{ background: colors.greenSoft, color: colors.green }}
        >
          <Sparkles size={14} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold" style={{ color: colors.text }}>SiteMorph AI</div>
          <div className="text-[10px] truncate" style={{ color: colors.textMuted }}>{modelLabel}</div>
        </div>
        <div className="ml-auto shrink-0 text-[10px] font-semibold tabular-nums" style={{ color: colors.textMuted }}>
          {Math.round(progress)}%
        </div>
      </div>

      {/* Progress rail */}
      <div className="h-[3px] rounded-full overflow-hidden mb-4" style={{ background: colors.rail }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #10b981, #34d399)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      {/* Timeline */}
      <div className="space-y-0.5">{buildRows()}</div>

      {phase === 'generate' && (
        <div className="flex items-center gap-1.5 mt-4 px-1">
          <Loader2 size={11} className="animate-spin shrink-0" style={{ color: colors.green }} />
          <span className="text-[10px]" style={{ color: colors.textFaint }}>
            To potrwa 2–5 minut — DeepSeek buduje całą stronę w jednym przebiegu.
          </span>
        </div>
      )}
    </div>
  );
};