import { useEffect } from 'react';
import { motion } from 'framer-motion';

export const SplashScreen = ({ onComplete, theme }: { onComplete: () => void; theme: 'light' | 'dark' }) => {
  const letters = 'SITEMORPH'.split('');

  useEffect(() => {
    const timer = setTimeout(() => onComplete(), 1400);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none transition-colors duration-300 ${
        theme === 'dark' ? 'bg-black' : 'bg-white'
      }`}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)', transition: { duration: 0.28, ease: 'easeInOut' } }}
    >
      {/* Wielki napis SITEMORPH */}
      <div className="flex items-baseline justify-center px-4">
        {letters.map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 40, scale: 1.6, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ delay: 0.06 + i * 0.038, type: 'spring' as const, stiffness: 300, damping: 24 }}
            className="text-gradient-lime-flow leading-none tracking-tighter"
            style={{
              fontFamily: "'SF Pro Display', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(3rem, 13vw, 11rem)',
              animationDelay: `${-(i / letters.length) * 9}s`
            }}
          >
            {ch}
          </motion.span>
        ))}
      </div>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0, letterSpacing: '0.6em' }}
        animate={{ opacity: 1, letterSpacing: '0.35em' }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="mt-6 text-[11px] sm:text-xs font-bold uppercase text-neutral-400"
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
