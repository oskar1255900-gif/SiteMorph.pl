import json
from copy import deepcopy
from unittest.mock import Mock
import pytest
from app.design.validation import validate_spec
from app.design.assets import bind_assets
from app.design.compiler import compile_design
from app.design.tokens import contrast, resolve_tokens
from app.builder_validation import validate_project
from app.routers import builder as b
from design_fixtures import fixture, supplied_urls
from test_builder_regressions import client  # isolated SQLite + authenticated TestClient fixture


@pytest.fixture(autouse=True)
def reset_model_cooldowns():
    with b._MODEL_COOLDOWNS_LOCK:
        b._MODEL_COOLDOWNS.clear()
    yield
    with b._MODEL_COOLDOWNS_LOCK:
        b._MODEL_COOLDOWNS.clear()


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


def test_normal_endpoint_one_http_call_spec_to_complete_react(client, monkeypatch):
    payload = fixture('mochi')
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'offline-test-key')
    monkeypatch.setattr(b, 'GEMINI_API_KEY', 'AQ.offline-gemini-key')
    response = Mock(status_code=200, headers={'content-type': 'application/json'})
    response.json.return_value = {'candidates': [{
        'content': {'parts': [{'text': json.dumps(payload)}]}, 'finishReason': 'STOP',
    }]}
    post = Mock(return_value=response)
    monkeypatch.setattr(b.requests, 'post', post)
    result = client.post('/api/builder/generate', json={'business_name': '', 'niche': '', 'description': 'Mad Mochi: mochi, matcha, sakura', 'image_urls': supplied_urls(payload)})
    assert result.status_code == 200, result.text
    data = result.json()
    assert post.call_count == data['ai_calls'] == 1
    request = post.call_args.kwargs['json']
    assert request['generationConfig']['maxOutputTokens'] == 32000
    assert 'Mad Mochi: mochi, matcha, sakura' in request['contents'][0]['parts'][0]['text']
    assert post.call_args.args[0].endswith('/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse')
    assert data['pipeline'] == 'single-spec-design-compiler-react'
    assert data['provider'] == 'gemini' and data['used_model'] == 'gemini-2.5-flash-lite'
    assert data['model_attempts'] == [{
        'provider': 'gemini', 'model': 'gemini-2.5-flash-lite', 'status': 'success',
        'duration_ms': data['model_attempts'][0]['duration_ms'],
    }]
    assert data['design_spec']['creative']['conceptTitle'] == payload['creative']['conceptTitle']
    assert data['quality_review']['visual_review_performed'] is False
    assert 'score' not in data['quality_review']
    assert validate_project(data['files'])[0]


def test_invalid_spec_tries_next_configured_model_without_ai_repair(client, monkeypatch):
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'offline-test-key')
    monkeypatch.setattr(b, 'GEMINI_API_KEY', 'AQ.offline-gemini-key')
    gemini = Mock(status_code=200, headers={'content-type': 'application/json'})
    gemini.json.return_value = {'candidates': [{
        'content': {'parts': [{'text': '{"meta":{"schemaVersion":"2.0"}}'}]},
        'finishReason': 'STOP',
    }]}
    xkiro = Mock(status_code=200, headers={'content-type': 'application/json'})
    xkiro.json.return_value = {'choices': [{'message': {'content': '{"meta":{"schemaVersion":"2.0"}}'}}]}
    post = Mock(side_effect=[gemini, xkiro])
    monkeypatch.setattr(b.requests, 'post', post)
    result = client.post('/api/builder/generate', json={'business_name': 'Mochi', 'niche': '', 'description': 'mochi'})
    assert result.status_code == 503
    assert 1 < post.call_count <= b.MAX_MODEL_ATTEMPTS


def test_gemini_429_falls_back_and_reports_mistral(client, monkeypatch):
    payload = fixture('mochi')
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'offline-test-key')
    monkeypatch.setattr(b, 'GEMINI_API_KEY', 'AQ.offline-gemini-key')

    unavailable = Mock(status_code=429, headers={})
    unavailable.json.return_value = {'error': {'code': 'rate_limit', 'message': 'model busy'}}
    success = Mock(status_code=200, headers={'content-type': 'application/json'})
    success.json.return_value = {
        'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(payload)}}],
    }
    post = Mock(side_effect=[unavailable, success])
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={
        'business_name': '', 'niche': '', 'description': 'Mad Mochi',
        'image_urls': supplied_urls(payload),
    })
    assert result.status_code == 200, result.text
    data = result.json()
    assert post.call_count == data['ai_calls'] == 2
    assert data['requested_model'] == 'gemini-2.5-flash-lite'
    assert data['used_model'] == 'mistralai/mistral-small-2603'
    assert data['model'] == data['used_model'] and data['provider'] == 'xkiro'
    assert [attempt['status'] for attempt in data['model_attempts']] == ['unavailable', 'success']
    assert post.call_args_list[1].args[0] == 'https://api.xkiro.com/v1/chat/completions'


def test_default_routes_use_free_gemini_then_mistral():
    assert [(target['provider'], target['model']) for target in b.NORMAL_MODEL_TARGETS] == [
        ('gemini', 'gemini-2.5-flash-lite'),
        ('xkiro', 'mistralai/mistral-small-2603'),
    ]
    assert [(target['provider'], target['model']) for target in b.ULTRA_MODEL_TARGETS] == [
        ('gemini', 'gemini-2.5-flash'),
        ('xkiro', 'mistralai/mistral-large-2512'),
    ]


def test_missing_xkiro_models_are_removed_and_express_gemini_is_downgraded(monkeypatch):
    monkeypatch.setattr(b, 'GEMINI_API_KEY', 'AQ.offline-gemini-key')
    monkeypatch.setenv(
        'SITEMORPH_ULTRA_MODELS',
        'xkiro|deepseek/deepseek-v4-pro,xkiro|mistralai/mistral-large-2512,gemini|gemini-3.5-flash',
    )
    targets = b._model_targets_env('SITEMORPH_ULTRA_MODELS', [])
    assert targets == [
        {'provider': 'gemini', 'model': 'gemini-2.5-flash'},
        {'provider': 'xkiro', 'model': 'mistralai/mistral-large-2512'},
    ]


def test_gemini_native_stream_is_valid_json_fallback(monkeypatch):
    first = {'candidates': [{'content': {'parts': [{'text': '{"ok":'}]}}]}
    last = {'candidates': [{'content': {'parts': [{'text': 'true}'}]}, 'finishReason': 'STOP'}]}
    response = Mock(status_code=200, headers={'content-type': 'text/event-stream'})
    response.iter_lines.return_value = [
        'data: ' + json.dumps(first), '',
        'data: malformed-provider-event', '',
        'data: ' + json.dumps(last), '',
    ]
    post = Mock(return_value=response)
    monkeypatch.setattr(b, 'GEMINI_API_KEY', 'AQ.offline-gemini-key')
    monkeypatch.setattr(b, 'GEMINI_BASE_URL', '')
    monkeypatch.setattr(b.requests, 'post', post)

    text, error = b.gemini_generate_model(
        'gemini-2.5-flash', 'Return JSON.', 'Create a site.', timeout=15,
    )

    assert error is None and text == '{"ok":true}'
    call = post.call_args
    assert call.args[0].startswith('https://aiplatform.googleapis.com/v1/publishers/google/')
    assert call.args[0].endswith('/models/gemini-2.5-flash:streamGenerateContent?alt=sse')
    assert 'offline-gemini-key' not in call.args[0]
    assert call.kwargs['headers']['x-goog-api-key'] == 'AQ.offline-gemini-key'
    assert call.kwargs['json']['generationConfig']['responseMimeType'] == 'application/json'
    assert call.kwargs['json']['generationConfig']['maxOutputTokens'] == 32000


def test_missing_gemini_key_uses_xkiro_mistral_directly(client, monkeypatch):
    payload = fixture('mochi')
    success = Mock(status_code=200, headers={'content-type': 'application/json'})
    success.json.return_value = {
        'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(payload)}}],
    }
    post = Mock(return_value=success)
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'offline-xkiro-key')
    monkeypatch.setattr(b, 'GEMINI_API_KEY', '')
    monkeypatch.setattr(b.requests, 'post', post)

    result = client.post('/api/builder/generate', json={
        'business_name': '', 'niche': '', 'description': 'Mad Mochi',
        'image_urls': supplied_urls(payload),
    })

    assert result.status_code == 200, result.text
    data = result.json()
    assert post.call_count == data['ai_calls'] == 1
    assert data['provider'] == 'xkiro' and data['used_model'] == 'mistralai/mistral-small-2603'
    assert post.call_args.args[0] == 'https://api.xkiro.com/v1/chat/completions'


def test_openai_compatible_stream_can_finish_without_done_marker(monkeypatch):
    event = {'choices': [{'delta': {'content': '{"ok":true}'}, 'finish_reason': 'stop'}]}
    response = Mock(status_code=200, headers={'content-type': 'text/event-stream'})
    response.iter_lines.return_value = ['data: ' + json.dumps(event), '']
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'offline-test-key')
    monkeypatch.setattr(b.requests, 'post', Mock(return_value=response))

    text, error = b.xkiro_generate_model('deepseek/test', 'Return JSON.', 'Create a site.', timeout=15)

    assert error is None and text == '{"ok":true}'


@pytest.mark.parametrize('error', [
    'XKIRO HTTP 409 (conflict)',
    'XKIRO HTTP 500 (internal_error)',
    'OpenRouter HTTP 504 (timeout)',
    'Połączenie z XKIRO zostało przerwane',
])
def test_transient_provider_errors_allow_model_fallback(error):
    assert b._is_model_unavailable(error)
