"""Bind media references; unavailable photography switches the composition to type."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from ..builder_assets import _search
from .validation import walk


def bind_assets(spec, api_key):
    result = deepcopy(spec.model_dump())
    sections = result['pagePlan']['sections']
    used = {item['src'][6:] for section in sections for item in walk(section['props'])
            if isinstance(item.get('src'), str) and item['src'].startswith('asset:')}
    requests = [r.model_dump() for r in spec.assetPlan.requests if r.id in used]
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {r['id']: pool.submit(_search, r, api_key) for r in requests}
        candidates = {id_: task.result() for id_, task in futures.items()}
    selected, seen, warnings = {}, set(), []
    for request in requests:
        photo = next((p for p in candidates[request['id']] if p['url'].split('?')[0] not in seen), None)
        if photo:
            selected[request['id']] = photo
            seen.add(photo['url'].split('?')[0])
        else:
            warnings.append('Brak odpowiedniego zdjęcia: ' + request['subject'] + '. Zastosowano kompozycję bez tego zdjęcia.')
    count, available = 0, 0
    for section in sections:
        for item in walk(section['props']):
            if 'alt' not in item or 'src' not in item:
                continue
            count += 1
            source = item['src'] or ''
            if source.startswith('asset:'):
                photo = selected.get(source[6:])
                item['src'] = photo['url'] if photo else None
                if photo:
                    # Metadata describes the actual retrieved image; do not assert a fabricated subject.
                    item['alt'] = photo.get('alt') or item['alt']
                point = spec.mobile.focalPoints.get(source[6:])
                if point:
                    item['mobileFocalPoint'] = {'x': point[0], 'y': point[1]}
            if item['src']:
                available += 1
    hero = sections[0]
    hero_images = [item.get('src') for item in walk(hero['props']) if 'alt' in item and item.get('src')]
    fallback = hero['primitive'] != 'TypeDrivenHero' and not hero_images
    if fallback:
        old = hero['props']
        hero['primitive'] = 'TypeDrivenHero'
        hero['props'] = {'headline': old['headline'],
            'supportingText': old.get('lead') or old.get('subheadline') or ' '.join(p.get('description', '') for p in old.get('products', [])),
            'ctas': old.get('ctas') or [old['cta']],
            'typeScaleMode': 'editorial' if spec.tokens.typographyStrategy.scale == 'restrained' else 'poster'}
        result['creative']['heroFamily'] = 'type-driven-poster'
        warnings.append('Hero oparto na typografii, ponieważ nie ma odpowiedniego zdjęcia głównego.')
    photos = list(selected.values())
    result['assetCredits'] = list({p['source']: {'name': p.get('credit') or 'Fotograf',
        'url': p['source'] + '?utm_source=sitemorph&utm_medium=referral'} for p in photos
        if p.get('source', '').startswith('https://unsplash.com/@')}.values())
    report = {'requested': len(requests), 'resolved': len(selected), 'media_references': count,
        'available_references': available, 'hero_fallback': fallback,
        'confidence_basis': 'provided assets and search metadata; no visual model review',
        'coverage': round(available / count, 2) if count else None}
    return result, photos, warnings, report
