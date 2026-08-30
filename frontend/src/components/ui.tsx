import * as React from 'react';
import { motion } from 'framer-motion';

export const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

    /* SF PRO DISPLAY (pliki lokalne z /fonts) */
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYREGULAR.OTF') format('opentype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYMEDIUM.OTF') format('opentype');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYBOLD.OTF') format('opentype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYHEAVYITALIC.OTF') format('opentype');
      font-weight: 800 900;
      font-style: italic;
      font-display: swap;
    }

    @keyframes marquee {
      0% { transform: translateX(0%); }
      100% { transform: translateX(-50%); }
    }
    .animate-marquee { display: flex; width: 200%; animation: marquee 26s linear infinite; }

    /* Czcionka akcentowa Instrument Serif (elegancka kursywa) */
    .font-story-script {
      font-family: 'Instrument Serif', Georgia, 'Times New Roman', serif;
      font-style: italic;
      font-weight: 400;
      letter-spacing: -0.01em;
    }
    :root { --paper: #fcfcF9; --ink: #131412; --lime: #a3e635; --sage: #d8e4bc; --clay: #e8ddd3; --line: #e7e5e0; }
    .text-lime { color: var(--lime); }
    .bg-lime { background: var(--lime); }
    @keyframes limeFlow {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    .text-gradient-lime-flow {
      background: linear-gradient(90deg, #65a30d, #a3e635, #34d399, #bef264, #34d399, #a3e635, #65a30d);
      background-size: 200% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: limeFlow 9s linear infinite;
    }
    .text-gradient-lime-soft {
      background: linear-gradient(135deg, #bef264 0%, #34d399 50%, #a3e635 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    * {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100%;
      font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
      letter-spacing: -0.011em;
      overflow-x: hidden;
      background: #fff;
      color: #2563eb;
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    html.dark body { background: #000; color: #fff; }
    h1, h2 { font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 700; letter-spacing: -0.03em; line-height: 0.96; }
    h1 em, h2 em { font-style: italic; font-weight: 400; color: #5a6b44; }
    ::selection { background: #2563eb; color: white; } ::-moz-selection { background: #2563eb; color: white; } *::selection { background: #2563eb; color: white; } :focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; } ::-webkit-scrollbar-thumb { background: #2563eb; }

    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    /* Ukryty scrollbar po prawej - czyściej, nie jak AI */
    *::-webkit-scrollbar { width: 0; height: 0; }
    * { scrollbar-width: none; -ms-overflow-style: none; }
  `}</style>
);

// ============================================================================
// 4. KOMPONENTY PRZYCISKÓW I BADGE
// ============================================================================

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled,
  type = 'button'
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'lime' | 'outline' | 'ghost' | 'blue';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5 rounded-2xl font-bold',
    md: 'text-xs px-5 py-2.5 gap-2 rounded-2xl font-black',
    lg: 'text-sm px-7 py-3.5 gap-2.5 rounded-2xl font-black'
  };

  const variantStyles = {
    primary: 'bg-[#2563eb] text-white dark:bg-white dark:text-[#2563eb] shadow-[0_8px_32px_rgba(37,99,235,0.18)] hover:opacity-90 border border-[#2563eb] dark:border-white',
    lime: 'bg-gradient-to-r from-lime-300 to-emerald-400 text-black hover:opacity-95 font-black shadow-lg shadow-lime-400/20',
    blue: 'bg-[#2563eb] text-white hover:bg-blue-700 font-black shadow-[0_8px_32px_rgba(37,99,235,0.18)] border border-[#2563eb]',
    outline: 'bg-transparent text-[#2563eb] dark:text-white border border-blue-300 dark:border-neutral-700 hover:bg-[#F7F6F3] dark:hover:bg-neutral-900',
    ghost: 'bg-transparent text-[#2563eb] dark:text-white hover:bg-[#F7F6F3] dark:hover:bg-neutral-900'
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};


export const Badge = ({
  children,
  type = 'default'
}: {
  children: React.ReactNode;
  type?: 'default' | 'lime' | 'blue';
}) => {
  const styles = {
    default: 'bg-transparent text-[#2563eb] dark:text-white border-[#e7e5e0] dark:border-neutral-800 font-medium tracking-wide uppercase text-[10px]',
    lime: 'bg-[#d8e4bc] text-[#131412] border-[#d8e4bc] font-semibold',
    blue: 'bg-transparent text-[#2563eb] dark:text-white border-[#e7e5e0] dark:border-neutral-800 font-medium'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[11px] border tracking-tight ${styles[type]}`}>
      {children}
    </span>
  );
};

// ============================================================================
// 5. SPLASH SCREEN (MINIMALISTYCZNY: WIELKI SITEMORPH + LIME GRADIENT)
// ============================================================================
