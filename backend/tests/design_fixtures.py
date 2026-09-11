"""Hand-authored contract fixtures, not model outputs or business endorsements."""
from copy import deepcopy


def media(brand, name='hero', aspect='4:5'):
    return {'src': f'https://fixtures.sitemorph.test/{brand}/{name}.webp', 'alt': f'Zdjęcie testowe: {brand} / {name}', 'aspect': aspect}


def section(id_, primitive, props, role='story', density='medium', tone='default'):
    return {'id': id_, 'primitive': primitive, 'role': role, 'props': props,
        'rhythm': {'density': density, 'containment': 'contained', 'paceRole': 'peak' if role == 'hero' else 'stabilize'},
        'tone': tone, 'container': 'wide' if role == 'hero' else 'standard', 'signature': role == 'hero'}


def fixture(brand='mochi'):
    businesses = {
        'mochi': ('Mad Mochi', 'Mochi donuts i matcha', 'Soft Tokyo Dessert Garden', 'fraunces', 'nunito-sans', 'product-stage', 'soft-tactile', '#fff9f1', '#292c20', '#57734c', '#e9b9c2'),
        'architecture': ('FORMA', 'Pracownia architektury', 'Space Between Lines', 'cormorant', 'work-sans', 'asymmetric-editorial', 'structural', '#f5f3ed', '#292b28', '#343b32', '#d2d6c7'),
        'techno': ('PULS', 'Klub muzyki elektronicznej', 'Sound as a Signal', 'archivo-black', 'space-mono', 'type-driven-poster', 'sharp-poster', '#151616', '#f4f4eb', '#c6ff43', '#36392d'),
        'law': ('Nowak & Partnerzy', 'Kancelaria prawna', 'Clarity in Every Matter', 'libre-baskerville', 'source-sans', 'minimal-architectural', 'quiet-editorial', '#f5f3ed', '#263a42', '#263a42', '#d8e2df'),
        'detailing': ('APEX', 'Studio auto detailingu', 'Precision in Every Reflection', 'barlow-condensed', 'ibm-plex-sans', 'immersive-photographic', 'precision', '#101619', '#f0f4f5', '#97dde5', '#293a3f'),
    }
    name, category, concept, display, text, family, motion, base, ink, action, accent = businesses[brand]
    cta = {'label': 'Poznaj ofertę', 'href': '#oferta'}
    contact = {'label': 'Napisz do nas', 'href': f'mailto:kontakt@{brand}.test'}
    spec = {
        'meta': {'schemaVersion': '2.0', 'locale': 'pl-PL', 'confidence': .8, 'unknowns': ['Nie podano cen ani godzin otwarcia.']},
        'businessBrief': {'name': name, 'category': category, 'positioning': concept,
            'audience': 'Odbiorcy poszukujący świadomie przygotowanej oferty.', 'primaryConversion': 'Poznanie oferty i kontakt',
            'keySignals': [category]},
        'creative': {'conceptTitle': concept, 'visualThesis': f'{concept}: typografia i kompozycja wynikają z charakteru {category}.',
            'heroFamily': family, 'visualSignature': {'type': 'typography-treatment', 'description': 'Wyraźna skala nagłówka i oszczędna kompozycja.', 'scope': 'hero-only'},
            'forbiddenPatterns': ['decorative-blobs', 'repeated-card-grids']},
        'semanticProfile': {'materiality': ['soft tactile' if brand == 'mochi' else 'precise'], 'brandTempo': [motion], 'formality': ['quiet' if brand == 'law' else 'expressive']},
        'tokens': {'colorStrategy': {'base': base, 'textPrimary': ink, 'actionPrimaryBg': action,
            'actionPrimaryText': '#172020' if brand in {'techno', 'detailing'} else '#ffffff', 'accentSoft': accent},
            'typographyStrategy': {'displayFontId': display, 'textFontId': text, 'scale': 'poster' if brand == 'techno' else 'restrained' if brand == 'law' else 'editorial', 'casing': 'uppercase' if brand in {'techno', 'detailing'} else 'sentence'},
            'shapeStrategy': {'family': 'soft-organic' if brand == 'mochi' else 'architectural', 'radiusMode': 'medium' if brand == 'mochi' else 'none', 'imageMaskMode': 'rect'},
            'motionStrategy': {'presetId': motion, 'heroReveal': 'text-mask', 'sectionReveal': 'none', 'hoverMode': 'lift' if brand == 'mochi' else 'underline'},
            'spacingStrategy': {'sectionSpacingMode': 'compact' if brand == 'techno' else 'editorial'}},
        'assetPlan': {'assetConfidence': 'high', 'requests': [], 'fallbackMode': 'type-led'},
        'pagePlan': {'rhythmArc': 'Wyrazisty początek / oferta / spokojna historia / kontakt', 'sections': []},
        'interactions': {'links': [{'kind': 'anchor', 'label': cta['label'], 'href': cta['href'], 'targetSectionId': 'oferta'}, {'kind': 'mailto', 'label': contact['label'], 'href': contact['href']}],
            'nav': [{'itemLabel': 'Oferta', 'targetSectionId': 'oferta'}, {'itemLabel': 'Kontakt', 'targetSectionId': 'kontakt'}],
            'widgets': [], 'forms': [{'id': 'contact', 'mode': 'mailto', 'email': f'kontakt@{brand}.test', 'fields': ['name', 'email', 'message']}]},
        'mobile': {'headlineSize': 62 if brand == 'techno' else 52, 'bodySize': 16, 'sectionSpacing': 52, 'reduceParallax': True},
        'validationHints': {'mustKeepWorking': ['CTA', 'mobile navigation', 'contact']},
    }
    if brand == 'mochi':
        hero = section('start', 'ProductStage', {'headline': 'Mały kęs.\nWielka przyjemność.', 'products': [
            {'name': 'Mochi donuts', 'description': 'Delikatna chrupkość. Miękki, sprężysty środek.', 'media': media(brand)},
            {'name': 'Matcha', 'description': 'Zielona, spokojna chwila.', 'media': media(brand, 'matcha')},
            {'name': 'Sakura', 'description': 'Inspiracja kolorem japońskiej wiosny.', 'media': media(brand, 'sakura')}],
            'stageMode': 'spread', 'cta': cta}, 'hero', 'low')
        offer = section('oferta', 'EditorialMenu', {'title': 'Wybierz swoją chwilę', 'layoutMode': 'tabs', 'groups': [
            {'label': 'Mochi donuts', 'items': [{'name': 'Mochi', 'description': 'Sprężysta tekstura i subtelna słodycz.'}]},
            {'label': 'Matcha', 'items': [{'name': 'Matcha latte', 'description': 'Zielona herbata w kremowym wydaniu.'}]}]}, 'menu', 'high', 'quiet')
        supporting = [section('historia', 'StorySpread', {'title': 'Trochę Tokio.\nDużo przyjemności.', 'paragraphs': ['Mochi i matcha spotykają się w jednej, spokojnej przerwie. Odkryj tekstury i smaki, które zachęcają do kolejnego kęsa.'], 'layout': 'text-led'}),
            section('galeria', 'HorizontalGallery', {'title': 'Przyjrzyj się z bliska', 'media': [media(brand, 'detail-a'), media(brand, 'detail-b')], 'captionMode': 'none', 'fallbackText': 'Poznaj nasze mochi i matchę na miejscu.'}, 'immersion', 'low')]
        spec['interactions']['widgets'] = [{'id': 'oferta', 'type': 'tabs'}, {'id': 'galeria', 'type': 'gallery'}]
    elif brand == 'architecture':
        hero = section('start', 'EditorialHero', {'headline': 'Przestrzeń\ndo życia.', 'lead': 'Architektura zaczyna się od uważnego spojrzenia. Na miejsce, światło i codzienność.', 'media': [media(brand)], 'layoutMode': 'asymmetric-right', 'signatureTreatment': 'frame-break', 'ctas': [cta]}, 'hero', 'low')
        offer = section('oferta', 'ProductRail', {'title': 'Od idei do przestrzeni', 'railMode': 'mixed', 'items': [
            {'title': 'Architektura', 'subtitle': 'Forma, kontekst i funkcja.', 'media': media(brand, 'house')},
            {'title': 'Wnętrza', 'subtitle': 'Materiały blisko codzienności.', 'media': media(brand, 'interior')}]}, 'proof', 'medium')
        supporting = [section('proces', 'StickyNarrative', {'title': 'Uważnie.\nKrok po kroku.', 'steps': [{'title': 'Rozmowa', 'body': 'Zaczynamy od potrzeb i warunków miejsca.'}, {'title': 'Koncepcja', 'body': 'Szukamy rozwiązania, w którym funkcja spotyka się z charakterem.'}], 'stickySide': 'left'}, density='high', tone='quiet')]
    elif brand == 'techno':
        hero = section('start', 'TypeDrivenHero', {'headline': 'POCZUJ\nPULS.', 'supportingText': 'Muzyka elektroniczna. Wspólna przestrzeń. Energia spotkania.', 'typeScaleMode': 'monument', 'ctas': [cta]}, 'hero', 'high')
        offer = section('oferta', 'EditorialMenu', {'title': 'Dźwięk ma wiele kierunków', 'layoutMode': 'featured-first', 'groups': [{'label': 'Nasza scena', 'items': [{'name': 'Techno', 'description': 'Hipnotyczny rytm.'}, {'name': 'Elektronika', 'description': 'Przestrzeń dla nowych brzmień.'}]}]}, 'menu', 'medium', 'contrast')
        supporting = [section('scena', 'ImageBreak', {'media': media(brand, 'room', '16:9'), 'caption': 'Wspólna przestrzeń dla dźwięku.', 'fallbackText': 'W centrum zostaje muzyka.', 'mode': 'full-bleed', 'parallax': True}, 'immersion', 'low')]
    elif brand == 'law':
        hero = section('start', 'TypeDrivenHero', {'headline': 'Prawo, które\nrozumiesz.', 'supportingText': 'Jasna rozmowa o Twojej sprawie. Uporządkowane możliwości i świadome decyzje.', 'typeScaleMode': 'editorial', 'ctas': [cta]}, 'hero', 'low')
        offer = section('oferta', 'EditorialSplit', {'heading': 'Zacznijmy\nod Twojej sprawy.', 'body': 'Opisz sytuację, z którą się mierzysz. Pierwszy kontakt pozwala ustalić zakres potrzebnej pomocy.', 'cta': contact}, 'story', 'high', 'quiet')
        supporting = [section('pytania', 'FAQSection', {'title': 'Przed rozmową', 'items': [{'question': 'Jak opisać sprawę?', 'answer': 'W wiadomości przedstaw krótko swoją sytuację i temat rozmowy.'}, {'question': 'Jak się skontaktować?', 'answer': 'Skorzystaj z adresu e-mail podanego w sekcji kontaktowej.'}]}, 'proof')]
        spec['interactions']['widgets'] = [{'id': 'pytania', 'type': 'accordion'}]
        supporting.append(section('adres', 'LocationCanvas', {'title': 'Miejsce spotkania', 'address': 'Adres testowy 1\n00-001 Warszawa', 'hours': ['Godziny spotkania ustalamy indywidualnie.'], 'layoutMode': 'info-dominant', 'ctas': [contact]}, 'location', 'low', 'quiet'))
    else:
        hero = section('start', 'ImmersiveHero', {'headline': 'Liczy się\nkażdy detal.', 'subheadline': 'Precyzyjna pielęgnacja samochodu. Charakter widoczny w każdym odbiciu.', 'media': media(brand, 'hero', '16:9'), 'textPlacement': 'bottom-left', 'ctas': [cta]}, 'hero', 'high')
        offer = section('oferta', 'ProductRail', {'title': 'Dopasuj zakres pielęgnacji', 'railMode': 'scroll', 'items': [{'title': label, 'subtitle': 'Zapytaj o zakres dopasowany do Twojego auta.', 'media': media(brand, str(i))} for i, label in enumerate(['Lakier', 'Wnętrze', 'Detale', 'Ochrona'])]}, 'menu')
        supporting = [section('podejscie', 'CTASection', {'headline': 'Zacznij od rozmowy\no swoim aucie.', 'supportingText': 'Wspólnie ustalimy zakres pracy.', 'ctas': [contact], 'emphasis': 'quiet'}, 'conversion', 'low', 'contrast')]
        spec['interactions']['widgets'] = [{'id': 'oferta', 'type': 'carousel'}]
    spec['pagePlan']['sections'] = [hero, offer, *supporting, section('kontakt', 'ContactSection', {'title': 'Porozmawiajmy', 'body': 'Napisz, czego szukasz. Zacznijmy od rozmowy.', 'ctas': [contact], 'formId': 'contact'}, 'conversion', 'high')]
    return deepcopy(spec)


def supplied_urls(spec):
    from app.design.validation import walk
    return list({item['src'] for item in walk(spec) if isinstance(item.get('src'), str) and item['src'].startswith('https://fixtures.')})
