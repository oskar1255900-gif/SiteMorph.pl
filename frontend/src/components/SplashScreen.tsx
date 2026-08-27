import { useEffect } from 'react';
import { motion } from 'framer-motion';

export const SplashScreen = ({ onComplete, theme }: { onComplete: () => void; theme: 'light' | 'dark' }) => {
  useEffect(() => {
    const timer = setTimeout(() => onComplete(), 1050);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const ink = theme === 'dark' ? '#ffffff' : '#111111';

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none bg-white dark:bg-black transition-colors duration-200"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
    >
      <motion.div
        className="flex items-center gap-5"
        initial={{ opacity: 0, scale: 0.88, letterSpacing: '0.18em', filter: 'blur(8px)' }}
        animate={{ opacity: [0, 1, 1], scale: [0.88, 1.04, 1], letterSpacing: ['0.18em', '-0.025em', '-0.045em'], filter: ['blur(8px)', 'blur(0px)', 'blur(0px)'] }}
        transition={{ duration: 0.72, times: [0, 0.6, 1], ease: [0.22, 1, 0.36, 1] }}
        style={{ color: ink, fontFamily: "'SF Pro Display', sans-serif" }}
      >
        <motion.span
          className="h-3 w-3 shrink-0 bg-current"
          initial={{ borderRadius: '18%', rotate: 0, scale: 0.7 }}
          animate={{ borderRadius: ['18%', '50%', '18%'], rotate: [0, 90, 180], scale: [0.7, 1.2, 1] }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        />
        <span className="text-[clamp(2.8rem,11vw,9rem)] font-bold leading-none">SITEMORPH</span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3, ease: 'easeOut' }}
        className="mt-5 text-[10px] font-medium uppercase tracking-[0.3em] text-neutral-400"
        style={{ fontFamily: "'SF Pro Display', sans-serif" }}
      >
        Buduj strony. Zarabiaj.
      </motion.p>
    </motion.div>
  );
};

// ----------------------------------------------------------------------------
// Landing – dane sekcji
// ----------------------------------------------------------------------------
