import json
import re
from collections import Counter
from urllib.parse import urlparse
from .schema import SiteMorphSpecV2
from .props import PROPS
from .fonts import select_typography

HEROES = {'ImmersiveHero', 'EditorialHero', 'TypeDrivenHero', 'ProductStage'}


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
        section.props = PROPS[section.primitive].model_validate(section.props).model_dump(exclude_none=True)
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
