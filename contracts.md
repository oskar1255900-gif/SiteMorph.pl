# SiteMorph — Builder contract & test report

## Generation contract (v2, single request)

`POST /api/builder/generate` executes exactly **one** DeepSeek V4 Pro request
(`deepseek/deepseek-v4-pro`, ceiling `SITEMORPH_MAX_OUTPUT_TOKENS=32000`).
There is no prompt-parser, brand-strategist, art-director, critic, revision,
continuation or preview model call in the normal path. Transport-level retry
(single, on 5xx/429/timeout) resends the *same* generation and never adds a
design stage.

### Request → response flow

```
user prompt + wizard answers (auto values dropped)
  → one DeepSeek V4 Pro response (system prompt + raw prompt verbatim)
  → extract_json → normalize_files (v1 dict or v2 list, path-safe)
  → validate_project (required files, component structure, no placeholders,
    import↔package coherence, slop heuristics)
  → asset resolution (user assets → curated catalog → Unsplash API; never
    fabricated URLs; unresolved slots removed + warning)
  → response: files + meta + v2 contract fields
```

### Model response shape

```json
{
  "schemaVersion": 2,
  "projectName": "...",
  "designBrief": { "businessFacts": "...", "goal": "...", "audience": "...",
                   "brandCharacter": "...", "creativeConcept": "...",
                   "paletteDirection": "...", "typographyDirection": "...",
                   "shapeLanguage": "...", "composition": "...",
                   "photoStyle": "...", "motion": "...",
                   "userConstraints": "...", "avoidPatterns": "..." },
  "designTokens": { "background": "#...", "surface": "#...", "text": "#...",
                    "mutedText": "#...", "primary": "#...", "secondary": "#...",
                    "accent": "#...", "border": "#...", "displayFont": "...",
                    "bodyFont": "...", "radiusSystem": "...", "motionDurations": "..." },
  "sectionPlan": [ { "id": "...", "purpose": "...", "message": "...",
                     "content": "...", "imageRole": "...", "composition": "...",
                     "cta": "...", "mobile": "..." } ],
  "assetRequests": [ { "id": "...", "placeholder": "__SITEMORPH_IMAGE_1__",
                       "role": "...", "subject": "...", "orientation": "...",
                       "aspect": "...", "lighting": "...", "color": "...",
                       "mood": "...", "query": "English search string" } ],
  "files": { "main/frontend/package.json": "...", "main/frontend/src/App.tsx": "...",
             "main/frontend/src/components/*.tsx": "...", "...": "..." },
  "warnings": ["missing facts to complete"],
  "meta": { "title": "...", "businessName": "...", "niche": "...",
            "headline": "...", "subheadline": "...", "ctaText": "...",
            "designConcept": "...", "palette": ["#..."] }
}
```

The backend keeps the legacy `{files, meta}` keys and adds `schema_version`,
`design_brief`, `design_tokens`, `section_plan`, `asset_requests`,
`generator_warnings` so stored projects stay compatible.

### Preview = publish

Both the in-panel preview and `/api/publish` use the *same* immutable artifact:
the browser-compiled bundle (`esbuild-wasm` → JS + CSS → iframe `srcDoc`).
Publish never re-invokes AI, never recompiles, and never swaps fonts/assets.
The preview iframe is sandboxed with `allow-scripts` only (no same-origin) and
reports mount/runtime state back to the panel via `postMessage`.

## Offline test report

`backend/tests/test_builder_contract.py` — 20 tests, no network, no credits.

| Area | Result |
|---|---|
| normalize_files v1 dict + v2 list, path traversal/absolute rejection | ✅ |
| preview.html never from model (dropped in generate path) | ✅ |
| extract_contract (brief/tokens/sections/assets/warnings), garbage-tolerant | ✅ |
| extract_json: plain / fenced / surrounded text / truncated raises | ✅ |
| validate: good multi-component project passes | ✅ |
| validate: monolithic App.tsx (no components) fails | ✅ |
| validate: lorem-ipsum placeholder blocks | ✅ |
| validate: missing required files blocks | ✅ |
| single model call on success (exactly 1) | ✅ |
| truncated JSON → parse error, no hidden second call | ✅ |
| asset fallback: no key → curated known-good Unsplash CDN URL, no fabricated URLs | ✅ |

Run: `cd backend && python -m pytest tests/ -q`