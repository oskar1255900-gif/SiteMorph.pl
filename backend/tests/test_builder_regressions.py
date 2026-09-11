import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import builder_assets as assets
from app.auth import get_current_user
from app.database import Base, get_db
from app.publishing import source_hash
from app.routers import builder as b
from test_builder_contract import _good_project


@pytest.mark.parametrize('status', [400, 413, 422, 409, 429, 500, 524])
def test_http_failure_never_retries_or_reduces_budget(monkeypatch, status):
    post = Mock(return_value=Mock(status_code=status))
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'offline-test-key')
    monkeypatch.setattr(b.requests, 'post', post)
    files, _, error = b._generate_project_with_retry(b.DEEPSEEK_MODEL, 'business prompt')
    assert files is None and error
    assert post.call_count == 1
    assert post.call_args.kwargs['json']['max_tokens'] == 32000


def test_truncated_completion_is_not_accepted(monkeypatch):
    response = Mock(status_code=200)
    response.json.return_value = {'choices': [{'finish_reason': 'length', 'message': {'content': json.dumps({'files': _good_project()})}}]}
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'test')
    monkeypatch.setattr(b.requests, 'post', Mock(return_value=response))
    assert b._generate_project_with_retry(b.DEEPSEEK_MODEL, 'prompt')[0] is None


@pytest.mark.parametrize('change', ['empty_css', 'invalid_package', 'missing_import', 'tailwind', 'iframe'])
def test_invalid_projects_fail(change):
    files = _good_project()
    if change == 'empty_css': files['main/frontend/src/index.css'] = '/* design */' + ' ' * 700
    if change == 'invalid_package': files['main/frontend/package.json'] = 'not JSON'
    if change == 'missing_import': files['main/frontend/src/App.tsx'] += '\nimport Missing from "./Missing";'
    if change == 'tailwind': files['main/frontend/src/index.css'] += '\n@tailwind utilities;'
    if change == 'iframe': files['main/frontend/src/App.tsx'] += '\nconst Site = () => <iframe srcDoc="html" />;'
    assert not b.validate_project(files)[0]


def test_section_structure_and_long_section_plan_are_preserved():
    files = {k.replace('/components/', '/sections/'): v.replace('./components/', './sections/') for k, v in _good_project().items()}
    assert b.validate_project(files)[0]
    plan = [{'id': str(i)} for i in range(9)]
    assert b.extract_contract({'sectionPlan': plan})['section_plan'] == plan


def test_raw_intent_is_not_replaced_by_defaults():
    raw = 'Mad Mochi — matcha, sakura. Nie zmieniaj nazwy Łódź.'
    prompt = b._build_generation_prompt(b.BuilderInput(business_name='', niche='', description=raw, fonts='auto', colors='auto'))
    assert raw in prompt
    assert 'Inter' not in prompt and 'dark' not in prompt


def test_asset_requests_run_concurrently_and_deduplicate(monkeypatch):
    barrier = Barrier(3)
    def search(spec, key):
        barrier.wait(timeout=2)
        return [{'url': 'https://images.unsplash.com/same'}, {'url': 'https://images.unsplash.com/' + spec['placeholder']}]
    monkeypatch.setattr(assets, '_search', search)
    slots = [f'__SITEMORPH_IMAGE_{i}__' for i in range(1, 4)]
    files, selected, warnings = assets.resolve_assets({'main/frontend/src/data.ts': ' '.join(slots)}, [{'placeholder': p} for p in slots], 'test')
    assert len({p['url'] for p in selected}) == 3
    assert not warnings and '__SITEMORPH_IMAGE_' not in ' '.join(files.values()).replace('https://images.unsplash.com/__SITEMORPH_IMAGE_', '')


def test_missing_photo_is_visible_and_never_empty_src(monkeypatch):
    monkeypatch.setattr(assets.requests, 'get', Mock(side_effect=AssertionError('no network')))
    files, selected, warnings = assets.resolve_assets({'main/frontend/src/a.tsx': '<img src="__SITEMORPH_IMAGE_1__" />'}, [], '')
    assert 'data:image/svg+xml' in next(iter(files.values()))
    assert 'src=""' not in next(iter(files.values()))
    assert not selected and warnings


def test_mochi_does_not_receive_unrelated_dessert(monkeypatch):
    assets._cache.clear()
    response = Mock()
    response.json.return_value = {'results': [{'alt_description': 'ice cream and caramel', 'urls': {'regular': 'https://images.unsplash.com/icecream'}}]}
    monkeypatch.setattr(assets.requests, 'get', Mock(return_value=response))
    assert not assets._search({'query': 'mochi donuts', 'subject': 'mochi donuts'}, 'test')


@pytest.fixture
def client():
    from main import app
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    def db():
        with factory() as session: yield session
    app.dependency_overrides[get_db] = db
    app.dependency_overrides[get_current_user] = lambda: {'id': 'test-owner', 'is_anon': False}
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    engine.dispose()


def content(version='first'):
    files = _good_project()
    files['main/frontend/src/index.css'] += f'\n/* {version} */'
    return {'files': files, 'metadata': {'design_tokens': {'accent': 'pink'}, 'section_plan': list(range(9))},
            'artifact': {'sourceHash': source_hash(files), 'buildId': version, 'compilerVersion': 'sitemorph-esbuild-3',
                         'html': '<!doctype html><html><head><title>Saved artifact</title></head><body><div id="root">' + version + '</div></body></html>'}}


def test_save_update_publish_keeps_exact_artifact_and_metadata(client):
    first = content()
    response = client.post('/api/projects/', json={'name': 'Brand', 'domain': 'brand.test', 'niche': 'cafe', 'content': first})
    assert response.status_code == 200, response.text
    pid = response.json()['id']
    updated = content('second')
    saved = client.patch(f'/api/projects/{pid}', json={'name': 'Brand 2', 'content': updated})
    assert saved.status_code == 200 and saved.json()['content'] == updated
    stale = client.post('/api/publish', json={'project_id': pid, 'source_hash': first['artifact']['sourceHash'], 'build_id': 'first'})
    assert stale.status_code == 409
    published = client.post('/api/publish', json={'project_id': pid, 'source_hash': updated['artifact']['sourceHash'], 'build_id': 'second'})
    assert published.status_code == 200, published.text
    page = client.get(published.json()['url'])
    assert page.text == updated['artifact']['html']
    assert "script-src 'unsafe-inline' https://esm.sh" in page.headers['content-security-policy']
    assert 'sandbox allow-scripts' in page.headers['content-security-policy']
    assert 'allow-same-origin' not in page.headers['content-security-policy']


def test_save_rejects_stale_artifact(client):
    stale = content()
    stale['files']['main/frontend/src/index.css'] += 'body{color:red}'
    assert client.post('/api/projects/', json={'name': 'Brand', 'domain': 'a.test', 'niche': '', 'content': stale}).status_code == 409


def test_anonymous_generation_is_rejected_before_model(client, monkeypatch):
    from main import app
    app.dependency_overrides[get_current_user] = lambda: {'id': 'anon', 'is_anon': True}
    post = Mock(side_effect=AssertionError('must not call provider'))
    monkeypatch.setattr(b.requests, 'post', post)
    assert client.post('/api/builder/generate', json={'business_name': 'A', 'description': 'A', 'niche': ''}).status_code == 401
    assert post.call_count == 0


def test_generation_failure_has_no_success_fallback(client, monkeypatch):
    monkeypatch.setattr(b, 'XKIRO_API_KEY', 'test')
    generate = Mock(return_value=(None, {}, 'Provider HTTP 524'))
    monkeypatch.setattr(b, '_generate_design_spec', generate)
    response = client.post('/api/builder/generate', json={'business_name': 'A', 'description': 'A', 'niche': ''})
    assert response.status_code == 502
    assert generate.call_count == 1


def test_upload_roundtrip_and_rejects_non_image(client):
    import base64
    pixel = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1X8AAAAASUVORK5CYII=')
    response = client.post('/api/builder/upload', files={'files': ('product.png', pixel, 'image/png')})
    assert response.status_code == 200, response.text
    asset = client.get(response.json()['urls'][0])
    assert asset.content == pixel and asset.headers['content-type'] == 'image/png'
    assert client.post('/api/builder/upload', files={'files': ('fake.png', b'not an image', 'image/png')}).status_code == 422


def test_other_user_cannot_publish_or_replace_project(client):
    from main import app
    data = content()
    response = client.post('/api/projects/', json={'name': 'A', 'domain': 'owner.test', 'niche': '', 'content': data})
    pid = response.json()['id']
    app.dependency_overrides[get_current_user] = lambda: {'id': 'other-owner', 'is_anon': False}
    assert client.patch(f'/api/projects/{pid}', json={'content': data}).status_code == 403
    assert client.post('/api/publish', json={'project_id': pid, 'source_hash': data['artifact']['sourceHash'], 'build_id': 'first'}).status_code == 404
