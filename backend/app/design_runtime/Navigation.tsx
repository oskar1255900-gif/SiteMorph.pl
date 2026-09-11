import React, { useEffect, useRef, useState } from 'react';
import type { SiteConfig, CTA } from './types';

export function Button({ label, href, kind = 'primary' }: CTA) {
  const external = /^https?:/.test(href);
  return <a className={`sm-button sm-button--${kind}`} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
    <span>{label}</span><span aria-hidden="true" className="sm-arrow">↗</span>
  </a>;
}

export function Actions({ items = [] }: { items?: CTA[] }) {
  return <div className="sm-actions">{items.slice(0, 2).map((item, i) => <Button key={item.href + i} {...item} kind={item.kind || (i ? 'secondary' : 'primary')}/>)}</div>;
}

export function MobileNav({ config }: { config: SiteConfig }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function key(event: KeyboardEvent) { if (event.key === 'Escape' && open) { setOpen(false); button.current?.focus(); } }
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [open]);
  return <header className="sm-header"><a className="sm-brand" href={`#${config.pagePlan.sections[0].id}`}>{config.businessBrief.name}</a>
    <button ref={button} className="sm-menu-toggle" aria-label={open ? 'Zamknij menu' : 'Otwórz menu'} aria-expanded={open} aria-controls="sm-navigation" onClick={() => setOpen(value => !value)}>{open ? 'Zamknij −' : 'Menu +'}</button>
    <nav id="sm-navigation" className={open ? 'sm-nav sm-nav--open' : 'sm-nav'} aria-label="Nawigacja główna">
      {config.interactions.nav.map(item => <a key={item.targetSectionId} href={`#${item.targetSectionId}`} onClick={() => setOpen(false)}>{item.itemLabel}</a>)}
    </nav>
  </header>;
}

export function Footer({ config }: { config: SiteConfig }) {
  return <footer className="sm-footer"><a className="sm-brand" href={`#${config.pagePlan.sections[0].id}`}>{config.businessBrief.name}</a>
    <div className="sm-footer-links">{config.interactions.links.filter(link => !link.href.startsWith('#')).slice(0, 4).map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</div>
    {config.assetCredits.length > 0 && <small>Zdjęcia: {config.assetCredits.map((credit, i) => <React.Fragment key={credit.url}>{i ? ', ' : ''}<a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.name}</a></React.Fragment>)} / <a href="https://unsplash.com/?utm_source=sitemorph&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></small>}
  </footer>;
}
