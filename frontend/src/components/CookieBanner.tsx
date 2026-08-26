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
    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] max-w-lg w-[calc(100%-2rem)] rounded-2xl border bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800 shadow-2xl p-4 flex flex-col sm:flex-row items-center gap-3">
      <p className="text-xs font-bold leading-relaxed flex-1" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>Używamy plików cookie, aby strona działała poprawnie. Kliknij Akceptuj, aby kontynuować. <button onClick={() => { try{localStorage.setItem('sitemorph-cookies-accepted','1')}catch{}; setShow(false); }} className="underline font-black">Polityka cookies</button></p>
      <Button variant="primary" size="sm" onClick={() => { try{localStorage.setItem('sitemorph-cookies-accepted','1')}catch{}; setShow(false); }} className="shrink-0">Akceptuj</Button>
    </motion.div>
  );
};

// ============================================================================
// 14a. PANEL ADMINISTRATORA (pełnoekranowe okno)
// ============================================================================
