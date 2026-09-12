import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui';

export const CookieBanner = () => {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    try { if (!localStorage.getItem('sitemorph-cookies-accepted')) setShow(true); } catch { setShow(true); }
  }, []);
  if (!show) return null;
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      className="fixed bottom-4 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col items-stretch gap-3 rounded-[12px] border border-[var(--sm-border)] bg-[var(--sm-surface)] p-4 shadow-2xl sm:flex-row sm:items-center"
      role="region"
      aria-label="Zgoda na pliki cookie"
    >
      <p className="flex-1 text-[15px] leading-[1.55] text-[var(--sm-text-2)]">
        Używamy plików cookie, aby strona działała poprawnie.
        <button
          onClick={() => { try{localStorage.setItem('sitemorph-cookies-accepted','1')}catch{}; setShow(false); }}
          className="ml-1.5 bg-transparent border-none p-0 text-[15px] font-medium text-[var(--sm-accent)] underline cursor-pointer"
        >
          Polityka cookies
        </button>
      </p>
      <Button variant="primary" size="md" onClick={() => { try{localStorage.setItem('sitemorph-cookies-accepted','1')}catch{}; setShow(false); }} className="shrink-0">Akceptuj</Button>
    </motion.div>
  );
};

// ============================================================================
// 14a. PANEL ADMINISTRATORA (pełnoekranowe okno)
// ============================================================================
