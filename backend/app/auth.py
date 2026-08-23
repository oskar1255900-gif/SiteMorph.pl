import os
import time
import requests
from typing import Optional
from fastapi import Header, HTTPException

try:
    from jose import jwt  # python-jose
    HAS_JOSE = True
except ImportError:
    HAS_JOSE = False

SUPABASE_JWKS_URL = os.getenv("SUPABASE_JWKS_URL", "https://hofyecansuojihtkwdli.supabase.co/auth/v1/.well-known/jwks.json")
SUPABASE_JWT_AUD = os.getenv("SUPABASE_JWT_AUD", "authenticated")

_jwks_cache: dict = {"keys": None, "ts": 0}
JWKS_TTL = 600  # 10 min

def _get_jwks():
    now = time.time()
    if _jwks_cache["keys"] is not None and now - _jwks_cache["ts"] < JWKS_TTL:
        return _jwks_cache["keys"]
    try:
        r = requests.get(SUPABASE_JWKS_URL, timeout=10)
        r.raise_for_status()
        data = r.json()
        keys = data.get("keys") or []
        _jwks_cache["keys"] = keys
        _jwks_cache["ts"] = now
        return keys
    except Exception:
        return _jwks_cache["keys"]  # stale if exists

def _verify_supabase_jwt(token: str) -> Optional[dict]:
    if not HAS_JOSE or not token or len(token) < 20:
        return None
    try:
        # Supabase JWT: header contains kid, aud = authenticated, iss = https://<project>.supabase.co/auth/v1
        # jose wymaga klucza; pobieramy JWKS i probujemy kazdym
        jwks = _get_jwks()
        if not jwks:
            return None
        # Sprobuj zdekodowac bez weryfikacji aud najpierw, by wyciagnac kid
        header = jwt.get_unverified_header(token)  # type: ignore
        # Znajdz pasujacy klucz
        kid = header.get("kid")
        key_data = next((k for k in jwks if k.get("kid") == kid), None)
        if not key_data:
            # fallback: probuj wszystkie klucze
            key_data = jwks[0] if jwks else None
        if not key_data:
            return None
        payload = jwt.decode(token, key_data, algorithms=["RS256", "ES256"], audience=SUPABASE_JWT_AUD, options={"verify_aud": False})  # Supabase czasem aud=authenticated
        # alternatywnie weryfikuj iss
        return payload
    except Exception:
        return None

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Tożsamość użytkownika WYŁĄCZNIE ze zweryfikowanego podpisu JWT (Supabase JWKS).
    Żadnych fallbacków na niepodpisane tokeny czy nagłówki X-User-Id — to pozwalało
    podszyć się pod dowolnego użytkownika. Brak/niepoprawny token = anon."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        payload = _verify_supabase_jwt(token)
        if payload:
            user_id = payload.get("sub") or payload.get("user_id") or payload.get("email")
            if user_id:
                return {
                    "id": str(user_id),
                    "email": payload.get("email"),
                    "is_anon": False,
                    "provider": "supabase",
                }
    return {"id": "anon", "is_anon": True, "provider": "anon"}

def require_owner(resource_owner_id: str, current_user: dict):
    if current_user.get("is_anon"):
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    if str(resource_owner_id) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Brak dostępu — zasób należy do innego użytkownika")
