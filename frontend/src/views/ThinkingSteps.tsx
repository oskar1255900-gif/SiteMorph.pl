import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  FileCode,
  Palette,
  Layout,
  Type,
  Image,
  FormInput,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface Step {
  text: string;
  icon: any;
  color: string;
  startTime: number;
}

/**
 * Animated thinking steps shown during AI site generation.
 * Steps update in real-time based on elapsed time.
 */
export const ThinkingSteps = ({ mode }: { mode: 'normal' | 'ultra' | 'ultra+' }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Steps with timing (in seconds)
  const steps: Step[] = [
    { text: 'Analizuję Twój prompt...', icon: Sparkles, color: '#10b981', startTime: 0 },
    { text: 'Odczytuję design guidelines...', icon: Palette, color: '#8b5cf6', startTime: 3 },
    { text: 'Tworzę komponent Hero.tsx...', icon: Layout, color: '#3b82f6', startTime: 8 },
    { text: 'Tworzę komponent Services.tsx...', icon: FileCode, color: '#06b6d4', startTime: 25 },
    { text: 'Tworzę komponent Testimonials.tsx...', icon: Type, color: '#f59e0b', startTime: 45 },
    { text: 'Tworzę komponent Contact.tsx...', icon: FormInput, color: '#ec4899', startTime: 65 },
    { text: 'Dodaję zdjęcia z Unsplash...', icon: Image, color: '#14b8a6', startTime: 80 },
    { text: 'Tworzę komponent Footer.tsx...', icon: FileCode, color: '#6366f1', startTime: 95 },
    { text: 'Łączę komponenty w App.tsx...', icon: Layout, color: '#8b5cf6', startTime: 110 },
    { text: 'Finalizuję i waliduję kod...', icon: CheckCircle2, color: '#10b981', startTime: 115 },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;

      // Find current step based on elapsed time
      let current = 0;
      for (let i = steps.length - 1; i >= 0; i--) {
        if (elapsed >= steps[i].startTime) {
          current = i;
          break;
        }
      }

      setActiveStep(current);

      // Mark previous steps as completed
      const completed: number[] = [];
      for (let i = 0; i < current; i++) {
        completed.push(i);
      }
      setCompletedSteps(completed);
    }, 500);

    const startTime = Date.now();

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 p-5 overflow-y-auto">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
          <Sparkles size={14} className="text-green-400" />
        </div>
        <div>
          <div className="text-xs font-semibold text-white">SiteMorph Agent</div>
          <div className="text-[10px] text-white/40">Pracuję nad Twoją stroną...</div>
        </div>
      </div>

      <div className="space-y-1">
        {steps.map((step, i) => {
          const isActive = i === activeStep;
          const isCompleted = completedSteps.includes(i);
          const Icon = step.icon;

          if (!isActive && !isCompleted) return null;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 py-2 px-3 rounded-lg"
              style={{
                background: isActive ? `${step.color}10` : 'transparent',
              }}
            >
              <div className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 size={14} style={{ color: step.color }} />
                ) : (
                  <Loader2 size={14} className="animate-spin" style={{ color: step.color }} />
                )}
              </div>
              <span
                className="text-xs"
                style={{
                  color: isActive ? step.color : 'rgba(255,255,255,0.3)',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {step.text}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
