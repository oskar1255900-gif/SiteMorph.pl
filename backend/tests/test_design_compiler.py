import json
from copy import deepcopy
from unittest.mock import Mock
import pytest
from app.design.schema import SiteMorphSpecV2, gemini_response_schema
from app.design.validation import normalize_model_spec, validate_spec
from app.design.assets import bind_assets
from app.design.compiler import compile_design
from app.design.tokens import contrast, resolve_tokens
from app.builder_validation import validate_project
from app.routers import builder as b
from design_fixtures import fixture, supplied_urls
from test_builder_regressions import client  # isolated SQLite + authenticated TestClient fixture


@pytest.mark.parametrize('brand', ['mochi', 'architecture', 'techno', 'law', 'detailing'])
def test_real_runtime_compiles_distinct_businesses(brand):
    payload = fixture(brand)
    spec, warnings = validate_spec(payload, supplied_urls(payload))
    resolved, _, _, report = bind_assets(spec, '')
    files, bindings, _ = compile_design(spec, resolved)
    valid, issues = validate_project(files)
    assert valid, issues
    assert len(files) >= 18
    assert bindings['hero_family'] == payload['creative']['heroFamily']
    assert spec.businessBrief.name in files['main/frontend/index.html'] or '&amp;' in files['main/frontend/index.html']
    assert len(files['main/frontend/src/App.tsx']) < 1800
    assert 'preview.html' not in files
    assert report['hero_fallback'] is False
    assert 'fonts.googleapis.com' in files['main/frontend/index.html']


@pytest.mark.parametrize('mutation', ['missing-link', 'fake-asset', 'fake-prop', 'bad-font', 'duplicate-id', 'broken-tab', 'bad-focal', 'css-injection', 'bad-form'])
def test_invalid_design_contract_rejected(mutation):
    payload = fixture()
    if mutation == 'missing-link': payload['interactions']['links'] = []
    if mutation == 'fake-asset': payload['pagePlan']['sections'][0]['props']['products'][0]['media']['src'] = 'asset:missing'
    if mutation == 'fake-prop': payload['pagePlan']['sections'][0]['props']['blob'] = True
    if mutation == 'bad-font': payload['tokens']['typographyStrategy']['textFontId'] = 'archivo-black'
    if mutation == 'duplicate-id': payload['pagePlan']['sections'][1]['id'] = 'start'
    if mutation == 'broken-tab': payload['pagePlan']['sections'][1]['props']['layoutMode'] = 'single-column'
    if mutation == 'bad-focal': payload['mobile']['focalPoints'] = {'hero': [120, 0]}
    if mutation == 'css-injection': payload['tokens']['colorStrategy']['base'] = 'red;} body{display:none}'
    if mutation == 'bad-form': payload['interactions']['forms'][0]['email'] = 'not-email'
    with pytest.raises(ValueError): validate_spec(payload, supplied_urls(payload))


def test_missing_photo_changes_hero_composition_without_random_fallback():
    payload = fixture('architecture')
    payload['pagePlan']['sections'][0]['props']['media'] = [{'src': 'asset:house', 'alt': 'Dom w świetle dziennym'}]
    payload['assetPlan']['requests'] = [{'id': 'house', 'subject': 'modern house', 'query': 'minimal concrete home'}]
    spec, _ = validate_spec(payload, supplied_urls(payload))
    resolved, photos, warnings, report = bind_assets(spec, '')
    assert not photos and report['hero_fallback']
    assert resolved['pagePlan']['sections'][0]['primitive'] == 'TypeDrivenHero'
    assert resolved['pagePlan']['sections'][0]['props']['headline'] == payload['pagePlan']['sections'][0]['props']['headline']
    assert 'data:image' not in json.dumps(resolved) and 'blob' not in json.dumps(resolved['pagePlan'])
    assert warnings


def test_bad_color_contrast_is_repaired_deterministically():
    payload = fixture('law')
    payload['tokens']['colorStrategy'].update(textPrimary='#eeeeee', actionPrimaryText='#263a42')
    spec, _ = validate_spec(payload, supplied_urls(payload))
    variables, _, warnings = resolve_tokens(spec)
    assert warnings
    assert contrast(variables['text'], variables['base']) >= 4.5
    assert contrast(variables['muted'], variables['base-alt']) >= 4.5
    assert contrast(variables['button-text'], variables['button-bg']) >= 4.5


def _schema_keywords(node, found=None):
    found = set() if found is None else found
    if isinstance(node, dict):
        found.update(node.keys())
        for value in node.values():
            _schema_keywords(value, found)
    elif isinstance(node, list):
        for item in node:
            _schema_keywords(item, found)
    return found


def test_gemini_schema_mirrors_the_contract_types():
    schema = gemini_response_schema()
    semantic = schema['$defs']['SemanticProfile']

    assert semantic['properties']['brandTempo']['type'] == 'array'
    assert semantic['properties']['brandTempo']['items'] == {'type': 'string'}
    assert semantic['properties']['materiality']['type'] == 'array'
    assert 'brandTempo' in semantic['required']

    assert schema['$defs']['BusinessBrief']['properties']['audience']['type'] == 'string'
    assert schema['$defs']['PagePlan']['properties']['rhythmArc']['type'] == 'string'
    # const is not a Gemini keyword; the same constraint is a one-item enum.
    assert schema['$defs']['Meta']['properties']['schemaVersion']['enum'] == ['2.0']


def test_gemini_schema_drops_unsupported_keywords_but_keeps_their_meaning():
    schema = gemini_response_schema()
    keywords = _schema_keywords(schema)

    for banned in ('const', 'default', 'pattern', 'minLength', 'maxLength'):
        assert banned not in keywords, banned
    assert 'schemaVersion' in schema['$defs']['Meta']['required']

    # Length limits survive as description text instead of silently vanishing.
    rhythm = schema['$defs']['PagePlan']['properties']['rhythmArc']
    assert rhythm['description'] == 'At least 3 characters. At most 200 characters.'
    assert schema['$defs']['BusinessBrief']['properties']['audience']['description'].endswith(
        'At most 400 characters.'
    )


def test_sanitizer_leaves_the_pydantic_schema_alone_and_is_cached():
    original = SiteMorphSpecV2.model_json_schema()
    first = gemini_response_schema()

    assert gemini_response_schema() is first
    assert 'const' in _schema_keywords(original)
    assert 'const' not in _schema_keywords(first)
    assert SiteMorphSpecV2.model_json_schema() == original


def test_gemini_request_carries_the_contract_schema_when_enabled(monkeypatch):
    monkeypatch.setattr(b, 'GEMINI_API_KEY', 'AQ.offline-gemini-key')
    monkeypatch.setattr(b, 'GEMINI_RESPONSE_SCHEMA_ENABLED', True)
    response = Mock(status_code=200, headers={'content-type': 'application/json'})
    response.json.return_value = {'candidates': [{
        'content': {'parts': [{'text': '{"ok":true}'}]}, 'finishReason': 'STOP',
    }]}
    post = Mock(return_value=response)
    monkeypatch.setattr(b.requests, 'post', post)

    b.gemini_generate_model('gemini-3.5-flash', 'Return JSON.', 'Create a site.', timeout=15)

    sent = post.call_args.kwargs['json']['generationConfig']['responseJsonSchema']
    assert sent['$defs']['SemanticProfile']['properties']['brandTempo']['items'] == {'type': 'string'}
    assert sent['$defs']['BusinessBrief']['properties']['audience']['type'] == 'string'
    assert sent['$defs']['Meta']['properties']['schemaVersion']['enum'] == ['2.0']
    assert 'const' not in _schema_keywords(sent)


def test_gemini_schema_flag_is_off_unless_explicitly_enabled():
    assert b.GEMINI_RESPONSE_SCHEMA_ENABLED is False


def test_string_where_contract_expects_string_array_is_wrapped():
    payload = fixture('mochi')
    payload['semanticProfile']['brandTempo'] = 'spokojne, zmysłowe, celebrujące moment'
    payload['semanticProfile']['materiality'] = 'soft, chewy, glossy'
    payload['semanticProfile']['formality'] = 'expressive'
    payload['businessBrief']['risks'] = 'cena mochi'

    normalized, changed = normalize_model_spec(payload)

    assert normalized['semanticProfile']['brandTempo'] == ['spokojne, zmysłowe, celebrujące moment']
    assert normalized['semanticProfile']['materiality'] == ['soft, chewy, glossy']
    assert normalized['semanticProfile']['formality'] == ['expressive']
    assert normalized['businessBrief']['risks'] == ['cena mochi']
    # A lone string is never split into items the model did not send.
    assert all(len(normalized['semanticProfile'][key]) == 1 for key in ('brandTempo', 'materiality', 'formality'))
    assert sorted(changed) == [
        'businessBrief.risks', 'semanticProfile.brandTempo',
        'semanticProfile.formality', 'semanticProfile.materiality',
    ]
    # The raw model answer is left untouched; only the copy is repaired.
    assert payload['semanticProfile']['brandTempo'] == 'spokojne, zmysłowe, celebrujące moment'
    spec, _ = validate_spec(normalized, supplied_urls(payload))
    assert spec.semanticProfile.brandTempo == ['spokojne, zmysłowe, celebrujące moment']


def test_correct_list_fields_are_left_alone():
    payload = fixture('mochi')
    before = deepcopy(payload)
    normalized, changed = normalize_model_spec(payload)
    assert changed == []
    assert normalized == before
    validate_spec(normalized, supplied_urls(payload))


def test_dict_number_and_null_are_not_repaired():
    payload = fixture('mochi')
    payload['semanticProfile']['brandTempo'] = {'value': 'calm'}
    payload['businessBrief']['keySignals'] = 7
    payload['meta']['unknowns'] = None

    normalized, changed = normalize_model_spec(payload)

    assert changed == []
    assert normalized['semanticProfile']['brandTempo'] == {'value': 'calm'}
    assert normalized['businessBrief']['keySignals'] == 7
    assert normalized['meta']['unknowns'] is None
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_normalization_does_not_invent_missing_fields_or_fix_enums():
    payload = fixture('mochi')
    del payload['semanticProfile']['brandTempo']
    payload['meta']['schemaVersion'] = '9.9'

    normalized, changed = normalize_model_spec(payload)

    assert changed == []
    assert 'brandTempo' not in normalized['semanticProfile']
    assert normalized['meta']['schemaVersion'] == '9.9'
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_undeclared_nested_fields_are_dropped():
    payload = fixture('mochi')
    # The live model duplicated these inside pagePlan instead of the root.
    payload['pagePlan']['container'] = 'wide'
    payload['pagePlan']['interactions'] = deepcopy(payload['interactions'])
    payload['pagePlan']['mobile'] = deepcopy(payload['mobile'])

    normalized, report = normalize_model_spec(payload)

    assert sorted(report.dropped_fields) == [
        'pagePlan.container', 'pagePlan.interactions', 'pagePlan.mobile',
    ]
    assert sorted(normalized['pagePlan']) == ['rhythmArc', 'sections']
    # The root fields the contract really declares stay exactly where they were.
    assert normalized['interactions'] == payload['interactions']
    assert normalized['mobile'] == payload['mobile']
    assert payload['pagePlan']['container'] == 'wide'  # the raw answer is untouched
    validate_spec(normalized, supplied_urls(payload))


def test_declared_enum_aliases_are_resolved():
    payload = fixture('mochi')
    payload['assetPlan']['requests'] = [{
        'id': 'hero-shot', 'subject': 'mochi donut', 'query': 'mochi donut close up',
        'role': 'hero', 'orientation': 'landrait',
    }]
    payload['pagePlan']['sections'][1]['rhythm']['containment'] = 'wide'
    payload['tokens']['spacingStrategy']['containerMix'] = 'wide'

    normalized, report = normalize_model_spec(payload)

    assert normalized['assetPlan']['requests'][0]['orientation'] == 'landscape'
    assert normalized['pagePlan']['sections'][1]['rhythm']['containment'] == 'full-bleed'
    # "wide" is a genuine member of containerMix, so it must not be rewritten.
    assert normalized['tokens']['spacingStrategy']['containerMix'] == 'wide'
    assert sorted(alias['to'] for alias in report.enum_aliases) == ['full-bleed', 'landscape']
    assert all(alias['match'] == 'alias' for alias in report.enum_aliases)
    validate_spec(normalized, supplied_urls(payload))


def test_string_array_where_contract_expects_a_string_is_joined():
    payload = fixture('mochi')
    payload['businessBrief']['audience'] = ['Gen Z', 'Millennials z Łodzi']
    payload['pagePlan']['rhythmArc'] = ['spokojny start', 'kulminacja', 'kontakt']

    normalized, report = normalize_model_spec(payload)

    assert normalized['businessBrief']['audience'] == 'Gen Z Millennials z Łodzi'
    assert normalized['pagePlan']['rhythmArc'] == 'spokojny start kulminacja kontakt'
    assert sorted(report.normalized_fields) == ['businessBrief.audience', 'pagePlan.rhythmArc']
    validate_spec(normalized, supplied_urls(payload))


def test_overlong_text_is_truncated_to_the_schema_limit():
    payload = fixture('mochi')
    overlong = ('spokojny start ' * 20).strip()
    payload['pagePlan']['rhythmArc'] = overlong

    normalized, report = normalize_model_spec(payload)

    assert len(normalized['pagePlan']['rhythmArc']) <= 200
    assert normalized['pagePlan']['rhythmArc'].startswith('spokojny start')
    assert report.truncated_fields == [{
        'field': 'pagePlan.rhythmArc', 'max_length': 200, 'length': len(overlong),
    }]
    validate_spec(normalized, supplied_urls(payload))


def test_undeclared_section_props_are_dropped_but_valid_props_survive():
    payload = fixture('mochi')
    props = payload['pagePlan']['sections'][0]['props']
    props['blob'] = True
    props['media'] = []

    normalized, report = normalize_model_spec(payload)

    repaired = normalized['pagePlan']['sections'][0]['props']
    assert sorted(repaired) == ['cta', 'headline', 'products', 'stageMode']
    assert sorted(report.dropped_fields) == [
        'pagePlan.sections[0].props.blob', 'pagePlan.sections[0].props.media',
    ]
    validate_spec(normalized, supplied_urls(payload))


def test_missing_required_field_is_not_invented_and_still_fails():
    payload = fixture('mochi')
    del payload['businessBrief']['primaryConversion']

    normalized, report = normalize_model_spec(payload)

    assert 'primaryConversion' not in normalized['businessBrief']
    assert report.normalized_fields == []
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_unknown_enum_without_an_alias_still_fails():
    payload = fixture('mochi')
    payload['assetPlan']['requests'] = [{
        'id': 'hero-shot', 'subject': 'mochi donut', 'query': 'mochi donut close up',
        'role': 'hero', 'orientation': 'panorama',
    }]

    normalized, report = normalize_model_spec(payload)

    assert normalized['assetPlan']['requests'][0]['orientation'] == 'panorama'
    assert report.enum_aliases == []
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


# ---------------------------------------------------------------------------
# FIELD-SPECIFIC ENUM ALIASES (paceRole, widget.type)
# ---------------------------------------------------------------------------


def test_pacerole_awaken_is_aliased_to_accelerate():
    payload = fixture('mochi')
    payload['pagePlan']['sections'][0]['rhythm']['paceRole'] = 'awaken'

    normalized, report = normalize_model_spec(payload)

    assert normalized['pagePlan']['sections'][0]['rhythm']['paceRole'] == 'accelerate'
    assert any(a['from'] == 'awaken' and a['to'] == 'accelerate' for a in report.enum_aliases)
    validate_spec(normalized, supplied_urls(payload))


def test_pacerole_valid_value_is_not_changed():
    payload = fixture('mochi')
    payload['pagePlan']['sections'][0]['rhythm']['paceRole'] = 'pause'

    normalized, report = normalize_model_spec(payload)

    assert normalized['pagePlan']['sections'][0]['rhythm']['paceRole'] == 'pause'
    assert report.enum_aliases == []
    validate_spec(normalized, supplied_urls(payload))


def test_pacerole_unknown_value_still_fails():
    payload = fixture('mochi')
    payload['pagePlan']['sections'][0]['rhythm']['paceRole'] = 'dance'

    normalized, report = normalize_model_spec(payload)

    assert normalized['pagePlan']['sections'][0]['rhythm']['paceRole'] == 'dance'
    assert report.enum_aliases == []
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_widget_type_editorial_menu_is_aliased_to_tabs():
    payload = fixture('mochi')
    # Add an EditorialMenu section with required props
    payload['pagePlan']['sections'].append({
        'id': 'menu',
        'primitive': 'EditorialMenu',
        'role': 'menu',
        'props': {
            'title': 'Menu',
            'layoutMode': 'tabs',
            'groups': [{'label': 'Mains', 'items': [{'name': 'Mochi'}]}],
        },
    })
    payload['interactions']['widgets'] = [{
        'id': 'menu',
        'type': 'EditorialMenu',
        'expectedBehavior': ['switch categories'],
    }]

    normalized, report = normalize_model_spec(payload)

    assert normalized['interactions']['widgets'][0]['type'] == 'tabs'
    assert any(a['from'] == 'EditorialMenu' and a['to'] == 'tabs' for a in report.enum_aliases)
    validate_spec(normalized, supplied_urls(payload))


def test_widget_type_valid_value_is_not_changed():
    payload = fixture('mochi')
    # Add a HorizontalGallery section with required props
    payload['pagePlan']['sections'].append({
        'id': 'gallery-section',
        'primitive': 'HorizontalGallery',
        'role': 'proof',
        'props': {
            'title': 'Gallery',
            'media': [],
            'fallbackText': 'Gallery coming soon',
        },
    })
    payload['interactions']['widgets'] = [{
        'id': 'gallery-section',
        'type': 'gallery',
        'expectedBehavior': ['browse images'],
    }]

    normalized, report = normalize_model_spec(payload)

    assert normalized['interactions']['widgets'][0]['type'] == 'gallery'
    # No aliases should fire for a valid value
    assert not any(a['from'] == 'gallery' for a in report.enum_aliases)
    validate_spec(normalized, supplied_urls(payload))


def test_widget_type_unknown_value_still_fails():
    payload = fixture('mochi')
    payload['interactions']['widgets'] = [{
        'id': 'magic',
        'type': 'MagicGrid',
        'expectedBehavior': ['magic'],
    }]

    normalized, report = normalize_model_spec(payload)

    assert normalized['interactions']['widgets'][0]['type'] == 'MagicGrid'
    assert report.enum_aliases == []
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_both_field_aliases_appear_in_diagnostics():
    payload = fixture('mochi')
    payload['pagePlan']['sections'][0]['rhythm']['paceRole'] = 'awaken'
    # Add an EditorialMenu section with required props
    payload['pagePlan']['sections'].append({
        'id': 'menu',
        'primitive': 'EditorialMenu',
        'role': 'menu',
        'props': {
            'title': 'Menu',
            'layoutMode': 'tabs',
            'groups': [{'label': 'Mains', 'items': [{'name': 'Mochi'}]}],
        },
    })
    payload['interactions']['widgets'] = [{
        'id': 'menu',
        'type': 'EditorialMenu',
        'expectedBehavior': ['switch'],
    }]

    normalized, report = normalize_model_spec(payload)

    aliases = {(a['from'], a['to']) for a in report.enum_aliases}
    assert ('awaken', 'accelerate') in aliases
    assert ('EditorialMenu', 'tabs') in aliases
    validate_spec(normalized, supplied_urls(payload))


# ---------------------------------------------------------------------------
# TOLERANT JSON SYNTAX REPAIR (Free model output)
# ---------------------------------------------------------------------------


def test_valid_json_is_neither_repaired_nor_changed():
    original = '{  "files": {"x": "y"}, "meta": {"title": "Mad Mochi"}  }'

    payload, repaired = b.extract_json_repaired(original)

    assert repaired is False
    assert payload == {'files': {'x': 'y'}, 'meta': {'title': 'Mad Mochi'}}
    # The strict path is exactly what it always was.
    assert b.extract_json(original) == payload


@pytest.mark.parametrize('broken, expected', [
    ('{"a": 1,}', {'a': 1}),                      # trailing comma
    ('{"a": 1, "b": [1, 2,],}', {'a': 1, 'b': [1, 2]}),  # nested trailing comma
    ('{a: 1}', {'a': 1}),                          # unquoted key
    ('{"a": 1', {'a': 1}),                        # missing closing brace
    ("{'a': 1}", {'a': 1}),                        # single quotes
    ('Here it is:\n{"a": 1,}\nHope that helps.', {'a': 1}),
])
def test_broken_json_syntax_is_repaired(broken, expected):
    payload, repaired = b.extract_json_repaired(broken)

    assert repaired is True
    assert payload == expected


def test_markdown_fence_is_unwrapped_before_parsing():
    fenced_clean = '```json\n{"a": 1}\n```'
    fenced_broken = '```json\n{"a": 1,}\n```'

    assert b.extract_json_repaired(fenced_clean) == ({'a': 1}, False)
    assert b.extract_json_repaired(fenced_broken) == ({'a': 1}, True)


@pytest.mark.parametrize('worthless', ['', '   ', 'hello world', 'I cannot help with that.', '{not json', 'null'])
def test_an_answer_that_is_not_a_json_object_still_fails(worthless):
    with pytest.raises(ValueError):
        b.extract_json_repaired(worthless)


@pytest.mark.parametrize('as_list', ['[{"a": 1}]', 'Here: [{"a": 1}]', '[1, 2, 3]'])
def test_a_top_level_list_is_not_accepted_as_an_object(as_list):
    with pytest.raises(ValueError):
        b.extract_json_repaired(as_list)


def test_parser_input_is_capped():
    assert b.MAX_JSON_TEXT_CHARS == 1_000_000
    huge = '{"a": "' + 'x' * (b.MAX_JSON_TEXT_CHARS + 100) + '"}'

    payload, repaired = b.extract_json_repaired(huge)

    assert isinstance(payload, dict) and repaired is True
    assert len(payload['a']) <= b.MAX_JSON_TEXT_CHARS


def test_repaired_json_missing_a_required_field_is_still_rejected():
    payload = fixture('mochi')
    del payload['businessBrief']['primaryConversion']
    # A complete plan except for one trailing comma: valid syntax aside, the
    # contract still decides whether this project may be compiled.
    broken = json.dumps(payload, ensure_ascii=False)[:-1] + ',}'

    repaired_payload, repaired = b.extract_json_repaired(broken)

    assert repaired is True
    normalized, _ = normalize_model_spec(repaired_payload)
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


# ---------------------------------------------------------------------------
# LINK KIND vs HREF (href is authoritative)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize('kind, href, expected', [
    ('external', '#oferta', 'anchor'),
    ('social', '#oferta', 'anchor'),
    ('anchor', 'mailto:kontakt@mochi.test', 'mailto'),
    ('tel', 'mailto:kontakt@mochi.test', 'mailto'),
    ('map', 'tel:+48421234567', 'tel'),
    ('tel', 'https://madmochi.pl', 'external'),
    ('anchor', 'https://madmochi.pl', 'external'),
])
def test_link_kind_is_derived_from_the_href_it_points_at(kind, href, expected):
    payload = fixture('mochi')
    # Appended, so the links the fixture's own CTAs reference stay declared.
    link = {'kind': kind, 'label': 'Kontakt', 'href': href}
    if href.startswith('#'):
        link['targetSectionId'] = href[1:]
    payload['interactions']['links'].append(link)

    normalized, report = normalize_model_spec(payload)

    repaired = normalized['interactions']['links'][-1]
    assert repaired['kind'] == expected
    # Only the label is corrected; the destination is never rewritten.
    assert repaired['href'] == href
    # The raw model answer stays exactly as it was sent.
    assert payload['interactions']['links'][-1]['kind'] == kind
    assert report.enum_aliases == [{
        'field': 'interactions.links[2].kind', 'from': kind, 'to': expected, 'match': 'href',
    }]
    validate_spec(normalized, supplied_urls(payload))


def test_consistent_link_kinds_are_left_alone():
    payload = fixture('mochi')
    before = deepcopy(payload)

    normalized, report = normalize_model_spec(payload)

    assert report.enum_aliases == []
    assert normalized == before
    validate_spec(normalized, supplied_urls(payload))


def test_a_missing_link_kind_is_not_invented():
    payload = fixture('mochi')
    del payload['interactions']['links'][1]['kind']

    normalized, report = normalize_model_spec(payload)

    assert 'kind' not in normalized['interactions']['links'][1]
    assert report.enum_aliases == []
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_an_href_that_fits_no_kind_is_still_rejected():
    payload = fixture('mochi')
    payload['interactions']['links'][1] = {
        'kind': 'external', 'label': 'Plik', 'href': '/api/builder/asset/abc123',
    }

    normalized, report = normalize_model_spec(payload)

    # No declared kind fits this address, so nothing is guessed...
    assert normalized['interactions']['links'][1]['kind'] == 'external'
    assert report.enum_aliases == []
    # ...and the broken link is still a hard failure.
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_an_anchor_whose_target_contradicts_its_href_is_still_rejected():
    payload = fixture('mochi')
    payload['interactions']['links'][0]['targetSectionId'] = 'kontakt'

    normalized, report = normalize_model_spec(payload)

    # kind and href already agree, so nothing is rewritten here...
    assert report.enum_aliases == []
    # ...and the real contradiction still fails validation.
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


# ---------------------------------------------------------------------------
# MIS-NESTED interactions (one known location, one direction)
# ---------------------------------------------------------------------------


def test_nested_page_plan_interactions_is_relocated_to_the_root():
    payload = fixture('mochi')
    nested = payload.pop('interactions')
    payload['pagePlan']['interactions'] = nested

    normalized, report = normalize_model_spec(payload)

    assert report.relocated_fields == [{'from': 'pagePlan.interactions', 'to': 'interactions'}]
    assert normalized['interactions'] == nested
    assert sorted(normalized['pagePlan']) == ['rhythmArc', 'sections']
    # The raw model answer keeps the wrong shape; only the copy is repaired.
    assert 'interactions' not in payload
    assert payload['pagePlan']['interactions'] == nested
    spec, _ = validate_spec(normalized, supplied_urls(payload))
    assert [link.href for link in spec.interactions.links] == [link['href'] for link in nested['links']]


def test_a_valid_root_interactions_wins_over_the_nested_duplicate():
    payload = fixture('mochi')
    payload['pagePlan']['interactions'] = deepcopy(payload['interactions'])

    normalized, report = normalize_model_spec(payload)

    assert report.relocated_fields == []
    assert report.dropped_fields == ['pagePlan.interactions']
    assert normalized['interactions'] == payload['interactions']
    validate_spec(normalized, supplied_urls(payload))


def test_interactions_absent_from_both_places_still_fails():
    payload = fixture('mochi')
    del payload['interactions']

    normalized, report = normalize_model_spec(payload)

    assert report.relocated_fields == []
    assert 'interactions' not in normalized
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_a_non_object_nested_interactions_is_not_relocated():
    payload = fixture('mochi')
    del payload['interactions']
    payload['pagePlan']['interactions'] = 'anchor, mailto'

    normalized, report = normalize_model_spec(payload)

    assert report.relocated_fields == []
    assert report.dropped_fields == ['pagePlan.interactions']
    assert 'interactions' not in normalized
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_interactions_is_not_looked_for_outside_the_known_location():
    payload = fixture('mochi')
    payload['assetPlan']['interactions'] = payload.pop('interactions')

    normalized, report = normalize_model_spec(payload)

    assert report.relocated_fields == []
    assert 'interactions' not in normalized
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_props_validation_error_identifies_the_section():
    payload = fixture('mochi')
    # 'blob' is not a declared prop of ProductStage (extra='forbid').
    payload['pagePlan']['sections'][0]['props']['blob'] = True

    with pytest.raises(ValueError, match=r"section 'start' \(ProductStage\) props:"):
        validate_spec(payload, supplied_urls(payload))


# ---------------------------------------------------------------------------
# ProductRail media alt derivation
# ---------------------------------------------------------------------------


def _product_rail_payload(alt='', title='Mochi Matcha'):
    """Build a valid payload: fixture hero + ProductRail + ContactSection."""
    payload = fixture('mochi')
    # Keep only the fixture's hero; replace the rest with our test sections.
    hero = payload['pagePlan']['sections'][0]
    media = {'src': 'https://fixtures.sitemorph.test/mochi/hero.webp', 'aspect': '4:5'}
    if alt:
        media['alt'] = alt
    payload['pagePlan']['sections'] = [hero, {
        'id': 'oferta', 'primitive': 'ProductRail', 'role': 'menu',
        'props': {'title': 'Oferta', 'railMode': 'scroll', 'items': [
            {'title': title, 'subtitle': '', 'media': media, 'linkLabel': 'Zobacz'},
        ]},
        'rhythm': {'density': 'medium', 'containment': 'contained', 'paceRole': 'stabilize'},
        'tone': 'default', 'container': 'standard', 'signature': False,
    }, {
        'id': 'kontakt', 'primitive': 'ContactSection', 'role': 'conversion',
        'props': {'title': 'Kontakt'},
        'rhythm': {'density': 'low', 'containment': 'contained', 'paceRole': 'resolve'},
        'tone': 'default', 'container': 'standard', 'signature': False,
    }]
    payload['interactions']['links'] = [
        {'kind': 'anchor', 'label': 'Oferta', 'href': '#oferta', 'targetSectionId': 'oferta'},
        {'kind': 'mailto', 'label': 'Napisz', 'href': 'mailto:kontakt@test.pl'},
    ]
    payload['interactions']['forms'] = []
    payload['interactions']['widgets'] = []
    return payload


def test_missing_media_alt_is_copied_from_item_title():
    payload = _product_rail_payload(alt='', title='Mochi Matcha')

    normalized, report = normalize_model_spec(payload)

    # ProductRail is at index 1 (hero inserted at 0)
    rail = normalized['pagePlan']['sections'][1]
    assert report.derived_fields == [{
        'from': 'pagePlan.sections[1].props.items[0].title',
        'to': 'pagePlan.sections[1].props.items[0].media.alt',
    }]
    assert rail['props']['items'][0]['media']['alt'] == 'Mochi Matcha'
    validate_spec(normalized, supplied_urls(payload))


def test_empty_string_alt_is_copied_from_item_title():
    payload = _product_rail_payload(alt='   ', title='Matcha Donut')

    normalized, report = normalize_model_spec(payload)

    assert len(report.derived_fields) == 1
    assert report.derived_fields[0]['to'] == 'pagePlan.sections[1].props.items[0].media.alt'
    assert normalized['pagePlan']['sections'][1]['props']['items'][0]['media']['alt'] == 'Matcha Donut'
    validate_spec(normalized, supplied_urls(payload))


def test_existing_non_empty_media_alt_is_left_alone():
    payload = _product_rail_payload(alt='Good alt', title='Any Title')

    normalized, report = normalize_model_spec(payload)

    assert report.derived_fields == []
    assert normalized['pagePlan']['sections'][1]['props']['items'][0]['media']['alt'] == 'Good alt'
    validate_spec(normalized, supplied_urls(payload))


def test_missing_alt_and_missing_title_still_fails():
    payload = _product_rail_payload(alt='', title='')
    # Also remove subtitle to ensure no other field could help.
    del payload['pagePlan']['sections'][1]['props']['items'][0]['title']

    normalized, report = normalize_model_spec(payload)

    assert report.derived_fields == []
    with pytest.raises(ValueError):
        validate_spec(normalized, supplied_urls(payload))


def test_derivation_recorded_in_report():
    payload = _product_rail_payload(alt='', title='Sakura Mochi')

    _, report = normalize_model_spec(payload)

    assert report.derived_fields
    assert report.derived_fields[0]['from'].endswith('.title')
    assert report.derived_fields[0]['to'].endswith('.media.alt')
    # Derived fields appear in the diagnostic buckets.
    assert 'derived_fields' in report.buckets()
    assert len(report.buckets()['derived_fields']) == 1


# ---------------------------------------------------------------------------
# ONE MODEL, ONE REQUEST
# ---------------------------------------------------------------------------

OPENROUTER_TEST_KEY = 'sk-or-v1-offline-test-key'


def _openrouter_ok(payload, finish_reason='stop'):
    """A successful OpenRouter completion carrying the design spec as JSON."""
    response = Mock(status_code=200, headers={'content-type': 'application/json'})
    response.json.return_value = {
        'choices': [{'finish_reason': finish_reason, 'message': {'content': json.dumps(payload)}}],
    }
    return response


def _openrouter_http(status, body):
    response = Mock(status_code=status, headers={})
    response.json.return_value = body
    return response


def test_stale_openrouter_model_env_cannot_switch_production():
    assert b.OPENROUTER_MODEL == 'nvidia/nemotron-3-super-120b-a12b:free'
    # A stale OPENROUTER_MODEL (e.g. an old value in .env) is ignored.
    assert b._locked_openrouter_model('z-ai/glm-5.2:free') == b.OPENROUTER_MODEL
    assert b._locked_openrouter_model('') == b.OPENROUTER_MODEL
    assert b.SITEMORPH_MODEL == b.OPENROUTER_MODEL


def test_active_routing_is_one_openrouter_model_only():
    expected = [{'provider': 'openrouter', 'model': 'nvidia/nemotron-3-super-120b-a12b:free'}]
    assert b.NORMAL_MODEL_TARGETS == expected
    assert b.ULTRA_MODEL_TARGETS == expected
    assert b.ULTRA_PLUS_MODEL_TARGETS == expected
    assert set(b.MODEL_TARGETS) == {'normal', 'ultra', 'ultra+'}
    for targets in b.MODEL_TARGETS.values():
        assert len(targets) == 1  # no fallback chain, no second model
        assert targets[0] == expected[0]
    chain = json.dumps(b.MODEL_TARGETS).lower()
    for banned in ('gemini', 'xkiro', 'mistral', 'deepseek', 'ling', 'hugging', 'openrouter/free'):
        assert banned not in chain, banned


def test_endpoint_normalizes_string_lists_without_extra_ai_call(client, monkeypatch):
    payload = fixture('mochi')
    payload['semanticProfile']['brandTempo'] = 'spokojne, zmysłowe, celebrujące moment'
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=_openrouter_ok(payload))
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={
        'business_name': '', 'niche': '', 'description': 'Mad Mochi: mochi, matcha, sakura',
        'image_urls': supplied_urls(payload),
    })

    assert result.status_code == 200, result.text
    data = result.json()
    # Repairing the answer locally must not cost a second generation.
    assert post.call_count == data['ai_calls'] == 1
    assert data['status'] == 'success'
    assert data['provider'] == 'openrouter' and data['used_model'] == b.OPENROUTER_MODEL
    assert data['model_attempts'][0]['normalized_fields'] == ['semanticProfile.brandTempo']
    assert data['design_brief']['semanticProfile']['brandTempo'] == ['spokojne, zmysłowe, celebrujące moment']
    assert validate_project(data['files'])[0]


@pytest.mark.parametrize('mode', ['normal', 'ultra', 'ultra+'])
def test_endpoint_one_call_spec_to_complete_react_in_every_mode(client, monkeypatch, mode):
    payload = fixture('mochi')
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=_openrouter_ok(payload))
    monkeypatch.setattr(b.requests, 'post', post)
    result = client.post('/api/builder/generate', json={
        'business_name': '', 'niche': '', 'description': 'Mad Mochi: mochi, matcha, sakura',
        'image_urls': supplied_urls(payload), 'mode': mode,
    })
    assert result.status_code == 200, result.text
    data = result.json()
    assert post.call_count == data['ai_calls'] == 1

    # The request goes to OpenRouter only, one plain JSON completion.
    assert post.call_args.args[0] == 'https://openrouter.ai/api/v1/chat/completions'
    assert post.call_args.args[0] == f'{b.OPENROUTER_BASE_URL}/chat/completions'
    assert post.call_args.kwargs['stream'] is False
    request = post.call_args.kwargs['json']
    assert request['model'] == 'nvidia/nemotron-3-super-120b-a12b:free'
    assert request['stream'] is False
    assert request['max_tokens'] == 32000
    assert request['temperature'] == 0.3
    # Nemotron 3 Super supports structured output (json_object).
    assert request['response_format'] == {'type': 'json_object'}
    assert request['provider'] == {'require_parameters': True}
    assert request['reasoning'] == {'enabled': False}
    assert [m['role'] for m in request['messages']] == ['system', 'user']
    assert 'Mad Mochi: mochi, matcha, sakura' in request['messages'][1]['content']

    headers = post.call_args.kwargs['headers']
    assert headers['Authorization'] == f'Bearer {OPENROUTER_TEST_KEY}'
    assert headers['HTTP-Referer'] == b.OPENROUTER_SITE_URL
    assert headers['X-Title'] == b.OPENROUTER_APP_NAME
    assert post.call_args.kwargs['timeout'] == (b.OPENROUTER_CONNECT_TIMEOUT, b.OPENROUTER_TOTAL_TIMEOUT)

    assert data['pipeline'] == 'single-spec-design-compiler-react'
    assert data['provider'] == 'openrouter'
    assert data['model'] == data['used_model'] == data['requested_model'] == b.OPENROUTER_MODEL
    assert data['model_attempts'] == [{
        'provider': 'openrouter', 'model': b.OPENROUTER_MODEL, 'status': 'success',
        'duration_ms': data['model_attempts'][0]['duration_ms'],
    }]
    assert data['design_spec']['creative']['conceptTitle'] == payload['creative']['conceptTitle']
    assert data['quality_review']['visual_review_performed'] is False
    assert 'score' not in data['quality_review']
    assert validate_project(data['files'])[0]
    # The API key must never appear in the response body.
    assert OPENROUTER_TEST_KEY not in result.text


def test_system_prompt_forbids_legacy_v1_and_demands_v2(client, monkeypatch):
    """Capture the real system prompt sent to the model and verify guardrails."""
    payload = fixture('mochi')
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=_openrouter_ok(payload))
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={
        'business_name': '', 'niche': '', 'description': 'Mad Mochi: mochi, matcha, sakura',
        'image_urls': supplied_urls(payload),
    })
    assert result.status_code == 200, result.text

    system_msg = post.call_args.kwargs['json']['messages'][0]
    assert system_msg['role'] == 'system'
    prompt = system_msg['content']

    # The prompt is the one canonical v2 spec, not the legacy builder_prompt.
    from app.design.prompt import SYSTEM_PROMPT as V2_PROMPT
    assert prompt == V2_PROMPT
    assert 'SiteMorphSpecV2' in V2_PROMPT

    # All ten v2 root keys are named explicitly in the prompt.
    for key in ('meta', 'businessBrief', 'creative', 'semanticProfile',
                'tokens', 'assetPlan', 'pagePlan', 'interactions',
                'mobile', 'validationHints'):
        assert key in prompt, f'{key!r} missing from system prompt'

    # The prompt explicitly forbids the legacy v1 format.
    assert 'FORBIDDEN LEGACY KEYS' in prompt
    for legacy in ('projectName', 'designBrief', 'designTokens',
                   'sectionPlan', 'assetRequests', 'files', 'warnings'):
        assert legacy in prompt, f'legacy key {legacy!r} not forbidden in prompt'

    # The prompt tells the model the compiler generates React.
    assert 'compiler generates React' in prompt or 'deterministic React compiler' in prompt

    # Exactly one request, one model, correct temperature.
    assert post.call_count == 1
    request = post.call_args.kwargs['json']
    assert request['model'] == 'nvidia/nemotron-3-super-120b-a12b:free'
    assert request['temperature'] == 0.3
    assert request['max_tokens'] == 32000
    assert request['stream'] is False
    # Structured output enabled with json_object format.
    assert request['response_format'] == {'type': 'json_object'}


def test_structured_output_json_format_enabled_by_default(monkeypatch):
    """Nemotron 3 Super supports json_object structured output."""
    assert b.OPENROUTER_JSON_FORMAT is True
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=_openrouter_ok({'ok': True}))
    monkeypatch.setattr(b.requests, 'post', post)

    b.openrouter_generate_model(b.OPENROUTER_MODEL, 'S', 'U')
    request = post.call_args.kwargs['json']
    assert request['response_format'] == {'type': 'json_object'}
    assert request['provider'] == {'require_parameters': True}

    # The switch can be turned off for a model that doesn't support it.
    monkeypatch.setattr(b, 'OPENROUTER_JSON_FORMAT', False)
    post.reset_mock()
    b.openrouter_generate_model(b.OPENROUTER_MODEL, 'S', 'U')
    assert 'response_format' not in post.call_args.kwargs['json']
    assert 'provider' not in post.call_args.kwargs['json']


def test_reasoning_is_disabled_with_the_probed_parameter(monkeypatch):
    assert b.OPENROUTER_REASONING_PARAM is True
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=_openrouter_ok({'ok': True}))
    monkeypatch.setattr(b.requests, 'post', post)

    b.openrouter_generate_model(b.OPENROUTER_MODEL, 'S', 'U')
    assert post.call_args.kwargs['json']['reasoning'] == {'enabled': False}

    monkeypatch.setattr(b, 'OPENROUTER_REASONING_PARAM', False)
    post.reset_mock()
    b.openrouter_generate_model(b.OPENROUTER_MODEL, 'S', 'U')
    assert 'reasoning' not in post.call_args.kwargs['json']


def test_endpoint_repairs_strict_contract_violations_in_one_call(client, monkeypatch):
    payload = fixture('mochi')
    payload['pagePlan']['mobile'] = deepcopy(payload['mobile'])
    payload['assetPlan']['requests'] = [{
        'id': 'hero-shot', 'subject': 'mochi donut', 'query': 'mochi donut close up',
        'role': 'hero', 'orientation': 'landrait',
    }]
    payload['businessBrief']['audience'] = ['Gen Z', 'Millennials']
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=_openrouter_ok(payload))
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={
        'business_name': '', 'niche': '', 'description': 'Mad Mochi: mochi, matcha, sakura',
        'image_urls': supplied_urls(payload),
    })

    assert result.status_code == 200, result.text
    data = result.json()
    # Every repair is local, so the free model is still called exactly once.
    assert post.call_count == data['ai_calls'] == 1
    assert data['provider'] == 'openrouter'
    assert data['used_model'] == data['model'] == 'nvidia/nemotron-3-super-120b-a12b:free'
    assert data['requested_model'] == b.OPENROUTER_MODEL
    attempt = data['model_attempts'][0]
    assert attempt['dropped_fields'] == ['pagePlan.mobile']
    assert attempt['normalized_fields'] == ['businessBrief.audience']
    assert attempt['enum_aliases'] == [{
        'field': 'assetPlan.requests[0].orientation',
        'from': 'landrait', 'to': 'landscape', 'match': 'alias',
    }]
    assert 'truncated_fields' not in attempt
    assert validate_project(data['files'])[0]


def test_endpoint_repairs_damaged_json_in_one_call(client, monkeypatch):
    payload = fixture('mochi')
    broken = json.dumps(payload, ensure_ascii=False)[:-1] + ',}'  # trailing comma
    response = Mock(status_code=200, headers={'content-type': 'application/json'})
    response.json.return_value = {'choices': [{'finish_reason': 'stop', 'message': {'content': broken}}]}
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=response)
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={
        'business_name': '', 'niche': '', 'description': 'Mad Mochi: mochi, matcha, sakura',
        'image_urls': supplied_urls(payload),
    })

    assert result.status_code == 200, result.text
    data = result.json()
    # Repairing syntax locally must not cost a second generation.
    assert post.call_count == data['ai_calls'] == 1
    assert data['provider'] == 'openrouter'
    assert data['model_attempts'][0]['json_repaired'] is True
    assert data['used_model'] == data['requested_model'] == b.OPENROUTER_MODEL
    assert data['design_spec']['businessBrief']['name'] == payload['businessBrief']['name']
    assert validate_project(data['files'])[0]


def test_endpoint_repairs_a_mismatched_link_kind_in_one_call(client, monkeypatch):
    payload = fixture('mochi')
    payload['interactions']['links'][1]['kind'] = 'external'  # but the href is a mailto:
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=_openrouter_ok(payload))
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={
        'business_name': '', 'niche': '', 'description': 'Mad Mochi: mochi, matcha, sakura',
        'image_urls': supplied_urls(payload),
    })

    assert result.status_code == 200, result.text
    data = result.json()
    assert post.call_count == data['ai_calls'] == 1
    assert data['provider'] == 'openrouter'
    assert data['model_attempts'][0]['enum_aliases'] == [{
        'field': 'interactions.links[1].kind', 'from': 'external', 'to': 'mailto', 'match': 'href',
    }]
    shipped = data['design_spec']['interactions']['links'][1]
    assert shipped['kind'] == 'mailto'
    assert shipped['href'] == 'mailto:kontakt@mochi.test'
    assert validate_project(data['files'])[0]


def test_endpoint_relocates_nested_interactions_in_one_call(client, monkeypatch):
    payload = fixture('mochi')
    payload['pagePlan']['interactions'] = payload.pop('interactions')
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=_openrouter_ok(payload))
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={
        'business_name': '', 'niche': '', 'description': 'Mad Mochi: mochi, matcha, sakura',
        'image_urls': supplied_urls(payload),
    })

    assert result.status_code == 200, result.text
    data = result.json()
    assert post.call_count == data['ai_calls'] == 1
    assert data['provider'] == 'openrouter'
    assert data['model_attempts'][0]['relocated_fields'] == [
        {'from': 'pagePlan.interactions', 'to': 'interactions'},
    ]
    assert data['design_spec']['interactions']['links']
    assert 'interactions' not in data['design_spec']['pagePlan']
    assert validate_project(data['files'])[0]


def test_invalid_spec_never_triggers_another_model(client, monkeypatch):
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    # A legacy provider key must not rescue the request either.
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'offline-test-key')
    monkeypatch.setattr(b, 'GEMINI_API_KEY', 'AQ.offline-gemini-key')
    post = Mock(return_value=_openrouter_ok({'meta': {'schemaVersion': '2.0'}}))
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={'business_name': 'Mochi', 'niche': '', 'description': 'mochi'})

    assert result.status_code == 502
    assert result.json()['detail'] == b.INVALID_SPEC_DETAIL
    assert post.call_count == 1


def test_invalid_json_never_triggers_another_model(client, monkeypatch):
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    response = Mock(status_code=200, headers={'content-type': 'application/json'})
    response.json.return_value = {'choices': [{'finish_reason': 'stop', 'message': {'content': '{not json'}}]}
    post = Mock(return_value=response)
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={'business_name': 'Mochi', 'niche': '', 'description': 'mochi'})

    assert result.status_code == 502
    assert result.json()['detail'] == b.INVALID_RESPONSE_DETAIL
    assert post.call_count == 1


@pytest.mark.parametrize('status', [429, 500, 503])
def test_provider_failure_never_falls_back(client, monkeypatch, status):
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(return_value=_openrouter_http(status, {'error': {'code': 'rate_limit', 'message': 'model busy'}}))
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={'business_name': 'Mochi', 'niche': '', 'description': 'mochi'})

    assert result.status_code == 503
    assert result.json()['detail'] == b.PROVIDER_UNAVAILABLE_DETAIL
    assert post.call_count == 1


def test_timeout_never_falls_back(client, monkeypatch):
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    post = Mock(side_effect=b.requests.Timeout('too slow'))
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={'business_name': 'Mochi', 'niche': '', 'description': 'mochi'})

    assert result.status_code == 503
    assert result.json()['detail'] == b.PROVIDER_UNAVAILABLE_DETAIL
    assert post.call_count == 1


def test_bad_key_is_configuration_error_not_fake_overload(client, monkeypatch):
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', 'sk-or-v1-wrong-key')
    post = Mock(return_value=_openrouter_http(
        401, {'error': {'code': 'invalid_api_key', 'message': 'No auth credentials found'}},
    ))
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={'business_name': 'Mochi', 'niche': '', 'description': 'mochi'})

    assert result.status_code == 503
    assert result.json()['detail'] == b.CONFIGURATION_DETAIL
    assert 'przeciąż' not in result.json()['detail']
    assert post.call_count == 1
    assert 'sk-or-v1-wrong-key' not in result.text


def test_missing_key_is_a_configuration_error_without_any_request(client, monkeypatch):
    post = Mock(side_effect=AssertionError('must not call the provider'))
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', '')
    # Legacy providers must not silently take over.
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'offline-test-key')
    monkeypatch.setattr(b, 'GEMINI_API_KEY', 'AQ.offline-gemini-key')
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={'business_name': 'Mochi', 'niche': '', 'description': 'mochi'})

    assert result.status_code == 503
    assert result.json()['detail'] == b.CONFIGURATION_DETAIL
    assert post.call_count == 0


def test_openrouter_function_refuses_a_foreign_model_without_a_request(monkeypatch):
    post = Mock(side_effect=AssertionError('must not call the provider'))
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    monkeypatch.setattr(b.requests, 'post', post)

    text, error = b.openrouter_generate_model('gemini-3.5-flash', 'S', 'U')

    assert text is None and error and 'wyłącznie' in error
    assert post.call_count == 0


def test_openrouter_function_refuses_without_a_key(monkeypatch):
    post = Mock(side_effect=AssertionError('must not call the provider'))
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', '')
    monkeypatch.setattr(b.requests, 'post', post)

    text, error = b.openrouter_generate_model(b.OPENROUTER_MODEL, 'S', 'U')

    assert text is None and 'Brak klucza' in error
    assert post.call_count == 0


@pytest.mark.parametrize('body,expected', [
    ({}, 'nie zwrócił żadnej odpowiedzi'),
    ({'choices': []}, 'nie zwrócił żadnej odpowiedzi'),
    ({'choices': [{}]}, 'pustą odpowiedź'),
    ({'choices': [{'message': {}}]}, 'pustą odpowiedź'),
    ({'choices': [{'message': {'content': ''}}]}, 'pustą odpowiedź'),
    ({'choices': [{'finish_reason': 'length', 'message': {'content': '{"a":1}'}}]}, 'uciął odpowiedź'),
])
def test_incomplete_openrouter_bodies_are_rejected(monkeypatch, body, expected):
    response = Mock(status_code=200, headers={'content-type': 'application/json'})
    response.json.return_value = body
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    monkeypatch.setattr(b.requests, 'post', Mock(return_value=response))

    text, error = b.openrouter_generate_model(b.OPENROUTER_MODEL, 'S', 'U')

    assert text is None and expected in error


def test_reasoning_is_never_joined_onto_the_final_content(monkeypatch):
    payload = fixture('mochi')
    response = Mock(status_code=200, headers={'content-type': 'application/json'})
    response.json.return_value = {
        'choices': [{
            'finish_reason': 'stop',
            'message': {
                'reasoning': 'ukryte rozumowanie modelu',
                'reasoning_details': [{'type': 'reasoning.text', 'text': 'ukryte rozumowanie modelu'}],
                'content': [{'type': 'text', 'text': json.dumps(payload)}],
            },
        }],
    }
    monkeypatch.setattr(b, 'OPENROUTER_API_KEY', OPENROUTER_TEST_KEY)
    monkeypatch.setattr(b.requests, 'post', Mock(return_value=response))

    text, error = b.openrouter_generate_model(b.OPENROUTER_MODEL, 'S', 'U')

    assert error is None
    assert 'ukryte rozumowanie' not in text
    assert json.loads(text)['businessBrief']['name'] == payload['businessBrief']['name']


@pytest.mark.parametrize('error,status', [
    ('OpenRouter HTTP 429 (rate_limit). slow down', 'rate_limited'),
    ('OpenRouter chwilowo nie może obsłużyć modelu, HTTP 503 (overloaded). busy', 'unavailable'),
    ('OpenRouter przekroczył czas odpowiedzi.', 'timeout'),
    ('OpenRouter HTTP 401 (invalid_api_key). bad key', 'unauthorized'),
    ('OpenRouter: brak środków (insufficient_quota). top up', 'payment'),
    ('OpenRouter HTTP 404 (model_not_found). gone', 'not_found'),
    (None, 'unavailable'),
])
def test_openrouter_error_statuses(error, status):
    assert b.openrouter_error_status(error) == status


def test_gemini_generate_content_json_returns_only_final_text(monkeypatch):
    response = Mock(status_code=200, headers={'content-type': 'application/json'})
    response.json.return_value = {'candidates': [{
        'content': {'parts': [
            {'text': 'ukryte rozumowanie', 'thought': True},
            {'text': '{"ok":true}'},
        ]},
        'finishReason': 'STOP',
    }]}
    post = Mock(return_value=response)
    monkeypatch.setattr(b, 'GEMINI_API_KEY', 'AQ.offline-gemini-key')
    monkeypatch.setattr(b, 'GEMINI_BASE_URL', '')
    monkeypatch.setattr(b.requests, 'post', post)

    text, error = b.gemini_generate_model(
        'gemini-3.5-flash', 'Return JSON.', 'Create a site.', timeout=15,
    )

    # The reasoning part must never be concatenated onto the JSON.
    assert error is None and text == '{"ok":true}'
    call = post.call_args
    assert call.args[0].startswith('https://generativelanguage.googleapis.com/v1beta/')
    assert call.args[0].endswith('/models/gemini-3.5-flash:generateContent')
    assert 'aiplatform.googleapis.com' not in call.args[0]
    assert 'offline-gemini-key' not in call.args[0]
    assert call.kwargs['headers']['x-goog-api-key'] == 'AQ.offline-gemini-key'
    assert call.kwargs['headers']['Accept'] == 'application/json'
    assert call.kwargs['stream'] is False
    assert call.kwargs['json']['systemInstruction']['parts'][0]['text'] == 'Return JSON.'
    assert call.kwargs['json']['contents'][0]['parts'][0]['text'] == 'Create a site.'
    assert call.kwargs['json']['generationConfig']['responseMimeType'] == 'application/json'
    assert call.kwargs['json']['generationConfig']['maxOutputTokens'] == 32000
    # The contract schema is opt-in, because the API currently rejects it.
    assert 'responseJsonSchema' not in call.kwargs['json']['generationConfig']
    assert call.kwargs['timeout'] == (b.MODEL_CONNECT_TIMEOUT, 15)
    assert call.kwargs['timeout'][1] != b.MODEL_FIRST_TOKEN_TIMEOUT
    response.json.assert_called_once_with()

    # AQ keys do not imply Vertex: the paid endpoint stays opt-in via config.
    assert b._gemini_api_base() == 'https://generativelanguage.googleapis.com/v1beta'
    monkeypatch.setattr(
        b, 'GEMINI_BASE_URL', 'https://aiplatform.googleapis.com/v1/publishers/google',
    )
    assert b._gemini_api_base() == 'https://aiplatform.googleapis.com/v1/publishers/google'


def test_openai_compatible_stream_can_finish_without_done_marker(monkeypatch):
    event = {'choices': [{'delta': {'content': '{"ok":true}'}, 'finish_reason': 'stop'}]}
    response = Mock(status_code=200, headers={'content-type': 'text/event-stream'})
    response.iter_lines.return_value = ['data: ' + json.dumps(event), '']
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'offline-test-key')
    monkeypatch.setattr(b.requests, 'post', Mock(return_value=response))

    text, error = b.xkiro_generate_model('deepseek/test', 'Return JSON.', 'Create a site.', timeout=15)

    assert error is None and text == '{"ok":true}'


@pytest.mark.parametrize('error', [
    'OpenRouter HTTP 409 (conflict)',
    'OpenRouter HTTP 500 (internal_error)',
    'OpenRouter HTTP 504 (timeout)',
    'Połączenie z OpenRouter zostało przerwane',
])
def test_transient_provider_errors_are_recognised(error):
    assert b._is_model_unavailable(error)


def test_a_bad_key_is_not_a_transient_failure():
    assert not b._is_model_unavailable('OpenRouter HTTP 401 (invalid_api_key)')
