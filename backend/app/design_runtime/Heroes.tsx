import React, { useState } from 'react';
import { Actions } from './Navigation';
import { ResponsiveImage } from './Media';

type Props = Record<string, any>;
function Headline({ text, reveal = 'none' }: { text: string; reveal?: string }) {
  return <h1 className="sm-display" data-reveal={reveal}>{text.split('\n').map((line, i) => <span key={i}>{line}</span>)}</h1>;
}

export function TypeDrivenHero(p: Props) {
  return <div className={`sm-hero sm-hero--type sm-type--${p.typeScaleMode || 'poster'}`}>
    {p.kicker && <p className="sm-kicker">{p.kicker}</p>}
    <Headline text={p.headline} reveal={p.reveal}/>
    <div className="sm-hero-bottom"><p className="sm-lead">{p.supportingText || p.lead}</p><Actions items={p.ctas}/></div>
    <div className="sm-hero-index" aria-hidden="true">01 / {p.category}</div>
  </div>;
}

export function EditorialHero(p: Props) {
  const [failed, setFailed] = useState(false);
  const media = Array.isArray(p.media) ? p.media.filter((m: any) => m?.src) : [];
  if (!media.length || failed) return <TypeDrivenHero {...p} supportingText={p.lead}/>;
  return <div className={`sm-hero sm-hero--editorial sm-editorial--${p.layoutMode || 'asymmetric-left'} sm-signature--${p.signatureTreatment || 'none'}`}>
    <div className="sm-hero-heading"><Headline text={p.headline} reveal={p.reveal}/></div>
    <div className="sm-hero-media"><ResponsiveImage media={media[0]} eager onFailure={() => setFailed(true)}/>{media[1] && <ResponsiveImage media={media[1]} className="sm-secondary-media"/>}</div>
    <div className="sm-hero-copy"><p className="sm-lead">{p.lead}</p><Actions items={p.ctas}/></div>
  </div>;
}

export function ImmersiveHero(p: Props) {
  const [failed, setFailed] = useState(false);
  if (!p.media?.src || failed) return <TypeDrivenHero {...p} supportingText={p.subheadline}/>;
  return <div className={`sm-hero sm-hero--immersive sm-placement--${p.textPlacement || 'bottom-left'}`}>
    <ResponsiveImage media={{ ...p.media, aspect: '16:9' }} eager onFailure={() => setFailed(true)}/>
    <div className="sm-immersive-copy"><Headline text={p.headline} reveal={p.reveal}/><p className="sm-lead">{p.subheadline}</p><Actions items={p.ctas}/></div>
  </div>;
}

export function ProductStage(p: Props) {
  const products = p.products || [];
  return <div className={`sm-hero sm-stage sm-stage--${p.stageMode || 'spread'}`}>
    <div className="sm-stage-heading"><Headline text={p.headline} reveal={p.reveal}/>{p.cta && <Actions items={[p.cta]}/>}</div>
    <div className="sm-stage-products">{products.map((item: any, i: number) => <article key={i}><ResponsiveImage media={item.media} eager={i === 0}/><div className="sm-product-label"><h2>{item.name}</h2><p>{item.description}</p></div></article>)}</div>
  </div>;
}
