"""Export real compiled runtime fixtures for the offline browser regression suite."""
import argparse
import json
from pathlib import Path
from time import perf_counter
from app.design.validation import validate_spec
from app.design.assets import bind_assets
from app.design.compiler import compile_design
from design_fixtures import fixture, supplied_urls

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='frontend/test-results/design-cases.json')
parser.add_argument('--project-directory', help='Optional directory for exported standalone projects')
args = parser.parse_args()
cases = []
for brand in ['mochi', 'architecture', 'techno', 'law', 'detailing']:
    payload = fixture(brand)
    started = perf_counter()
    spec, warnings = validate_spec(payload, supplied_urls(payload))
    resolved, _, _, report = bind_assets(spec, '')
    files, bindings, _ = compile_design(spec, resolved)
    cases.append({'brand': brand, 'files': files, 'bindings': bindings,
        'designCompileMs': round((perf_counter() - started) * 1000, 2)})
    if args.project_directory:
        for filename, content in files.items():
            destination = Path(args.project_directory) / brand / filename.removeprefix('main/frontend/')
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content, encoding='utf-8')
path = Path(args.output)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(cases, ensure_ascii=False), encoding='utf-8')
print(f'Exported {len(cases)} deterministic design fixtures: {path}')
