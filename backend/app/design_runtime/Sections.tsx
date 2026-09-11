import React, { useRef, useState } from 'react';
import { Actions, Button } from './Navigation';
import { ResponsiveImage, ParallaxMedia } from './Media';

type Props = Record<string, any>;
const Title = ({ children }: { children: React.ReactNode }) => <h2 className="sm-section-title">{children}</h2>;

export function EditorialSplit(p: Props) {
  return <div className={`sm-split ${p.reverse ? 'sm-split--reverse' : ''}`}>
    <div className="sm-split-copy"><Title>{p.heading}</Title><p className="sm-body">{p.body}</p>{p.cta && <Actions items={[p.cta]}/>}</div>
    <ResponsiveImage media={p.media}/>
  </div>;
}

export function ImageBreak(p: Props) {
  if (!p.media?.src) return <div className="sm-quiet"><Title>{p.overlayText || p.caption}</Title><p className="sm-body">{p.fallbackText}</p></div>;
  return <div className={`sm-image-break sm-image-break--${p.mode || 'full-bleed'}`}>
    {p.parallax ? <ParallaxMedia media={p.media}/> : <ResponsiveImage media={p.media}/>} {p.overlayText && <Title>{p.overlayText}</Title>}
    {p.caption && <p className="sm-caption">{p.caption}</p>}
  </div>;
}

export function ProductRail(p: Props) {
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return <><div className="sm-section-heading"><Title>{p.title}</Title>{p.railMode === 'scroll' && <div className="sm-rail-controls"><button onClick={() => scroll(-1)} aria-label="Poprzednie pozycje">←</button><button onClick={() => scroll(1)} aria-label="Następne pozycje">→</button></div>}</div>
    <div ref={rail} className={`sm-product-rail sm-rail--${p.railMode || 'mixed'}`} tabIndex={p.railMode === 'scroll' ? 0 : undefined}>
      {p.items.map((item: any, i: number) => <article key={i}><ResponsiveImage media={item.media}/><div className="sm-product-label"><span className="sm-item-index">{String(i + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.subtitle}</p>{item.href && <Button label={item.linkLabel || 'Zobacz więcej'} href={item.href} kind="ghost"/>}</div></article>)}
    </div></>;
}

export function StorySpread(p: Props) {
  return <div className={`sm-story sm-story--${p.layout || 'text-led'}`}>
    <Title>{p.title}</Title><div className="sm-story-copy">{p.paragraphs.map((text: string, i: number) => <p className="sm-body" key={i}>{text}</p>)}{p.quote && <blockquote>{p.quote}</blockquote>}</div>
    {p.supportingMedia?.length > 0 && <div className="sm-story-media">{p.supportingMedia.map((media: any, i: number) => <ResponsiveImage key={i} media={media}/>)}</div>}
  </div>;
}

export function StickyNarrative(p: Props) {
  return <div className={`sm-narrative sm-narrative--${p.stickySide || 'left'}`}><div className="sm-sticky-title"><Title>{p.title || p.steps[0].title}</Title><span className="sm-caption">{p.caption}</span></div>
    <div>{p.steps.map((step: any, i: number) => <article className="sm-step" key={i}><span className="sm-item-index">{String(i + 1).padStart(2, '0')}</span><h3>{step.title}</h3><p className="sm-body">{step.body}</p><ResponsiveImage media={step.media}/></article>)}</div>
  </div>;
}

export function HorizontalGallery(p: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const media = p.media.filter((item: any) => item.src && !failed.includes(item.src));
  const close = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const dismiss = () => { setSelected(null); opener.current?.focus(); };
  return <><Title>{p.title}</Title>{!media.length && <p className="sm-body">{p.fallbackText}</p>}
    <div className="sm-gallery">{media.map((item: any, i: number) => <button key={item.src} className="sm-gallery-item" onClick={event => { opener.current = event.currentTarget; setSelected(i); setTimeout(() => close.current?.focus(), 0); }} aria-label={`Powiększ: ${item.alt}`}><ResponsiveImage media={item} onFailure={() => { setFailed(previous => [...previous, item.src]); setSelected(null); }}/>{p.captionMode !== 'none' && <span className="sm-caption">{item.alt}</span>}</button>)}</div>
    {selected !== null && <div className="sm-lightbox" role="dialog" aria-modal="true" aria-label="Podgląd zdjęcia" onClick={dismiss} onKeyDown={event => { if (event.key === 'Escape') dismiss(); if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); } }}>
      <button ref={close} onClick={dismiss} aria-label="Zamknij zdjęcie">Zamknij ×</button><img onClick={event => event.stopPropagation()} src={media[selected].src} alt={media[selected].alt}/>
    </div>}</>;
}

export function EditorialMenu(p: Props) {
  const [active, setActive] = useState(0);
  const tabs = p.layoutMode === 'tabs';
  return <><Title>{p.title}</Title>{tabs && <div role="tablist" aria-label={p.title} className="sm-tabs">{p.groups.map((group: any, i: number) => <button key={i} id={`${p.sectionId}-tab-${i}`} role="tab" aria-selected={active === i} aria-controls={`${p.sectionId}-panel-${i}`} tabIndex={active === i ? 0 : -1} onClick={() => setActive(i)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = (i + (event.key === 'ArrowRight' ? 1 : -1) + p.groups.length) % p.groups.length; setActive(next); document.getElementById(`${p.sectionId}-tab-${next}`)?.focus(); } }}>{group.label}</button>)}</div>}
    <div className={`sm-menu sm-menu--${p.layoutMode || 'single-column'}`}>{p.groups.map((group: any, i: number) => <div key={i} hidden={tabs && active !== i} role={tabs ? 'tabpanel' : undefined} id={`${p.sectionId}-panel-${i}`} aria-labelledby={tabs ? `${p.sectionId}-tab-${i}` : undefined}>
      {!tabs && <h3 className="sm-menu-group">{group.label}</h3>}{group.items.map((item: any, j: number) => <article className="sm-menu-item" key={j}><div><h4>{item.name}</h4>{item.description && <p>{item.description}</p>}</div>{item.price && <span className="sm-price">{item.price}</span>}</article>)}
    </div>)}</div></>;
}

export function LocationCanvas(p: Props) {
  return <div className={`sm-location sm-location--${p.layoutMode || 'editorial'}`}><Title>{p.title}</Title><div><address>{p.address}</address>{p.hours?.length > 0 && <ul className="sm-hours">{p.hours.map((line: string, i: number) => <li key={i}>{line}</li>)}</ul>}<Actions items={p.ctas}/></div><ResponsiveImage media={p.media}/></div>;
}

export function CTASection(p: Props) {
  return <div className={`sm-cta-section sm-emphasis--${p.emphasis || 'bold'}`}><Title>{p.headline}</Title>{p.supportingText && <p className="sm-lead">{p.supportingText}</p>}<Actions items={p.ctas}/></div>;
}

export function FAQSection(p: Props) {
  return <div className="sm-faq"><Title>{p.title}</Title><div>{p.items.map((item: any, i: number) => <details key={i}><summary>{item.question}<span aria-hidden="true">+</span></summary><p className="sm-body">{item.answer}</p></details>)}</div></div>;
}

export function ContactSection(p: Props) {
  const [message, setMessage] = useState('');
  const form = p.form;
  return <div className="sm-contact"><div><Title>{p.title}</Title><p className="sm-body">{p.body}</p><Actions items={p.ctas}/></div>
    {form?.mode === 'mailto' && form.email ? <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); location.href = `mailto:${form.email}?subject=${encodeURIComponent('Wiadomość ze strony — ' + data.get('name'))}&body=${encodeURIComponent(String(data.get('message')) + '\n\n' + data.get('email'))}`; setMessage('Dokończ wysyłkę w programie pocztowym.'); }}>
      <label>Imię<input name="name" autoComplete="name" required maxLength={100}/></label><label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={200}/></label><label>Wiadomość<textarea name="message" rows={4} required maxLength={3000}/></label>
      <button className="sm-button" type="submit">Otwórz wiadomość e-mail ↗</button><p className="sm-caption" role="status">{message || 'Wysyłka przez Twój program pocztowy.'}</p>
    </form> : form ? <p className="sm-body">Formularz kontaktowy jest obecnie niedostępny. Skorzystaj z podanych danych kontaktowych.</p> : null}
  </div>;
}
