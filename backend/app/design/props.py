"""The executable props contract shared by validation and the prompt reference."""
from typing import List, Literal, Optional
from pydantic import Field
from .schema import Model


class CTA(Model):
    label: str = Field(min_length=1, max_length=100)
    href: str = Field(min_length=1, max_length=1000)
    kind: Literal['primary', 'secondary', 'ghost'] = 'primary'


class Point(Model):
    x: int = Field(default=50, ge=0, le=100)
    y: int = Field(default=50, ge=0, le=100)


class Media(Model):
    src: Optional[str] = Field(default=None, max_length=2000)
    alt: str = Field(min_length=1, max_length=220)
    aspect: Literal['1:1', '4:5', '3:2', '16:9', '2:3'] = '4:5'
    focalPoint: Point = Field(default_factory=Point)


class TypeHero(Model):
    headline: str = Field(min_length=1, max_length=180)
    supportingText: str = Field(default='', max_length=450)
    kicker: str = Field(default='', max_length=120)
    typeScaleMode: Literal['poster', 'editorial', 'monument'] = 'poster'
    ctas: List[CTA] = Field(min_length=1, max_length=2)


class EditorialHero(Model):
    headline: str = Field(min_length=1, max_length=180)
    lead: str = Field(default='', max_length=450)
    media: List[Media] = Field(default_factory=list, max_length=2)
    layoutMode: Literal['asymmetric-left', 'asymmetric-right', 'stacked-overlay'] = 'asymmetric-left'
    signatureTreatment: Literal['none', 'type-crop', 'frame-break'] = 'none'
    ctas: List[CTA] = Field(min_length=1, max_length=2)


class ImmersiveHero(Model):
    headline: str = Field(min_length=1, max_length=180)
    subheadline: str = Field(default='', max_length=450)
    media: Optional[Media] = None
    textPlacement: Literal['bottom-left', 'center-left', 'center', 'bottom-center'] = 'bottom-left'
    ctas: List[CTA] = Field(min_length=1, max_length=2)


class StageItem(Model):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=220)
    media: Optional[Media] = None


class ProductStage(Model):
    headline: str = Field(min_length=1, max_length=180)
    products: List[StageItem] = Field(min_length=1, max_length=3)
    stageMode: Literal['single-dominant', 'stacked', 'spread'] = 'spread'
    cta: CTA


class EditorialSplit(Model):
    heading: str = Field(min_length=1, max_length=180)
    body: str = Field(min_length=1, max_length=900)
    media: Optional[Media] = None
    reverse: bool = False
    cta: Optional[CTA] = None


class ImageBreak(Model):
    media: Optional[Media] = None
    overlayText: str = Field(default='', max_length=150)
    caption: str = Field(min_length=1, max_length=220)
    fallbackText: str = Field(min_length=1, max_length=400)
    mode: Literal['full-bleed', 'contained'] = 'full-bleed'
    parallax: bool = False


class RailItem(Model):
    title: str = Field(min_length=1, max_length=100)
    subtitle: str = Field(default='', max_length=300)
    media: Optional[Media] = None
    href: Optional[str] = Field(default=None, max_length=1000)
    linkLabel: str = Field(default='Zobacz więcej', max_length=100)


class ProductRail(Model):
    title: str = Field(min_length=1, max_length=180)
    items: List[RailItem] = Field(min_length=1, max_length=12)
    railMode: Literal['mixed', 'grid', 'scroll'] = 'mixed'


class StorySpread(Model):
    title: str = Field(min_length=1, max_length=180)
    paragraphs: List[str] = Field(min_length=1, max_length=5)
    supportingMedia: List[Media] = Field(default_factory=list, max_length=3)
    quote: Optional[str] = Field(default=None, max_length=400)
    layout: Literal['text-led', 'media-led', 'alternating'] = 'text-led'


class Step(Model):
    title: str = Field(min_length=1, max_length=150)
    body: str = Field(min_length=1, max_length=600)
    media: Optional[Media] = None


class StickyNarrative(Model):
    title: str = Field(min_length=1, max_length=180)
    caption: str = Field(default='', max_length=220)
    steps: List[Step] = Field(min_length=2, max_length=6)
    stickySide: Literal['left', 'right'] = 'left'


class HorizontalGallery(Model):
    title: str = Field(min_length=1, max_length=180)
    media: List[Media] = Field(default_factory=list, max_length=8)
    captionMode: Literal['none', 'below'] = 'below'
    fallbackText: str = Field(min_length=1, max_length=400)


class MenuItem(Model):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default='', max_length=350)
    price: Optional[str] = Field(default=None, max_length=40)


class MenuGroup(Model):
    label: str = Field(min_length=1, max_length=100)
    items: List[MenuItem] = Field(min_length=1, max_length=16)


class EditorialMenu(Model):
    title: str = Field(min_length=1, max_length=180)
    groups: List[MenuGroup] = Field(min_length=1, max_length=6)
    layoutMode: Literal['single-column', 'two-column', 'featured-first', 'tabs'] = 'single-column'


class LocationCanvas(Model):
    title: str = Field(min_length=1, max_length=180)
    address: str = Field(min_length=1, max_length=300)
    hours: List[str] = Field(default_factory=list, max_length=8)
    ctas: List[CTA] = Field(default_factory=list, max_length=2)
    media: Optional[Media] = None
    layoutMode: Literal['info-dominant', 'editorial'] = 'editorial'


class CTASection(Model):
    headline: str = Field(min_length=1, max_length=180)
    supportingText: str = Field(default='', max_length=450)
    ctas: List[CTA] = Field(min_length=1, max_length=2)
    emphasis: Literal['soft', 'bold', 'quiet'] = 'bold'


class FAQItem(Model):
    question: str = Field(min_length=1, max_length=200)
    answer: str = Field(min_length=1, max_length=900)


class FAQSection(Model):
    title: str = Field(min_length=1, max_length=180)
    items: List[FAQItem] = Field(min_length=1, max_length=10)


class ContactSection(Model):
    title: str = Field(min_length=1, max_length=180)
    body: str = Field(default='', max_length=500)
    ctas: List[CTA] = Field(default_factory=list, max_length=2)
    formId: Optional[str] = None


PROPS = {model.__name__: model for model in (EditorialHero, ImmersiveHero, ProductStage, EditorialSplit,
    ImageBreak, ProductRail, StorySpread, StickyNarrative, HorizontalGallery, EditorialMenu,
    LocationCanvas, CTASection, FAQSection, ContactSection)}
PROPS['TypeDrivenHero'] = TypeHero
