"""Saved source + compiled artifact form one immutable publication snapshot."""
import hashlib
import json
from fastapi import HTTPException
from fastapi.responses import HTMLResponse


def require_user(user):
    if not user.get("id") or user.get("is_anon") or user["id"] == "anon":
        raise HTTPException(status_code=401, detail="Wymagane zalogowanie")
    return user


def source_hash(files):
    canonical = json.dumps(files, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def validate_content(content):
    files = content.get("files")
    if not isinstance(files, dict) or not files or len(files) > 100:
        raise HTTPException(status_code=422, detail="Brak plików projektu")
    if any(not isinstance(k, str) or not isinstance(v, str) or not k.startswith("main/frontend/") or ".." in k or "\\" in k for k, v in files.items()):
        raise HTTPException(status_code=422, detail="Niepoprawne pliki projektu")
    if len(json.dumps(content)) > 8_000_000:
        raise HTTPException(status_code=413, detail="Projekt jest zbyt duży")
    artifact = content.get("artifact")
    if artifact is not None:
        if not isinstance(artifact, dict) or artifact.get("sourceHash") != source_hash(files):
            raise HTTPException(status_code=409, detail="Podgląd pochodzi z innej wersji plików. Skompiluj ponownie.")
        if artifact.get("compilerVersion") != "sitemorph-esbuild-3" or not artifact.get("buildId"):
            raise HTTPException(status_code=409, detail="Wymagana aktualna kompilacja podglądu")
        html = artifact.get("html")
        if not isinstance(html, str) or len(html) < 100 or len(html) > 5_000_000:
            raise HTTPException(status_code=422, detail="Brak poprawnego podglądu HTML")
    return content


def published_response(html, status_code=200):
    # Opaque origin prevents generated scripts from reading the builder's cookies
    # and localStorage even when /p is served under the application's domain.
    return HTMLResponse(html, status_code=status_code, headers={
        "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-modals; default-src 'none'; script-src 'unsafe-inline' https://esm.sh; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src https: http: data: blob:; media-src https: data:; connect-src https://esm.sh; base-uri 'none'; form-action https:; object-src 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    })
