"""Deterministic Spec V2 → portable component-based React. No model calls."""
import html
import json
from pathlib import Path
from .tokens import resolve_tokens

ROOT = 'main/frontend/'
RUNTIME = Path(__file__).resolve().parent.parent / 'design_runtime'
VERSION = 'sitemorph-design-compiler-2'


def compile_design(spec, resolved):
    variables, fonts, warnings = resolve_tokens(spec)
    sections = resolved['pagePlan']['sections']
    forms = {form.id: form.model_dump() for form in spec.interactions.forms}
    for section in sections:
        props = section['props']
        props['sectionId'] = section['id']
        if props.get('formId'):
            props['form'] = forms[props.pop('formId')]
        if section['role'] == 'hero':
            props['reveal'] = spec.tokens.motionStrategy.heroReveal
            props['category'] = spec.businessBrief.category
    classes = ' '.join(['sm-site', 'sm-hover--' + spec.tokens.motionStrategy.hoverMode,
        'sm-image-treatment--' + spec.tokens.colorStrategy.imageTreatment,
        'sm-mask--' + spec.tokens.shapeStrategy.imageMaskMode,
        'sm-divider--' + spec.tokens.shapeStrategy.dividerMode,
        'sm-mobile-media-first' if spec.mobile.heroTextOrder == 'after-media' else ''])
    package = {'name': 'sitemorph-generated-site', 'version': '1.0.0', 'private': True, 'type': 'module',
        'scripts': {'dev': 'vite --host 0.0.0.0', 'build': 'vite build', 'preview': 'vite preview'},
        'dependencies': {'react': '18.2.0', 'react-dom': '18.2.0'},
        'devDependencies': {'vite': '5.4.21', 'typescript': '5.9.3', '@types/react': '18.3.27', '@types/react-dom': '18.3.7'}}
    files = {ROOT + 'package.json': json.dumps(package, indent=2),
        ROOT + 'index.html': f'<!doctype html>\n<html lang="{html.escape(spec.meta.locale)}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{html.escape(spec.businessBrief.name)}</title><meta name="description" content="{html.escape(spec.businessBrief.positioning, quote=True)}"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link rel="stylesheet" href="{html.escape(fonts["stylesheet"], quote=True)}"/></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
        ROOT + 'src/main.tsx': "import React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport App from './App';\nimport './index.css';\ncreateRoot(document.getElementById('root')!).render(<App/>);\n",
        ROOT + 'src/index.css': "@import './runtime/base.css';\n:root{\n" + '\n'.join(f'  --{key}:{value};' for key, value in variables.items()) + '\n}\n',
        ROOT + 'src/data/site.json': json.dumps(resolved, ensure_ascii=False, separators=(',', ':')),
        ROOT + 'tsconfig.json': json.dumps({'compilerOptions': {'target': 'ES2020', 'lib': ['ES2020', 'DOM', 'DOM.Iterable'], 'module': 'ESNext', 'moduleResolution': 'Bundler', 'jsx': 'react-jsx', 'resolveJsonModule': True, 'esModuleInterop': True, 'strict': True, 'skipLibCheck': True, 'noEmit': True}, 'include': ['src']}, indent=2),
    }
    for path in sorted(RUNTIME.iterdir()):
        if path.suffix in {'.tsx', '.ts', '.css'}:
            files[ROOT + 'src/runtime/' + path.name] = path.read_text()
    imports, components = [], []
    for index, section in enumerate(sections):
        name = 'Section' + str(index + 1)
        imports.append(f"import {name} from './sections/{section['id']}';")
        section_classes = ' '.join(['sm-section', 'sm-section--' + section['rhythm']['density'],
            'sm-section--' + section['role'], 'sm-tone--' + section['tone'], 'sm-container--' + section['container']])
        # One hero gesture + one chosen supporting reveal, never fade-up on every block.
        reveal = spec.tokens.motionStrategy.sectionReveal if index == 1 else 'none'
        components.append(f'<{name}/>')
        files[ROOT + 'src/sections/' + section['id'] + '.tsx'] = (
            f"import React from 'react';\nimport {{{section['primitive']}}} from '../runtime';\nimport data from '../data/site.json';\n"
            f"export default function {name}() {{ return <section id={json.dumps(section['id'])} className={json.dumps(section_classes)} data-reveal={json.dumps(reveal)}><div className=\"sm-section-inner\"><{section['primitive']} {{...data.pagePlan.sections[{index}].props}}/></div></section>; }}\n")
    files[ROOT + 'src/App.tsx'] = ("import React from 'react';\nimport {MobileNav, Footer} from './runtime/Navigation';\nimport {usePageMotion} from './runtime/Motion';\nimport type {SiteConfig} from './runtime/types';\nimport data from './data/site.json';\n" + '\n'.join(imports) +
        '\nconst config = data as unknown as SiteConfig;\nexport default function App(){\n  usePageMotion(config);\n  return <div className=' + json.dumps(classes) + '><MobileNav config={config}/><main>' + ''.join(components) + '</main><Footer config={config}/></div>;\n}\n')
    bindings = {'concept': spec.creative.conceptTitle, 'hero_family': resolved['creative']['heroFamily'],
        'hero_primitive': sections[0]['primitive'], 'fonts': [fonts['display']['family'], fonts['text']['family']],
        'motion_preset': spec.tokens.motionStrategy.presetId, 'css_variables': variables,
        'section_primitives': [s['primitive'] for s in sections], 'runtime_version': VERSION}
    return files, bindings, warnings
