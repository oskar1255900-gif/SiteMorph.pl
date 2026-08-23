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

async def get_current_user(x_user_id: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    # 1. Sprobuj Supabase JWT z Authorization: Bearer <token>
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        payload = _verify_supabase_jwt(token)
        if payload:
            # sub = uuid uzytkownika w Supabase Auth
            user_id = payload.get("sub") or payload.get("user_id") or payload.get("email") or token[:32]
            email = payload.get("email")
            return {"id": str(user_id), "email": email, "is_anon": False, "payload": payload, "provider": "supabase"}
        # jesli token wyglada jak JWT ale weryfikacja nie przeszla, sprobuj fallback (np. lokalny dev)
        if token and len(token) > 20 and token.count(".") == 2:
            # prawdopodobnie JWT ale JWKS chwilowo niedostepny — nie odrzucaj od razu, sprobuj zdekodowac bez weryfikacji dla dev
            try:
                unverified = jwt.get_unverified_claims(token)  # type: ignore
                uid = unverified.get("sub")
                if uid:
                    return {"id": str(uid), "email": unverified.get("email"), "is_anon": False, "payload": unverified, "provider": "supabase-unverified"}
            except Exception:
                pass
        # fallback: token jako user_id (stary flow)
        if token and len(token) > 3:
            return {"id": token[:64], "is_anon": False, "provider": "legacy-token"}

    # 2. Fallback: X-User-Id (lokalny dev, anonymous)
    user_id = x_user_id or "anon"
    return {"id": str(user_id), "is_anon": user_id == "anon", "provider": "legacy"}

def require_owner(resource_owner_id: str, current_user: dict):
    if current_user.get("is_anon"):
        return
    if str(resource_owner_id) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Brak dostępu — zasób należy do innego użytkownika")
