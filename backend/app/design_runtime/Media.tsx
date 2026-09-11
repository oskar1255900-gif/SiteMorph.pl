import React, { useState } from 'react';
import type { MediaRef } from './types';

export function ResponsiveImage({ media, eager = false, className = '', onFailure }: { media?: MediaRef; eager?: boolean; className?: string; onFailure?: () => void }) {
  const [failed, setFailed] = useState(false);
  if (!media?.src || failed) return null;
  const point = media.focalPoint || { x: 50, y: 50 };
  const mobile = media.mobileFocalPoint || point;
  const srcSet = media.src.startsWith('https://images.unsplash.com/') ? [480, 800, 1200, 1600].map(width => {
    const url = new URL(media.src!); url.searchParams.set('w', String(width)); url.searchParams.set('q', '80'); url.searchParams.set('auto', 'format'); return `${url.href} ${width}w`;
  }).join(', ') : undefined;
  return <figure className={`sm-media ${className}`} style={{ '--aspect': (media.aspect || '4:5').replace(':', '/'), '--focal': `${point.x}% ${point.y}%`, '--mobile-focal': `${mobile.x}% ${mobile.y}%` } as React.CSSProperties}>
    <img src={media.src} srcSet={srcSet} sizes={srcSet ? '(max-width: 760px) 100vw, 65vw' : undefined} alt={media.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : 'auto'} onError={() => { setFailed(true); onFailure?.(); }} />
    {media.credit && <figcaption><a href={media.source} target="_blank" rel="noopener noreferrer">{media.credit} / Unsplash</a></figcaption>}
  </figure>;
}

export function ImageMaskReveal({ media, eager = false }: { media?: MediaRef; eager?: boolean }) {
  return <div data-reveal="wipe"><ResponsiveImage media={media} eager={eager}/></div>;
}

export function ParallaxMedia({ media }: { media?: MediaRef }) {
  return <div className="sm-parallax"><ResponsiveImage media={media}/></div>;
}
