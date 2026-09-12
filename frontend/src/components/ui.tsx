import * as React from 'react';
import { motion } from 'framer-motion';

/* ============================================================================
   GLOBALNE STYLE — jeden język wizualny dla całego panelu.
   Paleta i prymitywy żyją w index.css (tokeny --sm-*), tutaj tylko to,
   czego nie da się wyrazić klasami Tailwinda.
   ========================================================================== */
export const GlobalStyles = () => (
  <style>{`
    /* SF PRO DISPLAY (pliki lokalne z /fonts) */
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
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
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
    .sm-scroll { scrollbar-width: thin; scrollbar-color: var(--sm-border-strong) transparent; }

    /* Akcent marki: turkus przechodzący subtelnie w limonkę.
       Używany oszczędnie — tylko logotyp i jedna akcentowana fraza. */
    .sm-brand-gradient {
      background: linear-gradient(100deg, var(--sm-accent) 0%, var(--sm-accent-2) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: transparent;
    }

    /* Ukryty scrollbar tam, gdzie scroll jest techniczny (listy w dropdownach) */
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
   BUTTON — 44px zwykły, 48px główne CTA. Bez font-black, bez poświat.
   ========================================================================== */

type ButtonVariant = 'primary' | 'lime' | 'outline' | 'ghost' | 'blue';

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
  // Wszystkie rozmiary trzymają minimum 44px wysokości (wygodne dotykowo).
  const sizeStyles = {
    sm: 'min-h-[44px] px-4 text-[14px] gap-2 rounded-[10px] font-semibold',
    md: 'min-h-[44px] px-5 text-[15px] gap-2 rounded-[10px] font-semibold',
    lg: 'min-h-[48px] px-6 text-[16px] gap-2.5 rounded-[10px] font-semibold'
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'border border-transparent text-[var(--sm-accent-ink)] bg-[var(--sm-accent)] hover:brightness-[1.06]',
    blue: 'border border-transparent text-[var(--sm-accent-ink)] bg-[var(--sm-accent)] hover:brightness-[1.06]',
    lime: 'border border-transparent text-[var(--sm-accent-ink)] bg-[var(--sm-accent)] hover:brightness-[1.06]',
    outline:
      'border border-[var(--sm-border)] text-[var(--sm-text)] bg-[var(--sm-surface)] hover:bg-[var(--sm-surface-2)] hover:border-[var(--sm-border-strong)]',
    ghost:
      'border border-transparent text-[var(--sm-text)] bg-transparent hover:bg-[var(--sm-surface-2)]'
  };

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-colors duration-150 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};

/* ============================================================================
   BADGE — pill tylko dla statusów i filtrów.
   ========================================================================== */

export const Badge = ({
  children,
  type = 'default'
}: {
  children: React.ReactNode;
  type?: 'default' | 'lime' | 'blue';
}) => {
  const styles = {
    default:
      'bg-[var(--sm-surface-2)] text-[var(--sm-text-2)] border-[var(--sm-border)] font-medium',
    lime:
      'bg-[color-mix(in_srgb,var(--sm-accent-2)_22%,transparent)] text-[var(--sm-text)] border-[color-mix(in_srgb,var(--sm-accent-2)_35%,transparent)] font-semibold',
    blue:
      'bg-[var(--sm-surface-2)] text-[var(--sm-text)] border-[var(--sm-border)] font-medium'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] border leading-none ${styles[type]}`}>
      {children}
    </span>
  );
};
