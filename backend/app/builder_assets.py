"""Parallel, cached asset lookup. Missing subjects never fall back to random food."""
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from time import monotonic
from urllib.parse import quote
from urllib.parse import urlsplit
import json
import re

import requests

_cache = {}
_lock = Lock()
_missing_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#eeeae3"/><path d="M440 460l110-110 95 90 65-65 95 125H440z" fill="#c6c0b6"/><text x="600" y="590" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#615c55">Zdjęcie do uzupełnienia</text></svg>'
MISSING_IMAGE = "data:image/svg+xml," + quote(_missing_svg, safe="")


def _search(spec, key):
    query = str(spec.get("query") or spec.get("subject") or "").strip()[:180]
    orientation = spec.get("orientation", "landscape")
    if orientation not in {"landscape", "portrait", "squarish"}:
        orientation = "landscape"
    if not key or not query:
        return []
    negatives = [t.casefold() for t in (spec.get("negativeTerms") or []) if isinstance(t, str)]
    cache_key = (query.casefold(), orientation, str(spec.get("subject", "")).casefold(), tuple(negatives))
    with _lock:
        cached = _cache.get(cache_key)
        if cached and monotonic() - cached[0] < 1800:
            return cached[1]
    try:
        response = requests.get("https://api.unsplash.com/search/photos", params={
            "query": query, "orientation": orientation, "per_page": 8, "content_filter": "high",
        }, headers={"Authorization": f"Client-ID {key}"}, timeout=(3, 6))
        response.raise_for_status()
        results = []
        subject = str(spec.get("subject") or query).casefold()
        # Specific products require positive evidence in searchable metadata.
        specific = [t for t in ("mochi", "matcha", "sakura") if t in subject]
        for item in response.json().get("results", []):
            description = " ".join(str(item.get(k) or "") for k in ("description", "alt_description")).casefold()
            if any(t in description for t in negatives) or (specific and not all(t in description for t in specific)):
                continue
            url = item.get("urls", {}).get("regular", "")
            if not url.startswith("https://images.unsplash.com/"):
                continue
            results.append({"url": url, "query": query, "alt": item.get("alt_description") or "",
                            "credit": item.get("user", {}).get("name", ""),
                            "source": item.get("user", {}).get("links", {}).get("html", ""),
                            "download_location": item.get("links", {}).get("download_location", "")})
        with _lock:
            if len(_cache) >= 128:
                _cache.pop(next(iter(_cache)))
            _cache[cache_key] = (monotonic(), results)
        return results
    except (requests.RequestException, ValueError, AttributeError, TypeError):
        return []


def resolve_assets(files, specs, key):
    used = set(re.findall(r"__SITEMORPH_IMAGE_\d+__", "\n".join(files.values())))
    by_slot = {s.get("placeholder"): s for s in specs if isinstance(s, dict) and s.get("placeholder") in used}
    slots = sorted(used)
    # All lookups start together. No sequential per-photo timeout multiplication.
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {slot: pool.submit(_search, by_slot.get(slot, {}), key) for slot in slots[:8]}
        candidates = {slot: future.result() for slot, future in futures.items()}
    resolved, warnings, seen = [], [], set()
    output = dict(files)
    for slot in slots:
        photo = next((p for p in candidates.get(slot, []) if p["url"] not in seen), None)
        replacement = photo["url"] if photo else MISSING_IMAGE
        if photo:
            seen.add(photo["url"])
            resolved.append({**photo, "placeholder": slot})
        else:
            warnings.append(f"Brak odpowiedniego zdjęcia: {by_slot.get(slot, {}).get('subject') or slot}. Dodaj własne zdjęcie.")
        for path in output:
            output[path] = output[path].replace(slot, replacement)
    return output, resolved, warnings


def add_photo_credits(files, photos):
    """Attribution is ordinary React in the exported project, preview and publish."""
    if not photos:
        return files
    credits = [{"name": p.get("credit") or "Fotograf", "url": p.get("source", "") + "?utm_source=sitemorph&utm_medium=referral"}
               for p in photos if str(p.get("source", "")).startswith("https://unsplash.com/@")]
    if not credits:
        return files
    output = dict(files)
    filename = "main/frontend/src/sitemorph-photo-credits.tsx"
    output[filename] = (
        "import React from 'react';\nimport {createRoot} from 'react-dom/client';\n"
        "const credits = " + json.dumps(credits, ensure_ascii=False) + ";\n"
        "const node=document.createElement('div');document.body.appendChild(node);\n"
        "createRoot(node).render(<aside aria-label='Autorzy zdjęć' style={{padding:'16px 24px',fontSize:12,textAlign:'center',fontFamily:'inherit'}}>"
        "Zdjęcia: {credits.map((c,i)=><React.Fragment key={c.url}>{i>0?', ':''}<a style={{color:'inherit'}} href={c.url} target='_blank' rel='noopener noreferrer'>{c.name}</a></React.Fragment>)}"
        "{' / '}<a style={{color:'inherit'}} href='https://unsplash.com/?utm_source=sitemorph&utm_medium=referral' target='_blank' rel='noopener noreferrer'>Unsplash</a></aside>);\n"
    )
    output["main/frontend/src/main.tsx"] += "\nimport './sitemorph-photo-credits';\n"
    return output


def track_selected_photos(photos, key):
    def track(photo):
        url = photo.get("download_location", "")
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.netloc != "api.unsplash.com" or not re.fullmatch(r"/photos/[a-zA-Z0-9_-]+/download", parsed.path):
            return
        try:
            requests.get(url, headers={"Authorization": f"Client-ID {key}"}, timeout=(2, 3), allow_redirects=False)
        except requests.RequestException:
            pass
    if key and photos:
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(track, photos))
