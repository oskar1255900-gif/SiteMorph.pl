"""Resolve semantic choices into the exact CSS variables used by the runtime."""
from .fonts import select_typography


def rgb(color):
    return [int(color[i:i + 2], 16) for i in (1, 3, 5)]


def mix(a, b, amount):
    return '#' + ''.join(f'{round(x * (1 - amount) + y * amount):02x}' for x, y in zip(rgb(a), rgb(b)))


def luminance(color):
    channels = [v / 255 for v in rgb(color)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels]
    return sum(v * weight for v, weight in zip(linear, (.2126, .7152, .0722)))


def contrast(a, b):
    high, low = sorted((luminance(a), luminance(b)), reverse=True)
    return (high + .05) / (low + .05)


def readable(text, backgrounds, warnings, role):
    if min(contrast(text, bg) for bg in backgrounds) >= 4.5:
        return text
    selected = max(('#171717', '#ffffff', '#000000'), key=lambda c: min(contrast(c, bg) for bg in backgrounds))
    warnings.append(f'Poprawiono kontrast tekstu: {role}.')
    return selected


def resolve_tokens(spec):
    color, type_, shape, motion, spacing = (getattr(spec.tokens, key) for key in
        ('colorStrategy', 'typographyStrategy', 'shapeStrategy', 'motionStrategy', 'spacingStrategy'))
    fonts = select_typography(type_.displayFontId, type_.textFontId, spec.meta.locale)
    warnings = []
    text = readable(color.textPrimary, [color.base], warnings, 'treść')
    base_alt = color.baseAlt or mix(color.base, text, .035)
    # One text color cannot cover arbitrarily opposite section backgrounds.
    if contrast(text, base_alt) < 4.5:
        base_alt = mix(color.base, text, .035)
        warnings.append('Ujednolicono jasność tła spokojnych sekcji dla czytelności.')
    muted = readable(color.textSecondary or mix(text, color.base, .22), [color.base, base_alt], warnings, 'tekst pomocniczy')
    anchor = color.dominantField or color.actionPrimaryBg
    anchor_text = readable(color.actionPrimaryText, [anchor], warnings, 'sekcja akcentowa')
    button_text = readable(color.actionPrimaryText, [color.actionPrimaryBg], warnings, 'przycisk')
    radius = {'none': '0px', 'small': '4px', 'medium': '14px', 'selective': '6px'}[shape.radiusMode]
    duration, ease = {
        'soft-tactile': (220, 'cubic-bezier(.22,1,.36,1)'), 'structural': (180, 'cubic-bezier(.2,.7,.3,1)'),
        'quiet-editorial': (240, 'cubic-bezier(.25,.6,.3,1)'), 'sharp-poster': (130, 'cubic-bezier(.7,0,.2,1)'),
        'precision': (160, 'cubic-bezier(.4,0,.2,1)'), 'calm-care': (260, 'cubic-bezier(.22,.61,.36,1)'),
    }[motion.presetId]
    variables = {
        'base': color.base, 'base-alt': base_alt, 'text': text, 'muted': muted,
        'anchor': anchor, 'anchor-text': anchor_text, 'accent-soft': color.accentSoft,
        'surface': color.surface or base_alt, 'border': mix(text, color.base, .80),
        'button-bg': color.actionPrimaryBg, 'button-text': button_text, 'button-radius': radius,
        'media-radius': radius if shape.radiusMode != 'selective' else '0px',
        'font-display': f'"{fonts["display"]["family"]}",{fonts["display"]["fallback"]}',
        'font-text': f'"{fonts["text"]["family"]}",{fonts["text"]["fallback"]}',
        'display-weight': '700' if type_.displayFontId in {'oswald', 'barlow-condensed', 'archivo', 'space-grotesk', 'sora'} else '400',
        'display-size': {'restrained': 'clamp(56px,6vw,92px)', 'editorial': 'clamp(64px,8vw,124px)',
                         'poster': 'clamp(76px,10vw,154px)', 'monument': 'clamp(84px,13vw,190px)'}[type_.scale],
        'display-tracking': '-.025em' if fonts['display']['fallback'] == 'serif' else '-.045em',
        'display-case': 'uppercase' if type_.casing == 'uppercase' else 'none',
        'gutter': 'clamp(24px,5vw,96px)' if spacing.containerMix != 'wide' else 'clamp(24px,3vw,60px)',
        'section-space': {'compact': '64px', 'editorial': '96px', 'generous': '120px'}[spacing.sectionSpacingMode],
        'body-size': '17px', 'motion-fast': f'{duration}ms', 'motion-ease': ease,
        'mobile-body-size': f'{spec.mobile.bodySize}px', 'mobile-space': f'{spec.mobile.sectionSpacing}px',
        'mobile-display': f'{spec.mobile.headlineSize}px', 'mobile-display-fluid': f'{round(spec.mobile.headlineSize / 3.9, 2)}vw',
        'hero-mobile-aspect': spec.mobile.heroAspect.replace(':', '/'),
    }
    return variables, fonts, warnings
