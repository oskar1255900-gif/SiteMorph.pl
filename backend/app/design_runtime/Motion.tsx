import React, { useEffect } from 'react';
import type { SiteConfig } from './types';

export function TextMaskReveal({ children }: { children: React.ReactNode }) {
  return <span className="sm-text-mask" data-reveal="text-mask">{children}</span>;
}

export function usePageMotion(config: SiteConfig) {
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set<Animation>();
    let observer: IntersectionObserver | undefined;
    let raf = 0;
    const durations: Record<string, number> = { 'soft-tactile': 620, structural: 440, 'quiet-editorial': 720, 'sharp-poster': 240, precision: 380, 'calm-care': 420 };
    const duration = (durations[config.tokens.motionStrategy.presetId] || 450) * (config.tokens.motionStrategy.intensity === 'low' ? .8 : 1);
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--motion-ease').trim() || 'ease-out';
    const parallax = Array.from(document.querySelectorAll<HTMLElement>('.sm-parallax')).slice(0, 2);
    function scroll() {
      if (raf || reduced.matches || (innerWidth < 760 && config.mobile.reduceParallax)) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        for (const node of parallax) {
          const rect = node.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top > innerHeight) continue;
          const amount = Math.max(-12, Math.min(12, (innerHeight / 2 - rect.top) * .025));
          node.style.transform = `translate3d(0,${amount}px,0)`;
        }
      });
    }
    function setup() {
      observer?.disconnect(); animations.forEach(a => a.cancel()); animations.clear();
      parallax.forEach(node => node.style.removeProperty('transform'));
      if (reduced.matches || !('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer?.unobserve(entry.target);
          const element = entry.target as HTMLElement;
          const kind = element.dataset.reveal;
          if (kind === 'none') continue;
          const frames = kind === 'text-mask' || kind === 'wipe'
            ? [{ clipPath: 'inset(0 0 100% 0)', transform: 'translateY(8px)' }, { clipPath: 'inset(0 0 0 0)', transform: 'translateY(0)' }]
            : [{ opacity: .35 }, { opacity: 1 }];
          const animation = element.animate(frames, { duration, easing, fill: 'none' });
          animations.add(animation); animation.finished.then(() => animations.delete(animation)).catch(() => {});
        }
      }, { threshold: .12 });
      document.querySelectorAll('[data-reveal]').forEach(node => observer?.observe(node));
    }
    setup(); reduced.addEventListener('change', setup);
    if (parallax.length) { addEventListener('scroll', scroll, { passive: true }); addEventListener('resize', setup); }
    return () => { observer?.disconnect(); animations.forEach(a => a.cancel()); cancelAnimationFrame(raf);
      reduced.removeEventListener('change', setup); removeEventListener('scroll', scroll); removeEventListener('resize', setup); };
  }, [config]);
}
