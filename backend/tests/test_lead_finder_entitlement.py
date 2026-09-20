"""Kontrola dostępu do Lead Findera.

Lead Finder jest modułem płatnym: źródłem prawdy jest plan zapisany w
`UserSettings.data["plan"]`. Te testy pilnują, że brak pakietu blokuje
moduł również przy bezpośrednim requestcie do API, że kredyty nie zastępują
pakietu i że klient nie może przyznać sobie uprawnień nagłówkiem ani treścią
żądania. Żaden test zablokowanego dostępu nie może dotknąć dostawcy
wyszukiwania (Overpass/Google).
"""

import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import Mock

from app.auth import get_current_user
from app.database import Base, get_db
from app.entitlements import LEAD_FINDER_REQUIRED_DETAIL
from app.models import UserSettings
from app.routers import admin as admin_module
from app.routers import leads as leads_module

SEARCH_BODY = {'country': 'Polska', 'city': 'Łódź', 'industry': 'Cafe', 'limit': 5}


def _client(user_id: str = 'test-owner'):
    from main import app
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)

    def db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = db
    app.dependency_overrides[get_current_user] = lambda: {'id': user_id, 'is_anon': False, 'provider': 'supabase'}
    return app, engine, factory


@pytest.fixture
def env():
    """Izolowana baza + klient + fabryka sesji do zasiania planu."""
    app, engine, factory = _client()
    with TestClient(app) as client:
        yield client, factory
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def offline_provider(monkeypatch):
    """Dostawca wyszukiwania bez sieci: gdyby endpoint go dotknął, test padnie."""
    calls = Mock(side_effect=AssertionError('dostawca wyszukiwania nie może być wołany'))
    monkeypatch.setattr(leads_module.requests, 'post', calls)
    monkeypatch.setattr(leads_module.requests, 'get', calls)
    monkeypatch.setattr(leads_module, 'GOOGLE_KEY', '')
    return calls


def seed_plan(factory, plan=None, credits=0, expires_at=None):
    with factory() as session:
        data = {}
        if plan:
            data['plan'] = plan
        if expires_at is not None:
            data['plan_expires_at'] = expires_at
        session.add(UserSettings(user_id='test-owner', credits=credits, data=data))
        session.commit()


def test_without_a_package_search_is_403_and_never_reaches_the_provider(env, offline_provider):
    client, _ = env
    result = client.post('/api/leads/search', json=SEARCH_BODY)
    assert result.status_code == 403
    assert result.json()['detail'] == LEAD_FINDER_REQUIRED_DETAIL
    assert offline_provider.call_count == 0


def test_credits_are_not_a_package(env, offline_provider):
    """Konto z kredytami, ale bez pakietu, nie ma dostępu do Lead Findera."""
    client, factory = env
    seed_plan(factory, plan=None, credits=500)
    result = client.post('/api/leads/search', json=SEARCH_BODY)
    assert result.status_code == 403
    assert offline_provider.call_count == 0


def test_expired_package_does_not_grant_access(env, offline_provider):
    client, factory = env
    seed_plan(factory, plan='pro', credits=50, expires_at=time.time() - 3600)
    result = client.post('/api/leads/search', json=SEARCH_BODY)
    assert result.status_code == 403
    assert offline_provider.call_count == 0


def test_active_package_allows_search(env, monkeypatch):
    client, factory = env
    seed_plan(factory, plan='pro', credits=50)
    monkeypatch.setattr(leads_module, 'GOOGLE_KEY', '')
    monkeypatch.setattr(leads_module, 'geocode', lambda city, country: (51.7, 19.4, 51.8, 19.5))
    monkeypatch.setattr(leads_module, 'overpass_query', lambda *a, **k: [])

    result = client.post('/api/leads/search', json=SEARCH_BODY)

    assert result.status_code == 200, result.text
    assert result.json()['leads'] == []


def test_client_header_cannot_grant_a_package(env, offline_provider):
    """Nagłówek X-User-Plan był wcześniej czytany — nie może przyznawać dostępu."""
    client, _ = env
    result = client.post('/api/leads/search', json=SEARCH_BODY, headers={'X-User-Plan': 'business'})
    assert result.status_code == 403
    assert offline_provider.call_count == 0


def test_saved_leads_and_save_are_gated_too(env):
    client, _ = env
    assert client.get('/api/leads/').status_code == 403
    assert client.post('/api/leads/save', json={'name': 'Kawiarnia Testowa', 'city': 'Łódź'}).status_code == 403


def test_entitlements_endpoint_reports_package_state(env):
    client, factory = env
    empty = client.get('/api/entitlements')
    assert empty.status_code == 200
    assert empty.json() == {'plan': None, 'lead_finder': False, 'lead_limit': 0, 'expires_at': None, 'expired': False}

    seed_plan(factory, plan='business', credits=200)
    paid = client.get('/api/entitlements')
    assert paid.json()['lead_finder'] is True
    assert paid.json()['plan'] == 'business'
    assert paid.json()['lead_limit'] == 100


def test_admin_assigned_plan_grants_access_for_a_brand_new_user(env, monkeypatch):
    """Regresja: nowy użytkownik dostawał kredyty, ale plan nie był zapisany."""
    client, _ = env
    monkeypatch.setattr(admin_module, 'ADMIN_HASH', 'b' * 64)
    assigned = client.post(
        '/api/admin/user/plan',
        json={'user_id': 'test-owner', 'plan': 'starter'},
        headers={'X-Admin-Hash': 'b' * 64},
    )
    assert assigned.status_code == 200, assigned.text

    ent = client.get('/api/entitlements').json()
    assert ent['plan'] == 'starter'
    assert ent['lead_finder'] is True
    assert ent['lead_limit'] == 10


def test_admin_expiry_date_ends_the_package(env, monkeypatch, offline_provider):
    client, _ = env
    monkeypatch.setattr(admin_module, 'ADMIN_HASH', 'b' * 64)
    client.post(
        '/api/admin/user/plan',
        json={'user_id': 'test-owner', 'plan': 'agencja', 'expires_at': time.time() - 60},
        headers={'X-Admin-Hash': 'b' * 64},
    )

    ent = client.get('/api/entitlements').json()
    assert ent['expired'] is True
    assert ent['lead_finder'] is False
    assert client.post('/api/leads/search', json=SEARCH_BODY).status_code == 403
    assert offline_provider.call_count == 0


def test_entitlements_endpoint_requires_login(env):
    from main import app
    client, _ = env
    app.dependency_overrides[get_current_user] = lambda: {'id': 'anon', 'is_anon': True}
    try:
        result = client.get('/api/entitlements')
        search = client.post('/api/leads/search', json=SEARCH_BODY)
    finally:
        app.dependency_overrides[get_current_user] = lambda: {'id': 'test-owner', 'is_anon': False, 'provider': 'supabase'}
    assert result.status_code == 401
    assert search.status_code == 401
