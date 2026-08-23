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

/* CINEMATIC — kinowe wejścia z blur, rotacją 3D, overshootem, depth-of-field */
export const cineParent = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.06 } }
};

export const cineChild = {
  hidden: { opacity: 0, y: 120, z: -200, scale: 0.85, rotateX: -30, rotateY: 8, filter: 'blur(20px)' },
  visible: {
    opacity: 1,
    y: 0,
    z: 0,
    scale: 1,
    rotateX: 0,
    rotateY: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 100, damping: 18, mass: 1.2, duration: 0.9 }
  }
};

export const cineSoft = {
  hidden: { opacity: 0, y: 80, z: -100, scale: 1.08, rotateX: -12, filter: 'blur(24px)' },
  visible: {
    opacity: 1,
    y: 0,
    z: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 85, damping: 22, mass: 1.1 }
  }
};

/* Ultra-cinematic dla hero/headlines */
export const cineHero = {
  hidden: { opacity: 0, y: 160, z: -400, scale: 0.7, rotateX: -40, rotateZ: -4, filter: 'blur(32px)' },
  visible: {
    opacity: 1,
    y: 0,
    z: 0,
    scale: 1,
    rotateX: 0,
    rotateZ: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 70, damping: 16, mass: 1.5, duration: 1.2 }
  }
};

/* Cinematic stagger dla list/gridów */
export const cineStagger = {
  hidden: { opacity: 0, y: 60, scale: 0.9, rotateX: -15, filter: 'blur(12px)' },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 120, damping: 20, delay: i * 0.08, mass: 1 }
  })
};

/* Cinematic page transition */
export const cinePage = {
  initial: { opacity: 0, y: 40, scale: 0.96, filter: 'blur(16px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -30, scale: 0.98, filter: 'blur(20px)' },
  transition: { type: 'spring' as const, stiffness: 100, damping: 20 }
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
