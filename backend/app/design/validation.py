import json
import re
from collections import Counter
from copy import deepcopy
from typing import Any, Dict, List, Literal, Union, get_args, get_origin
from urllib.parse import urlparse
from pydantic import BaseModel, ValidationError
from .schema import Link, Section, SiteMorphSpecV2
from .props import PROPS
from .fonts import select_typography

HEROES = {'ImmersiveHero', 'EditorialHero', 'TypeDrivenHero', 'ProductStage'}

try:  # PEP 604 unions (X | None) exist from Python 3.10 onward.
    from types import UnionType as _UnionType
    _UNION_ORIGINS = (Union, _UnionType)
except ImportError:  # pragma: no cover - older interpreters only have typing.Union
    _UNION_ORIGINS = (Union,)

# Enum spellings the model sends for a field whose contract declares a
# different value. An alias is applied only when the raw value is NOT a valid
# member and the alias IS one, so a field that genuinely accepts the raw value
# (for example containerMix="wide") is never rewritten.
ENUM_ALIASES = {
    'landrait': 'landscape',
    'square': 'squarish',
    'wide': 'full-bleed',
    # Nemotron 3 Super paceRole variants
    'maintain': 'stabilize',
    'transition': 'stabilize',
    'steady': 'stabilize',
    'build': 'accelerate',
    'intro': 'pause',
    'climax': 'peak',
    'rest': 'pause',
    'awaken': 'accelerate',
    # density variants
    'normal': 'medium',
    # imageMaskMode variants
    'rectangle': 'rect',
    # presetId variants
    'calm': 'calm-care',
}

# Path-specific enum aliases: {field_suffix: {raw_value: replacement}}.
# Applied before global ENUM_ALIASES so the same value can map differently
# depending on which field it appears in.
FIELD_ENUM_ALIASES: dict[str, dict[str, str]] = {
    '.type': {
        'EditorialMenu': 'tabs',
    },
}

# validate_spec() requires a link's kind to agree with its href's scheme. The
# href is the authoritative side of that pair: it is what the page actually
# links to, it is what every CTA prop is matched against, and the design runtime
# reads the scheme straight off it. Only the label is ever corrected.
LINK_KIND_PREFIXES = {
    'anchor': '#',
    'tel': 'tel:',
    'mailto': 'mailto:',
}
LINK_HTTPS_PREFIX = 'https://'


class NormalizationReport(list):
    """Repaired field paths plus the remaining diagnostics buckets.

    Subclasses list so a caller that used to receive a plain list of changed
    paths keeps working unchanged, while diagnostics can also report which
    fields were dropped, aliased or truncated.
    """

    def __init__(self):
        super().__init__()
        self.dropped_fields: List[str] = []
        self.relocated_fields: List[Dict[str, str]] = []
        self.derived_fields: List[Dict[str, str]] = []
        self.enum_aliases: List[Dict[str, str]] = []
        self.truncated_fields: List[Dict[str, Any]] = []

    @property
    def normalized_fields(self) -> List[str]:
        return list(self)

    def buckets(self) -> Dict[str, Any]:
        return {
            'normalized_fields': self.normalized_fields,
            'dropped_fields': self.dropped_fields,
            'relocated_fields': self.relocated_fields,
            'derived_fields': self.derived_fields,
            'enum_aliases': self.enum_aliases,
            'truncated_fields': self.truncated_fields,
        }

    def __bool__(self):
        return bool(self.normalized_fields or self.dropped_fields
                    or self.relocated_fields or self.derived_fields
                    or self.enum_aliases or self.truncated_fields)


def _unwrap(annotation):
    """Reduce Optional[X] / X | None to X and leave every other annotation."""
    if get_origin(annotation) in _UNION_ORIGINS:
        args = [arg for arg in get_args(annotation) if arg is not type(None)]
        if len(args) == 1:
            return args[0]
    return annotation


def _kind(annotation):
    annotation = _unwrap(annotation)
    if annotation is Any or annotation is None:
        return 'any', None
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return 'model', annotation
    origin = get_origin(annotation)
    if origin is Literal:
        return 'enum', get_args(annotation)
    if origin in (list, set, frozenset, tuple):
        args = get_args(annotation)
        return 'list', args[0] if args else Any
    if origin is dict:
        args = get_args(annotation)
        return 'dict', args[1] if len(args) == 2 else Any
    if annotation is str:
        return 'str', None
    return 'other', None


def _max_length(info):
    for meta in getattr(info, 'metadata', None) or ():
        limit = getattr(meta, 'max_length', None)
        if isinstance(limit, int) and not isinstance(limit, bool):
            return limit
    return None


def _truncate(text, limit):
    """Cut to max_length, preferring the last word boundary that still fits."""
    cut = text[:limit]
    if text[limit:limit + 1] not in ('', ' ') and ' ' in cut:
        head = cut.rsplit(' ', 1)[0].rstrip()
        if head:
            return head
    return cut


def _normalize_value(value, annotation, path, report, info=None):
    kind, extra = _kind(annotation)
    if kind == 'model':
        return _normalize_model(value, extra, path, report)
    if kind == 'list':
        return _normalize_list(value, extra, path, report)
    if kind == 'dict':
        return _normalize_dict(value, extra, path, report)
    if kind == 'enum':
        return _normalize_enum(value, extra, path, report)
    if kind == 'str':
        return _normalize_str(value, path, report, info)
    if kind == 'any':
        return _normalize_any(value, path, report)
    return value


def _relocate_interactions(payload, report):
    """Recover the one known mis-nesting: ``interactions`` inside ``pagePlan``.

    Deliberately narrow: only this key, only from this location, only when the
    root is absent and the nested value really is an object. Nothing is searched
    for elsewhere, no value is defaulted, and a nested copy that duplicates a
    valid root value is left alone to be dropped as an undeclared key.
    """
    page_plan = payload.get('pagePlan')
    if not isinstance(page_plan, dict) or 'interactions' in payload:
        return
    nested = page_plan.get('interactions')
    if not isinstance(nested, dict):
        return
    payload['interactions'] = page_plan.pop('interactions')
    report.relocated_fields.append({'from': 'pagePlan.interactions', 'to': 'interactions'})


def _link_kind_for(href):
    """The kind the contract's own prefix rule assigns to this href.

    Returns None when no declared kind fits, so a link with an unusable address
    is left exactly as sent for validate_spec() to reject.
    """
    if not isinstance(href, str):
        return None
    for kind, prefix in LINK_KIND_PREFIXES.items():
        if href.startswith(prefix):
            return kind
    if href.startswith(LINK_HTTPS_PREFIX):
        # external, map and social all legitimately use https, and the href
        # alone cannot tell them apart, so the neutral one is used.
        return 'external'
    return None


def _repair_link_kind(value, path, report):
    """Make a declared link kind match the href it actually points at.

    Only a present, disagreeing kind is rewritten. A missing kind stays missing
    (a required field is never invented) and an href that fits no kind is left
    alone, so validate_spec() still rejects genuinely broken links.
    """
    kind, href = value.get('kind'), value.get('href')
    if not isinstance(kind, str) or not isinstance(href, str):
        return
    if href.startswith(LINK_KIND_PREFIXES.get(kind, LINK_HTTPS_PREFIX)):
        return
    candidate = _link_kind_for(href)
    if candidate is None or candidate == kind:
        return
    value['kind'] = candidate
    report.enum_aliases.append(
        {'field': f'{path}.kind', 'from': kind, 'to': candidate, 'match': 'href'}
    )


def _normalize_model(value, model, path, report):
    """Drop keys the contract does not declare; recurse into the rest."""
    if not isinstance(value, dict):
        return value
    fields = model.model_fields
    props_model = None
    primitive = value.get('primitive')
    if model is Section and isinstance(primitive, str) and primitive in PROPS:
        # Section props are typed per primitive, so the primitive tells us
        # exactly which keys the contract allows here.
        props_model = PROPS[primitive]
    for key in list(value):
        child = f'{path}.{key}' if path else key
        if key not in fields:
            del value[key]
            report.dropped_fields.append(child)
            continue
        if key == 'props' and props_model is not None:
            value[key] = _normalize_model(value[key], props_model, child, report)
            continue
        info = fields[key]
        value[key] = _normalize_value(value[key], info.annotation, child, report, info)
    if model is Link:
        _repair_link_kind(value, path, report)
    return value


def _normalize_list(value, item_annotation, path, report):
    if isinstance(value, list):
        for index, item in enumerate(value):
            value[index] = _normalize_value(item, item_annotation, f'{path}[{index}]', report)
        return value
    if isinstance(value, str) and value.strip() and _kind(item_annotation)[0] == 'str':
        # A lone string where the contract wants string[]: wrap it, never split
        # it into items the model did not send.
        report.append(path)
        return [value.strip()]
    return value


def _normalize_dict(value, item_annotation, path, report):
    if not isinstance(value, dict):
        return value
    for key in list(value):
        value[key] = _normalize_value(value[key], item_annotation, f'{path}.{key}', report)
    return value


def _normalize_enum(value, allowed, path, report):
    if value in allowed:
        return value
    if not isinstance(value, str):
        return value
    raw = value.strip()
    # Check path-specific aliases first (e.g. widget.type ≠ section.primitive)
    candidate = None
    match = ''
    for suffix, mapping in FIELD_ENUM_ALIASES.items():
        if path.endswith(suffix):
            candidate = mapping.get(raw)
            if candidate is not None:
                match = 'field-alias'
                break
    if candidate is None:
        candidate = ENUM_ALIASES.get(raw)
        match = 'alias'
    if candidate not in allowed:
        matches = [option for option in allowed if isinstance(option, str) and option.lower() == raw.lower()]
        candidate, match = (matches[0], 'case') if len(matches) == 1 else (None, '')
    if candidate not in allowed:
        # Unknown and unaliased values must still fail validate_spec().
        return value
    report.enum_aliases.append({'field': path, 'from': value, 'to': candidate, 'match': match})
    return candidate


def _normalize_str(value, path, report, info=None):
    if isinstance(value, list):
        if not value or not all(isinstance(item, str) for item in value):
            return value
        # A string[] where the contract wants one scalar: join with a single
        # space. No element is dropped and no separator is invented.
        value = ' '.join(item.strip() for item in value).strip()
        report.append(path)
    elif isinstance(value, str):
        stripped = value.strip()
        if stripped != value:
            value = stripped
            report.append(path)
    else:
        return value
    limit = _max_length(info)
    if limit is not None and len(value) > limit:
        report.truncated_fields.append({'field': path, 'max_length': limit, 'length': len(value)})
        return _truncate(value, limit)
    return value


def _normalize_any(value, path, report):
    if isinstance(value, str):
        stripped = value.strip()
        if stripped != value:
            report.append(path)
            return stripped
        return value
    if isinstance(value, dict):
        for key in list(value):
            value[key] = _normalize_any(value[key], f'{path}.{key}', report)
        return value
    if isinstance(value, list):
        for index, item in enumerate(value):
            value[index] = _normalize_any(item, f'{path}[{index}]', report)
        return value
    return value


def normalize_model_spec(payload):
    """Deterministically repair one model answer against the Pydantic contract.

    Six narrow operations are allowed, all derived from the schema itself:
    dropping keys the contract does not declare, moving ``interactions`` from
    ``pagePlan`` back to the root when the root is absent, string <-> string[]
    coercion for declared fields, trimming surrounding whitespace (and cutting
    text down to the field's max_length), resolving explicitly declared enum
    aliases, and relabelling a link kind that contradicts its own href. Missing
    required fields are never invented and wrong types, unknown enums, colours,
    addresses and identifiers are left exactly as sent, so the result still has
    to pass the full validate_spec(). The raw model answer is never modified.
    Returns the repaired copy plus a report of every change.
    """
    report = NormalizationReport()
    if not isinstance(payload, dict):
        return payload, report
    normalized = deepcopy(payload)
    # Relocation has to happen before the walk, which would otherwise drop the
    # misplaced object as an undeclared key and lose it.
    _relocate_interactions(normalized, report)
    _normalize_model(normalized, SiteMorphSpecV2, '', report)
    _repair_product_media_alts(normalized, report)
    return normalized, report


def _repair_product_media_alts(normalized, report):
    """Copy item.title into item.media.alt when the alt is empty.

    Only applies to ProductRail sections, where each RailItem has a required
    ``title`` and an optional ``media`` with a required ``alt``.  The model
    frequently omits alt on product media.  If the item carries a usable title,
    the same string is copied verbatim — no words are invented.
    """
    page_plan = normalized.get('pagePlan')
    if not isinstance(page_plan, dict):
        return
    sections = page_plan.get('sections')
    if not isinstance(sections, list):
        return
    for sec_idx, section in enumerate(sections):
        if not isinstance(section, dict) or section.get('primitive') != 'ProductRail':
            continue
        props = section.get('props')
        if not isinstance(props, dict):
            continue
        items = props.get('items')
        if not isinstance(items, list):
            continue
        sec_id = section.get('id', f'sections[{sec_idx}]')
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            media = item.get('media')
            if not isinstance(media, dict):
                continue
            alt = media.get('alt')
            if isinstance(alt, str) and alt.strip():
                continue  # already present and non-empty
            title = item.get('title')
            if not isinstance(title, str) or not title.strip():
                continue  # no usable title — let validation reject
            media['alt'] = title.strip()
            report.derived_fields.append({
                'from': f'pagePlan.sections[{sec_idx}].props.items[{idx}].title',
                'to': f'pagePlan.sections[{sec_idx}].props.items[{idx}].media.alt',
            })


def spec_error_summary(exc, limit=6):
    """Exact contract paths from a failed validate_spec, for diagnostics."""
    errors = getattr(exc, 'errors', None)
    if not callable(errors):
        return []
    try:
        items = errors()
    except Exception:
        return []
    summary = []
    for item in items[:limit]:
        location = '.'.join(str(part) for part in item.get('loc', ()))
        message = str(item.get('msg', '')).strip()
        inp = item.get('input')
        if inp is not None:
            message = f"{message} (got: {inp!r})"
        summary.append(f'{location}: {message}' if location else message)
    return summary


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def valid_href(href, section_ids):
    if not isinstance(href, str) or any(ord(c) < 32 for c in href):
        return False
    if href.startswith('#'):
        return href[1:] in section_ids
    if href.startswith('tel:'):
        return bool(re.fullmatch(r'tel:\+?[0-9 ()-]{5,25}', href))
    if href.startswith('mailto:'):
        return bool(re.fullmatch(r'mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+', href))
    parsed = urlparse(href)
    return parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username


def validate_spec(payload, supplied_urls=()):
    if len(json.dumps(payload, ensure_ascii=False)) > 180_000:
        raise ValueError('Plan strony jest zbyt duży.')
    spec = SiteMorphSpecV2.model_validate(payload)
    sections = spec.pagePlan.sections
    ids = [section.id for section in sections]
    if len(ids) != len(set(ids)):
        raise ValueError('Identyfikatory sekcji muszą być unikalne.')
    if {'root', 'sm-navigation'} & set(ids):
        raise ValueError('Identyfikator sekcji jest zarezerwowany przez runtime.')
    if sections[0].role != 'hero' or sections[0].primitive not in HEROES:
        raise ValueError('Pierwsza sekcja musi być hero.')
    if any(s.role == 'hero' or s.primitive in HEROES for s in sections[1:]):
        raise ValueError('Strona może mieć tylko jedno hero i jeden nagłówek h1.')
    hero_primitive = {'immersive-photographic': 'ImmersiveHero', 'cinematic-atmosphere': 'ImmersiveHero',
        'type-driven-poster': 'TypeDrivenHero', 'catalog-monument': 'TypeDrivenHero', 'minimal-architectural': 'TypeDrivenHero',
        'product-stage': 'ProductStage', 'stacked-product-focus': 'ProductStage'}.get(spec.creative.heroFamily, 'EditorialHero')
    if sections[0].primitive != hero_primitive:
        raise ValueError('Kompozycja hero nie odpowiada wybranej rodzinie w creative.heroFamily.')
    select_typography(spec.tokens.typographyStrategy.displayFontId, spec.tokens.typographyStrategy.textFontId, spec.meta.locale)
    asset_ids = [asset.id for asset in spec.assetPlan.requests]
    if len(set(asset_ids)) != len(asset_ids):
        raise ValueError('Powtórzony identyfikator zdjęcia.')
    for point in spec.mobile.focalPoints.values():
        if len(point) != 2 or any(v < 0 or v > 100 for v in point):
            raise ValueError('Punkt kadrowania mobile wymaga [x,y] w zakresie 0–100.')
    declared = {link.href for link in spec.interactions.links}
    for link in spec.interactions.links:
        if not valid_href(link.href, ids):
            raise ValueError('Niedziałający lub niedozwolony link: ' + link.label)
        prefix = {'anchor': '#', 'tel': 'tel:', 'mailto': 'mailto:'}.get(link.kind, 'https://')
        if not link.href.startswith(prefix):
            raise ValueError('Rodzaj linku nie odpowiada adresowi.')
        if link.kind == 'anchor' and link.href != '#' + str(link.targetSectionId or link.href[1:]):
            raise ValueError('Cel kotwicy nie odpowiada adresowi linku.')
    for nav in spec.interactions.nav:
        if nav.targetSectionId not in ids:
            raise ValueError('Nawigacja wskazuje nieistniejącą sekcję.')
    forms = {form.id: form for form in spec.interactions.forms}
    if len(forms) != len(spec.interactions.forms):
        raise ValueError('Powtórzony formularz.')
    for form in forms.values():
        if form.mode == 'mailto' and not valid_href('mailto:' + (form.email or ''), ids):
            raise ValueError('Formularz e-mail wymaga poprawnego adresu.')
        if set(form.fields) != {'name', 'email', 'message'}:
            raise ValueError('Formularz obsługuje pola name, email i message.')
    warnings, used_links, used_forms = [], set(), set()
    for section in sections:
        try:
            section.props = PROPS[section.primitive].model_validate(section.props).model_dump(exclude_none=True)
        except ValidationError as exc:
            # Re-raise as a plain ValueError that names the section, so the
            # builder's log always shows which section failed and which field
            # caused it — even when Pydantic's own loc starts inside the props
            # sub-model and loses the section identity.
            parts = []
            for err in exc.errors():
                loc = '.'.join(str(p) for p in err['loc'])
                msg = str(err.get('msg', ''))
                parts.append(f'{loc}: {msg}' if loc else msg)
            detail = '; '.join(parts) if parts else str(exc)
            raise ValueError(
                f"section {section.id!r} ({section.primitive}) props: {detail}"
            ) from None
        for item in walk(section.props):
            if 'href' in item:
                if item['href'] not in declared or not valid_href(item['href'], ids):
                    raise ValueError('CTA musi mieć działający link zapisany w interactions.links.')
                used_links.add(item['href'])
            if 'src' in item and item['src']:
                src = item['src']
                if src.startswith('asset:'):
                    if src[6:] not in asset_ids:
                        raise ValueError('Zdjęcie wskazuje nieistniejące asset request.')
                elif src not in supplied_urls or not (src.startswith('https://') or re.fullmatch(r'/api/builder/asset/[a-zA-Z0-9_-]+', src)):
                    raise ValueError('Użyj asset:id lub zdjęcia przekazanego przez użytkownika.')
            if 'formId' in item:
                if item['formId'] not in forms:
                    raise ValueError('Sekcja wskazuje nieistniejący formularz.')
                used_forms.add(item['formId'])
    if set(forms) - used_forms:
        raise ValueError('Formularz musi być umieszczony w sekcji kontaktu.')
    by_id = {s.id: s for s in sections}
    widget_primitive = {'tabs': 'EditorialMenu', 'accordion': 'FAQSection', 'gallery': 'HorizontalGallery',
                        'carousel': 'ProductRail', 'form': 'ContactSection'}
    for widget in spec.interactions.widgets:
        if widget.type == 'mobile-nav':
            if not spec.interactions.nav:
                raise ValueError('Menu mobile wymaga pozycji nawigacji.')
            continue
        section = by_id.get(widget.id)
        if not section or section.primitive != widget_primitive[widget.type]:
            raise ValueError('Widget musi wskazywać właściwą sekcję.')
        if widget.type == 'tabs' and section.props.get('layoutMode') != 'tabs':
            raise ValueError('Zakładki wymagają layoutMode=tabs.')
        if widget.type == 'carousel' and section.props.get('railMode') != 'scroll':
            raise ValueError('Karuzela wymaga railMode=scroll.')
    counts = Counter(s.primitive for s in sections)
    if any(count > 2 for count in counts.values()):
        raise ValueError('Zbyt wiele powtórzeń jednej kompozycji sekcji.')
    if any(a.primitive == b.primitive for a, b in zip(sections, sections[1:])):
        raise ValueError('Sąsiadujące sekcje wymagają różnej kompozycji.')
    if len({s.rhythm.density for s in sections}) == 1:
        warnings.append('Rytm sekcji ma małe zróżnicowanie gęstości.')
    signature_count = sum(s.signature for s in sections)
    maximum = 1 if spec.creative.visualSignature.scope == 'hero-only' else 3
    if signature_count > maximum and spec.creative.visualSignature.scope != 'page-wide-light':
        raise ValueError('Motyw charakterystyczny jest powtarzany zbyt często.')
    if sum(bool(s.props.get('parallax')) for s in sections) > 2:
        raise ValueError('Parallax jest dozwolony w maksymalnie dwóch sekcjach.')
    if any('lorem ipsum' in json.dumps(s.props).lower() for s in sections):
        raise ValueError('Treść strony nie może zawierać lorem ipsum.')
    if any(link.required and link.href not in used_links and link.kind == 'anchor' and not any('#' + n.targetSectionId == link.href for n in spec.interactions.nav) for link in spec.interactions.links):
        raise ValueError('Wymagany link nie został użyty na stronie.')
    return spec, warnings
