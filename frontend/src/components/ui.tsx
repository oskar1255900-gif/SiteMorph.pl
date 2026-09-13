import * as React from 'react';
import { motion } from 'framer-motion';

/* ============================================================================
   GLOBAL STYLES — one visual language across the app.
   Tokens live in index.css (--sm-*). Here: base reset + global effects.
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
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    h1, h2, h3, h4 {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin: 0;
    }

    ::selection { background: var(--sm-accent); color: var(--sm-accent-ink); }
    .sm-scroll { scrollbar-width: thin; scrollbar-color: var(--sm-border-strong) transparent; }

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
   BUTTON — 44px standard, 48px CTA. Clean, no excessive shadows.
   ========================================================================== */
type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'blue' | 'lime';

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
    md: 'min-h-[44px] px-5 text-[15px] gap-2 rounded-[8px] font-medium',
    lg: 'min-h-[48px] px-6 text-[16px] gap-2.5 rounded-[10px] font-semibold'
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'border border-transparent text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]',
    blue: 'border border-transparent text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]',
    lime: 'border border-transparent text-white bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA]',
    outline:
      'border border-[var(--sm-border)] text-[var(--sm-text)] bg-[var(--sm-surface)] hover:bg-[var(--sm-surface-2)] hover:border-[var(--sm-border-strong)]',
    ghost:
      'border border-transparent text-[var(--sm-text)] bg-transparent hover:bg-[var(--sm-surface-2)]'
  };

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-colors duration-150 cursor-pointer select-none disabled:opacity-45 disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};

/* ============================================================================
   BADGE — pill only for statuses, filters, toggles.
   ========================================================================== */
export const Badge = ({
  children,
  type = 'default'
}: {
  children: React.ReactNode;
  type?: 'default' | 'blue' | 'success' | 'warning' | 'danger';
}) => {
  const styles: Record<string, string> = {
    default: 'bg-[var(--sm-surface-2)] text-[var(--sm-text-2)] border-[var(--sm-border)] font-medium',
    blue: 'bg-[rgba(37,99,235,0.1)] text-[#2563EB] border-[rgba(37,99,235,0.2)] font-medium dark:bg-[rgba(59,130,246,0.12)] dark:text-[#60A5FA] dark:border-[rgba(59,130,246,0.2)]',
    success: 'bg-[rgba(22,163,74,0.08)] text-[var(--sm-success)] border-[rgba(22,163,74,0.2)] font-medium',
    warning: 'bg-[rgba(217,119,6,0.08)] text-[var(--sm-warning)] border-[rgba(217,119,6,0.2)] font-medium',
    danger: 'bg-[rgba(220,38,38,0.08)] text-[var(--sm-danger)] border-[rgba(220,38,38,0.2)] font-medium',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] border leading-none ${styles[type]}`}>
      {children}
    </span>
  );
};
