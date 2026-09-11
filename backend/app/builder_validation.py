"""Fast deterministic validation; visual quality still needs a rendered preview."""
import json
import posixpath
import re
from typing import Dict, List, Tuple

import tinycss2

ROOT = "main/frontend/"
REQUIRED = {ROOT + p for p in ("package.json", "index.html", "src/main.tsx", "src/index.css", "src/App.tsx")}
RUNTIME_PACKAGES = {"react", "react-dom", "framer-motion", "lucide-react", "clsx"}
IMPORT_RE = re.compile(r'''(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']''')


def validate_project(files: Dict[str, str]) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    missing = REQUIRED - files.keys()
    if missing:
        errors.append("Missing required files: " + ", ".join(sorted(missing)))
    if len(files) > 100 or sum(len(v) for v in files.values()) > 2_000_000:
        errors.append("Project exceeds file/size limits")
    try:
        pkg = json.loads(files.get(ROOT + "package.json", ""))
        deps = pkg.get("dependencies", {})
        if not isinstance(deps, dict) or not {"react", "react-dom"} <= deps.keys():
            errors.append("package.json misses React dependencies")
    except (ValueError, TypeError, AttributeError):
        deps = {}
        errors.append("Invalid package.json")
    components = [p for p in files if p.endswith((".tsx", ".jsx")) and
                  p.startswith((ROOT + "src/components/", ROOT + "src/sections/"))]
    if len(components) < 2:
        errors.append("React project needs meaningful separate components or sections")
    main = files.get(ROOT + "src/main.tsx", "")
    if "index.css" not in main:
        errors.append("main.tsx must import index.css")
    html = files.get(ROOT + "index.html", "")
    if not re.search(r'''id\s*=\s*["']root["']''', html):
        errors.append("index.html must contain #root")
    css = "\n".join(v for k, v in files.items() if k.endswith(".css"))
    rules = tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True)
    if not any(r.type == "qualified-rule" for r in rules):
        errors.append("CSS has no style rules")
    if any(r.type == "error" for r in rules):
        errors.append("CSS syntax error")
    if re.search(r"@(?:tailwind|apply)\b", css):
        errors.append("Tailwind is not compiled in generated projects; use ordinary CSS")
    for path, code in files.items():
        if not path.startswith(ROOT + "src/") or not path.endswith((".ts", ".tsx", ".js", ".jsx")):
            continue
        if re.search(r"<iframe\b|dangerouslySetInnerHTML", code):
            errors.append(f"Embedded HTML/iframe website is unsupported: {path}")
        for spec in IMPORT_RE.findall(code):
            if spec.startswith((".", "@/")):
                base = ROOT + "src/" + spec[2:] if spec.startswith("@/") else posixpath.normpath(posixpath.join(posixpath.dirname(path), spec))
                candidates = [base] + [base + ext for ext in (".tsx", ".ts", ".jsx", ".js", ".css", ".json", "/index.tsx", "/index.ts", "/index.jsx", "/index.js")]
                if not any(p in files for p in candidates):
                    errors.append(f"Missing local import: {spec} in {path}")
            else:
                package = "/".join(spec.split("/")[:2]) if spec.startswith("@") else spec.split("/")[0]
                if package not in RUNTIME_PACKAGES or package not in deps:
                    errors.append(f"Unsupported or undeclared import: {spec}")
        # Catch the common uncompiled utility output without rejecting real CSS class names.
        for names in re.findall(r'''className\s*=\s*["']([^"']+)["']''', code):
            for name in names.split():
                if re.match(r"^(?:sm:|md:|lg:|xl:|(?:text|bg|px|py|gap|grid-cols)-)", name) and name not in css:
                    errors.append(f"Undefined styling class: {name}")
    all_code = "\n".join(files.values())
    if re.search(r"\blorem ipsum\b|\bTODO\b", all_code, re.I):
        errors.append("Placeholder content detected")
    return not errors, list(dict.fromkeys(errors))
