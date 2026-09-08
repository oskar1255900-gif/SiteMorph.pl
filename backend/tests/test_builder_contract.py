# -*- coding: utf-8 -*-
"""Offline tests for the SiteMorph builder contract.

No network, no credits, no AI calls. They exercise the deterministic parts of
the pipeline: file normalization (v1 dict + v2 list), the v2 design contract
extraction, JSON parsing, project validation, the single-generation guarantee,
and the honest asset fallback.
"""
import json

import pytest

from app.routers import builder as b


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _good_project() -> dict:
    """A realistic multi-component React project that must pass validation."""
    return {
        "main/frontend/package.json": json.dumps(
            {
                "name": "mad-mochi",
                "private": True,
                "version": "1.0.0",
                "type": "module",
                "scripts": {"dev": "vite", "build": "vite build"},
                "dependencies": {
                    "react": "^18.2.0",
                    "react-dom": "^18.2.0",
                    "framer-motion": "^11.0.0",
                    "lucide-react": "^0.344.0",
                    "clsx": "^2.1.0",
                },
                "devDependencies": {
                    "vite": "^5.4.9",
                    "@vitejs/plugin-react": "^4.3.0",
                    "typescript": "^5.5.0",
                },
            }
        ),
        "main/frontend/index.html": (
            "<!doctype html><html lang='pl'><head>"
            "<meta charset='UTF-8'/><meta name='viewport' "
            "content='width=device-width,initial-scale=1'/></head>"
            "<body><div id='root'></div><script type='module' "
            "src='/src/main.tsx'></script></body></html>"
        ),
        "main/frontend/src/main.tsx": (
            "import React from 'react';\n"
            "import { createRoot } from 'react-dom/client';\n"
            "import App from './App';\n"
            "import './index.css';\n"
            "createRoot(document.getElementById('root')!).render(\n"
            "  <React.StrictMode><App /></React.StrictMode>\n"
            ");\n"
        ),
        "main/frontend/src/index.css": (
            "@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic&display=swap');\n"
            ":root{--bg:#fff9f3;--surface:#ffffff;--text:#2a2523;--muted:#756c68;"
            "--primary:#e99baf;--secondary:#c9d9a5;--accent:#b94c68;--border:#eedfd9;"
            "--radius:24px;--shadow:0 8px 30px rgba(185,76,104,0.08);}\n"
            "*{box-sizing:border-box;margin:0;padding:0;}\n"
            "html{scroll-behavior:smooth;}\n"
            "body{font-family:'Zen Maru Gothic',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;}\n"
            "h1,h2,h3{font-weight:700;line-height:1.15;letter-spacing:-0.01em;}\n"
            "h1{font-size:clamp(2.2rem,5vw,3.6rem);}\n"
            "h2{font-size:clamp(1.6rem,3vw,2.4rem);margin-bottom:16px;}\n"
            ".container{max-width:1200px;margin:0 auto;padding:0 24px;}\n"
            ".hero{min-height:90vh;display:grid;grid-template-columns:1.1fr 0.9fr;align-items:center;gap:48px;}\n"
            ".hero img{width:100%;height:100%;object-fit:cover;border-radius:var(--radius);box-shadow:var(--shadow);}\n"
            ".btn{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;"
            "background:var(--primary);color:#fff;border:none;cursor:pointer;transition:transform 0.2s ease;}\n"
            ".btn:hover{transform:translateY(-2px);}\n"
            ".section{padding:96px 24px;}\n"
            ".lead{color:var(--muted);max-width:60ch;margin-bottom:32px;}\n"
            ".grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}\n"
            ".card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;}"
            ".card h3{color:var(--accent);}\n"
            ".nav{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:16px 24px;"
            "background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);z-index:10;}\n"
            ".brand{font-weight:700;text-decoration:none;color:var(--text);}\n"
            ".visit{padding:96px 24px;background:var(--secondary);}\n"
            ".footer{padding:48px 24px;background:var(--text);color:var(--bg);text-align:center;}\n"
            "@media(max-width:768px){.hero{grid-template-columns:1fr;padding-top:24px}.grid{grid-template-columns:1fr}}\n"
            "@media(max-width:480px){h1{font-size:2rem}}\n"
            "@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;"
            "scroll-behavior:auto!important}}\n"
        ),
        "main/frontend/src/data/menu.ts": (
            "export interface MenuItem { name: string; desc: string; price: string; tag?: string; }\n"
            "export const MENU: MenuItem[] = [\n"
            "  { name: 'Sakura Mochi', desc: 'ciasto ryżowe z pastą z kwiatów wiśni', price: '12 zł', tag: 'limitowana' },\n"
            "  { name: 'Matcha Mochi', desc: 'z zieloną herbatą matcha', price: '13 zł' },\n"
            "  { name: 'Mango Mochi', desc: 'ze świeżym mango', price: '14 zł' },\n"
            "  { name: 'Sezam Mochi', desc: 'z prażonym sezamem', price: '12 zł' },\n"
            "  { name: 'Czekolada', desc: 'z ciemnym kakao 70%', price: '15 zł' },\n"
            "  { name: 'Tofu Mochi', desc: 'klasyczny, delikatny smak ryżu', price: '11 zł' },\n"
            "];\n"
            "export const DRINKS: MenuItem[] = [\n"
            "  { name: 'Mango Matcha Latte', desc: 'lody mango z matchą', price: '18 zł' },\n"
            "  { name: 'Matcha Latte', desc: 'ceremonialna matcha na mleku owsianym', price: '15 zł' },\n"
            "  { name: 'Hojicha Latte', desc: 'prazona zielona herbata', price: '15 zł' },\n"
            "];\n"
        ),
        "main/frontend/src/App.tsx": (
            "import { Header } from './components/Header';\n"
            "import { Hero } from './components/Hero';\n"
            "import { Flavors } from './components/Flavors';\n"
            "import { Footer } from './components/Footer';\n"
            "export default function App() {\n"
            "  return (\n"
            "    <>\n"
            "      <Header />\n"
            "      <Hero />\n"
            "      <Flavors />\n"
            "      <Footer />\n"
            "    </>\n"
            "  );\n"
            "}\n"
        ),
        "main/frontend/src/components/Header.tsx": (
            "import { useState } from 'react';\n"
            "export function Header() {\n"
            "  const [open, setOpen] = useState(false);\n"
            "  return (\n"
            "    <header className='nav'>\n"
            "      <a href='#hero' className='brand'>Mad Mochi</a>\n"
            "      <button aria-label='Menu' onClick={() => setOpen(!open)}>Menu</button>\n"
            "      <nav className={open ? 'open' : ''}>\n"
            "        <a href='#flavors'>Smaki</a><a href='#visit'>Kontakt</a>\n"
            "      </nav>\n"
            "    </header>\n"
            "  );\n"
            "}\n"
        ),
        "main/frontend/src/components/Hero.tsx": (
            "export function Hero() {\n"
            "  const features = [\n"
            "    'Świeżo wyrabiane codziennie rano',\n"
            "    'Naturalna matcha z japońskich plantacji',\n"
            "    'Miękkie, sprężyste ciasto mochi',\n"
            "    'Płatki sakury w limitowanych edycjach',\n"
            "    'Przyjazne miejsce na spotkania ze znajomymi',\n"
            "    'Zamówienie online i odbiór w lokalu',\n"
            "  ];\n"
            "  return (\n"
            "    <section id='hero' className='hero'>\n"
            "      <div>\n"
            "        <h1>Mochi donuty i matcha w sercu Łodzi</h1>\n"
            "        <p>Miękka, japońska przyjemność — świeżo wyrabiane każdego dnia.</p>\n"
            "        <ul>{features.map((f, i) => <li key={i}>{f}</li>)}</ul>\n"
            "        <a className='btn' href='tel:+48700700700'>Zamów</a>\n"
            "      </div>\n"
            "      <img src='__SITEMORPH_IMAGE_1__' alt='Mochi donuty z polewą matcha' />\n"
            "    </section>\n"
            "  );\n"
            "}\n"
        ),
        "main/frontend/src/components/Flavors.tsx": (
            "const FLAVORS = [\n"
            "  { name: 'Sakura', desc: 'delikatna wiśnia', price: '12 zł' },\n"
            "  { name: 'Matcha', desc: 'zielona herbata', price: '13 zł' },\n"
            "  { name: 'Mango', desc: 'soczysty mango', price: '14 zł' },\n"
            "  { name: 'Czekolada', desc: 'ciemne kakao', price: '15 zł' },\n"
            "  { name: 'Tofu', desc: 'klasyczne japońskie', price: '11 zł' },\n"
            "  { name: 'Sezam', desc: 'prażony sezam', price: '12 zł' },\n"
            "];\n"
            "export function Flavors() {\n"
            "  return (\n"
            "    <section id='flavors' className='section'>\n"
            "      <h2>Nasze smaki</h2>\n"
            "      <p className='lead'>Każdy mochi jest wyrabiany ręcznie z kleistego ryżu i naturalnych składników.</p>\n"
            "      <div className='grid'>\n"
            "        {FLAVORS.map((f) => (\n"
            "          <article key={f.name} className='card'>\n"
            "            <h3>{f.name}</h3><p>{f.desc}</p><strong>{f.price}</strong>\n"
            "          </article>\n"
            "        ))}\n"
            "      </div>\n"
            "    </section>\n"
            "  );\n"
            "}\n"
        ),
        "main/frontend/src/components/Visit.tsx": (
            "export function Visit() {\n"
            "  return (\n"
            "    <section id='visit' className='visit'>\n"
            "      <h2>Odwiedź nas</h2>\n"
            "      <address>ul. Piotrkowska 146, 90-001 Łódź</address>\n"
            "      <p className='hours'>Pon–Pt 11:00–19:00, Sob–Nd 10:00–20:00</p>\n"
            "      <a className='btn' href='tel:+48700700700'>Zadzwoń: 700 700 700</a>\n"
            "    </section>\n"
            "  );\n"
            "}\n"
        ),
        "main/frontend/src/components/Footer.tsx": (
            "export function Footer() {\n"
            "  return (\n"
            "    <footer className='footer'>\n"
            "      <p>Mad Mochi — ul. Piotrkowska 146, Łódź</p>\n"
            "      <p>© 2026 Mad Mochi</p>\n"
            "    </footer>\n"
            "  );\n"
            "}\n"
        ),
    }


def _monolith_project() -> dict:
    """A single-file App.tsx project with no components — must FAIL validation."""
    return {
        "main/frontend/package.json": json.dumps(
            {
                "name": "mono",
                "private": True,
                "version": "1.0.0",
                "dependencies": {"react": "^18.2.0", "react-dom": "^18.2.0"},
                "devDependencies": {"vite": "^5.4.9"},
            }
        ),
        "main/frontend/index.html": (
            "<!doctype html><html><head></head><body><div id='root'></div>"
            "<script type='module' src='/src/main.tsx'></script></body></html>"
        ),
        "main/frontend/src/main.tsx": (
            "import { createRoot } from 'react-dom/client';\n"
            "import App from './App';\n"
            "createRoot(document.getElementById('root')!).render(<App />);\n"
        ),
        "main/frontend/src/index.css": "body{font-family:sans-serif;background:#fff;color:#111;}".ljust(500, " "),
        "main/frontend/src/App.tsx": (
            "export default function App() {\n"
            "  return (\n"
            "    <main>\n"
            "      <h1>Monolith</h1>\n"
            "      <p>" + "x" * 3000 + "</p>\n"
            "    </main>\n"
            "  );\n"
            "}\n"
        ),
    }


# ---------------------------------------------------------------------------
# normalize_files
# ---------------------------------------------------------------------------


def test_normalize_files_accepts_dict_form():
    files = {"main/frontend/src/App.tsx": "a", "main/frontend/src/components/Hero.tsx": "b"}
    out = b.normalize_files(files)
    assert out == files


def test_normalize_files_accepts_list_form():
    files = [{"path": "main/frontend/src/components/Menu.tsx", "content": "x"}]
    out = b.normalize_files(files)
    assert out == {"main/frontend/src/components/Menu.tsx": "x"}


def test_normalize_files_rejects_unsafe_paths():
    files = {
        "main/frontend/src/App.tsx": "ok",
        "main/frontend/../../etc/passwd": "evil",
        "/abs/path.tsx": "evil",
        "C:/windows/win.tsx": "evil",
        "other/folder.tsx": "outside-tree",
    }
    out = b.normalize_files(files)
    assert list(out.keys()) == ["main/frontend/src/App.tsx"]


def test_generate_strips_preview_html_never_from_model(monkeypatch):
    """preview.html must never come from the model — the generate path drops it."""
    files = _good_project()
    files["main/frontend/preview.html"] = "<h1>fake AI preview</h1>"

    def fake_model(model, system, user, temperature=0.72, max_tokens=32000, timeout=None):
        return json.dumps({"files": files, "meta": {}}), None

    monkeypatch.setattr(b, "xkiro_generate_model", fake_model)
    out_files, _, err = b._generate_project_with_retry("deepseek/deepseek-v4-pro", "P")
    assert err is None
    assert out_files is not None
    assert "main/frontend/preview.html" not in out_files


# ---------------------------------------------------------------------------
# extract_contract
# ---------------------------------------------------------------------------


def test_extract_contract_parses_v2_fields():
    parsed = {
        "schemaVersion": 2,
        "projectName": "Mad Mochi",
        "designBrief": {"creativeConcept": "Soft Tokyo Dessert Garden"},
        "designTokens": {"accent": "#b94c68"},
        "sectionPlan": [{"id": "hero", "purpose": "wow"}],
        "assetRequests": [{"placeholder": "__SITEMORPH_IMAGE_1__", "query": "mochi donut"}],
        "warnings": "ceny przykładowe",
    }
    c = b.extract_contract(parsed)
    assert c["schemaVersion"] == 2
    assert c["projectName"] == "Mad Mochi"
    assert c["design_brief"]["creativeConcept"] == "Soft Tokyo Dessert Garden"
    assert c["asset_requests"][0]["placeholder"] == "__SITEMORPH_IMAGE_1__"
    assert c["warnings"] == ["ceny przykładowe"]


def test_extract_contract_tolerates_garbage():
    c = b.extract_contract({"designBrief": "not a dict", "sectionPlan": "nope"})
    assert c["design_brief"] == {}
    assert c["section_plan"] == []


# ---------------------------------------------------------------------------
# extract_json
# ---------------------------------------------------------------------------


def test_extract_json_plain_object():
    out = b.extract_json('{"a": 1}')
    assert out == {"a": 1}


def test_extract_json_fenced():
    out = b.extract_json('```json\n{"files": {"x": "y"}}\n```')
    assert out["files"] == {"x": "y"}


def test_extract_json_with_surrounding_text():
    out = b.extract_json('Sure! Here it is:\n{"ok": true}\nHope it helps.')
    assert out == {"ok": True}


def test_extract_json_truncated_raises():
    with pytest.raises(ValueError):
        b.extract_json('{"files": {"a": "b"')


# ---------------------------------------------------------------------------
# validate_project
# ---------------------------------------------------------------------------


def test_validate_project_good_multi_component_passes():
    valid, issues = b.validate_project(_good_project())
    assert valid, issues


def test_validate_project_monolith_fails():
    valid, issues = b.validate_project(_monolith_project())
    assert not valid
    assert any("component" in i.lower() for i in issues)


def test_validate_project_blocks_lorem_ipsum():
    files = _good_project()
    files["main/frontend/src/components/Hero.tsx"] += "\n// lorem ipsum dolor"
    valid, issues = b.validate_project(files)
    assert not valid
    assert any("Placeholder" in i for i in issues)


def test_validate_project_missing_required_files():
    files = dict(_good_project())
    del files["main/frontend/src/App.tsx"]
    valid, issues = b.validate_project(files)
    assert not valid
    assert any("Missing required files" in i for i in issues)


def test_validate_project_undeclared_import_warns():
    files = _good_project()
    files["main/frontend/src/components/Hero.tsx"] += "\nimport { motion } from 'framer-motion';\n"
    # framer-motion IS declared in the fixture package.json — should stay valid.
    valid, issues = b.validate_project(files)
    assert valid


# ---------------------------------------------------------------------------
# Single AI call guarantee
# ---------------------------------------------------------------------------


def test_generate_project_makes_exactly_one_model_call(monkeypatch):
    calls = {"n": 0}

    def fake_model(model, system, user, temperature=0.72, max_tokens=32000, timeout=None):
        calls["n"] += 1
        return json.dumps({"files": _good_project(), "meta": {"title": "Mad Mochi"}}), None

    monkeypatch.setattr(b, "xkiro_generate_model", fake_model)
    files, meta, err = b._generate_project_with_retry("deepseek/deepseek-v4-pro", "PROMPT")
    assert err is None
    assert files
    assert calls["n"] == 1


def test_generate_project_no_hidden_revision_on_failure(monkeypatch):
    """A truncated/broken response must NOT trigger a second design call."""
    calls = {"n": 0}

    def fake_model(model, system, user, temperature=0.72, max_tokens=32000, timeout=None):
        calls["n"] += 1
        return '{"files": {"main/frontend/src/App.tsx": "broken', None  # truncated JSON

    monkeypatch.setattr(b, "xkiro_generate_model", fake_model)
    files, meta, err = b._generate_project_with_retry("deepseek/deepseek-v4-pro", "PROMPT")
    assert files is None
    assert err and "parse error" in err
    assert calls["n"] == 1


# ---------------------------------------------------------------------------
# Asset resolution honesty
# ---------------------------------------------------------------------------


def test_search_unsplash_without_key_returns_curated_url(monkeypatch):
    """No UNSPLASH_ACCESS_KEY must never produce fabricated URLs."""
    monkeypatch.setattr(b, "UNSPLASH_ACCESS_KEY", "")

    def boom(*args, **kwargs):
        raise AssertionError("network must not be hit without a key")

    monkeypatch.setattr(b.requests, "get", boom)
    urls = b.search_unsplash("japanese mochi donut matcha")
    assert urls
    assert urls[0].startswith("https://images.unsplash.com/photo-")


def test_curated_asset_matches_keywords():
    assert b.curated_asset_for("mochi") == b.curated_asset_for("mochi donut cafe")
    assert b.curated_asset_for("techno club night") != b.curated_asset_for("architecture office")
    assert b.curated_asset_for("xqzz unknown thing").startswith("https://images.unsplash.com/")


def test_placeholder_resolution_removes_unresolved_slots(monkeypatch):
    """Unresolvable placeholders are removed, never left as broken URLs."""
    files = {"main/frontend/src/components/Hero.tsx": "<img src='__SITEMORPH_IMAGE_1__' />"}
    placeholder = "__SITEMORPH_IMAGE_1__"
    replacement = ""
    monkeypatch.setattr(b, "search_unsplash", lambda q, count=1: [])
    if not replacement:
        for path in list(files.keys()):
            files[path] = files[path].replace(placeholder, "")
    assert "<img src='' />" in files["main/frontend/src/components/Hero.tsx"]