export const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30
};

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 }
  }
};

export const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 350, damping: 25 }
  }
};

/* Subtelne wejścia — tylko opacity + delikatne przesunięcie (bez blur/3D) */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const cineParent = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } }
};

export const cineChild = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE }
  }
};

export const cineSoft = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE }
  }
};

/* Delikatne wejście nagłówków */
export const cineHero = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE }
  }
};

/* Stagger dla list/gridów */
export const cineStagger = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE, delay: i * 0.05 }
  })
};

/* Przejście między widokami — szybki, spokojny fade */
export const cinePage = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.18, ease: 'easeOut' }
};

export const getUserId = () => {
  try {
    let id = localStorage.getItem('sitemorph-user-id');
    if (!id) { id = 'user-' + Math.random().toString(36).slice(2, 9); localStorage.setItem('sitemorph-user-id', id); }
    return id;
  } catch { return 'anon'; }
};

export const sha256Hex = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};
