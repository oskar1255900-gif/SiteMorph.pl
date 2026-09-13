import * as React from 'react';
import { motion } from 'framer-motion';

/* ============================================================================
   GLOBAL STYLES — base reset + global effects
   ========================================================================== */
export const GlobalStyles = () => (
  <style>{`
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYREGULAR.OTF') format('opentype');
      font-weight: 400; font-style: normal; font-display: swap;
    }
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYMEDIUM.OTF') format('opentype');
      font-weight: 500; font-style: normal; font-display: swap;
    }
    @font-face {
      font-family: 'SF Pro Display';
      src: url('/fonts/SFPRODISPLAYBOLD.OTF') format('opentype');
      font-weight: 700; font-style: normal; font-display: swap;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100%;
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      font-size: 16px;
      letter-spacing: -0.011em;
      overflow-x: hidden;
      background: var(--sm-bg);
      color: var(--sm-text);
      transition: background-color 0.25s ease, color 0.25s ease;
    }

    h1, h2, h3, h4 {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin: 0;
    }

    ::selection { background: var(--sm-accent); color: var(--sm-accent-ink); }

    .sm-brand-gradient {
      background: linear-gradient(135deg, #2563EB 0%, #3B82F6 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: transparent;
    }

    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
    }
  `}</style>
);

/* ============================================================================
   BUTTON — surface-based, no borders
   ========================================================================== */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';

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
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const sizeStyles = {
    sm: 'min-h-[44px] px-4 text-[14px] gap-2 rounded-[8px] font-medium',
    md: 'min-h-[44px] px-5 text-[15px] gap-2 rounded-[10px] font-medium',
    lg: 'min-h-[48px] px-6 text-[16px] gap-2.5 rounded-[12px] font-semibold'
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]',
    secondary: 'text-[var(--sm-text)] bg-[var(--sm-surface)] hover:bg-[var(--sm-surface-hover)]',
    ghost: 'text-[var(--sm-text)] bg-transparent hover:bg-[var(--sm-surface-hover)]',
    destructive: 'text-[var(--sm-danger)] bg-transparent hover:bg-[rgba(220,38,38,0.08)]',
    outline: 'text-[var(--sm-text)] bg-transparent hover:bg-[var(--sm-surface-hover)]'
  };

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-colors duration-150 cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};

/* ============================================================================
   BADGE — surface-based
   ========================================================================== */
export const Badge = ({
  children,
  type = 'default'
}: {
  children: React.ReactNode;
  type?: 'default' | 'blue' | 'success' | 'warning' | 'danger';
}) => {
  const styles: Record<string, string> = {
    default: 'bg-[var(--sm-surface)] text-[var(--sm-text-secondary)] font-medium',
    blue: 'bg-[var(--sm-accent-muted)] text-[var(--sm-accent)] font-medium',
    success: 'bg-[rgba(22,163,74,0.08)] text-[var(--sm-success)] font-medium',
    warning: 'bg-[rgba(217,119,6,0.08)] text-[var(--sm-warning)] font-medium',
    danger: 'bg-[rgba(220,38,38,0.08)] text-[var(--sm-danger)] font-medium',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] leading-none ${styles[type]}`}>
      {children}
    </span>
  );
};
