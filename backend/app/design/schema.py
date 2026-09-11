"""Canonical validated spec. No executable code, CSS strings or arbitrary widgets."""
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Meta(Model):
    schemaVersion: Literal["2.0"]
    locale: str = Field(default="pl-PL", pattern=r"^[a-z]{2}(?:-[A-Z]{2})?$")
    siteType: Literal["single-page-business-site"] = "single-page-business-site"
    confidence: float = Field(default=0.5, ge=0, le=1)
    assumptions: List[str] = Field(default_factory=list, max_length=12)
    unknowns: List[str] = Field(default_factory=list, max_length=12)


class BusinessBrief(Model):
    name: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=150)
    positioning: str = Field(min_length=1, max_length=400)
    audience: str = Field(min_length=1, max_length=400)
    primaryConversion: str = Field(min_length=1, max_length=160)
    secondaryConversions: List[str] = Field(default_factory=list, max_length=5)
    keySignals: List[str] = Field(default_factory=list, max_length=10)
    risks: List[str] = Field(default_factory=list, max_length=8)


HeroFamily = Literal["immersive-photographic", "type-driven-poster", "editorial-split", "layered-type-media", "product-stage", "asymmetric-editorial", "narrative-sequence", "catalog-monument", "minimal-architectural", "cinematic-atmosphere", "stacked-product-focus", "location-first", "frame-break", "grid-fragment"]


class Signature(Model):
    type: Literal["typography-treatment", "media-composition", "interaction-behavior", "scroll-moment", "grid-system", "shape-recurrence"]
    description: str = Field(min_length=1, max_length=400)
    scope: Literal["hero-only", "hero-plus-2-sections", "page-wide-light"] = "hero-only"


class Creative(Model):
    conceptTitle: str = Field(min_length=3, max_length=120)
    visualThesis: str = Field(min_length=15, max_length=500)
    heroFamily: HeroFamily
    visualSignature: Signature
    forbiddenPatterns: List[str] = Field(default_factory=list, max_length=12)
    justifications: Dict[str, str] = Field(default_factory=dict)


class SemanticProfile(Model):
    materiality: List[str] = Field(min_length=1, max_length=8)
    brandTempo: List[str] = Field(min_length=1, max_length=5)
    formality: List[str] = Field(min_length=1, max_length=5)
    culturalSignalsDesired: List[str] = Field(default_factory=list, max_length=6)
    culturalSignalsAvoid: List[str] = Field(default_factory=list, max_length=6)


class ColorStrategy(Model):
    base: str
    textPrimary: str
    actionPrimaryBg: str
    actionPrimaryText: str
    accentSoft: str
    baseAlt: Optional[str] = None
    surface: Optional[str] = None
    dominantField: Optional[str] = None
    textSecondary: Optional[str] = None
    imageTreatment: Literal["natural", "warm", "muted", "contrast"] = "natural"

    @field_validator("base", "textPrimary", "actionPrimaryBg", "actionPrimaryText", "accentSoft", "baseAlt", "surface", "dominantField", "textSecondary")
    @classmethod
    def hex_color(cls, value):
        import re
        if value is not None and not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise ValueError("Kolor musi mieć format #RRGGBB")
        return value


class TypographyStrategy(Model):
    displayFontId: str
    textFontId: str
    displayMood: str = ""
    textMood: str = ""
    contrast: Literal["low", "medium", "high"] = "high"
    scale: Literal["restrained", "editorial", "poster", "monument"] = "editorial"
    casing: Literal["sentence", "uppercase"] = "sentence"


class ShapeStrategy(Model):
    family: Literal["soft-organic", "restrained-rounded", "architectural", "poster-cut", "industrial-precise"]
    radiusMode: Literal["none", "small", "medium", "selective"] = "selective"
    imageMaskMode: Literal["rect", "arch", "circle", "inset"] = "rect"
    dividerMode: Literal["line", "space", "strong"] = "line"


class MotionStrategy(Model):
    presetId: Literal["soft-tactile", "structural", "quiet-editorial", "sharp-poster", "precision", "calm-care"]
    intensity: Literal["low", "medium"] = "low"
    heroReveal: Literal["none", "text-mask", "wipe", "fade"] = "text-mask"
    sectionReveal: Literal["none", "wipe", "fade"] = "none"
    hoverMode: Literal["none", "lift", "underline", "scale"] = "underline"


class SpacingStrategy(Model):
    densityCurve: str = "impact / pause / resolve"
    containerMix: Literal["contained", "mixed", "wide"] = "mixed"
    sectionSpacingMode: Literal["compact", "editorial", "generous"] = "editorial"


class Tokens(Model):
    colorStrategy: ColorStrategy
    typographyStrategy: TypographyStrategy
    shapeStrategy: ShapeStrategy
    motionStrategy: MotionStrategy
    spacingStrategy: SpacingStrategy = Field(default_factory=SpacingStrategy)


class AssetRequest(Model):
    id: str = Field(pattern=r"^[a-z][a-z0-9-]{0,39}$")
    subject: str = Field(min_length=1, max_length=140)
    query: str = Field(min_length=2, max_length=220)
    role: Literal["hero", "gallery", "support"] = "support"
    orientation: Literal["landscape", "portrait", "squarish"] = "landscape"
    cameraDistance: Literal["macro", "close", "mid", "wide"] = "mid"
    lighting: str = Field(default="", max_length=80)
    style: str = Field(default="", max_length=100)
    negativeTerms: List[str] = Field(default_factory=list, max_length=8)


class AssetPlan(Model):
    assetConfidence: Literal["low", "medium", "high"] = "low"
    requests: List[AssetRequest] = Field(default_factory=list, max_length=8)
    requiredShotTypes: List[str] = Field(default_factory=list, max_length=8)
    consistencyRules: List[str] = Field(default_factory=list, max_length=6)
    fallbackMode: Literal["type-led", "media-light"] = "type-led"


Primitive = Literal["ImmersiveHero", "EditorialHero", "TypeDrivenHero", "ProductStage", "EditorialSplit", "ImageBreak", "ProductRail", "StorySpread", "StickyNarrative", "HorizontalGallery", "EditorialMenu", "LocationCanvas", "CTASection", "FAQSection", "ContactSection"]


class Rhythm(Model):
    density: Literal["low", "medium", "high"] = "medium"
    containment: Literal["contained", "full-bleed", "mixed"] = "contained"
    paceRole: Literal["accelerate", "stabilize", "pause", "peak", "resolve"] = "stabilize"


class Section(Model):
    id: str = Field(pattern=r"^[a-z][a-z0-9-]{0,39}$")
    primitive: Primitive
    role: Literal["hero", "proof", "immersion", "story", "menu", "location", "conversion", "footer"]
    props: Dict[str, Any]
    rhythm: Rhythm = Field(default_factory=Rhythm)
    tone: Literal["default", "quiet", "contrast"] = "default"
    container: Literal["narrow", "standard", "wide", "full"] = "standard"
    signature: bool = False


class PagePlan(Model):
    rhythmArc: str = Field(min_length=3, max_length=200)
    sections: List[Section] = Field(min_length=3, max_length=12)


class Link(Model):
    kind: Literal["anchor", "external", "tel", "mailto", "map", "social"]
    label: str = Field(min_length=1, max_length=100)
    href: str = Field(min_length=1, max_length=1000)
    targetSectionId: Optional[str] = None
    required: bool = True


class NavItem(Model):
    itemLabel: str = Field(min_length=1, max_length=40)
    targetSectionId: str


class Form(Model):
    id: str
    mode: Literal["mailto", "disabled-placeholder"]
    email: Optional[str] = None
    fields: List[Literal["name", "email", "message"]] = Field(default_factory=lambda: ["name", "email", "message"])


class Widget(Model):
    id: str
    type: Literal["tabs", "accordion", "gallery", "carousel", "mobile-nav", "form"]
    expectedBehavior: List[str] = Field(default_factory=list)


class Interactions(Model):
    links: List[Link] = Field(default_factory=list, max_length=24)
    nav: List[NavItem] = Field(default_factory=list, max_length=6)
    widgets: List[Widget] = Field(default_factory=list, max_length=12)
    forms: List[Form] = Field(default_factory=list, max_length=2)


class Mobile(Model):
    headlineSize: int = Field(default=56, ge=36, le=80)
    bodySize: int = Field(default=16, ge=16, le=20)
    sectionSpacing: int = Field(default=56, ge=32, le=88)
    heroTextOrder: Literal["before-media", "after-media"] = "before-media"
    heroAspect: Literal["1:1", "4:5", "3:2", "16:9"] = "4:5"
    reduceParallax: bool = True
    focalPoints: Dict[str, List[int]] = Field(default_factory=dict)


class ValidationHints(Model):
    mustKeepWorking: List[str] = Field(default_factory=list, max_length=12)
    antiSlopChecks: List[str] = Field(default_factory=list, max_length=12)


class SiteMorphSpecV2(Model):
    meta: Meta
    businessBrief: BusinessBrief
    creative: Creative
    semanticProfile: SemanticProfile
    tokens: Tokens
    assetPlan: AssetPlan = Field(default_factory=AssetPlan)
    pagePlan: PagePlan
    interactions: Interactions
    mobile: Mobile = Field(default_factory=Mobile)
    validationHints: ValidationHints = Field(default_factory=ValidationHints)
