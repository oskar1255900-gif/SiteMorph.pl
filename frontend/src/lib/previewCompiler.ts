import * as esbuild from 'esbuild-wasm';
import wasmURL from 'esbuild-wasm/esbuild.wasm?url';
import type { PreviewArtifact } from '../types';

export const COMPILER_VERSION = 'sitemorph-esbuild-3';
let initialization: Promise<void> | null = null;
const cache = new Map<string, PreviewArtifact>();
export function warmPreviewCompiler() {
  if (!initialization) initialization = esbuild.initialize({ wasmURL, worker: true }).catch(error => {
    initialization = null;
    throw error;
  });
  return initialization;
}

const imports: Record<string, string> = {
  react: 'https://esm.sh/react@18.2.0',
  'react/jsx-runtime': 'https://esm.sh/react@18.2.0/jsx-runtime',
  'react/jsx-dev-runtime': 'https://esm.sh/react@18.2.0/jsx-dev-runtime',
  'react-dom': 'https://esm.sh/react-dom@18.2.0?external=react',
  'react-dom/client': 'https://esm.sh/react-dom@18.2.0/client?external=react',
  'framer-motion': 'https://esm.sh/framer-motion@11.11.17?external=react,react-dom',
  'lucide-react': 'https://esm.sh/lucide-react@0.344.0?external=react',
  clsx: 'https://esm.sh/clsx@2.1.1',
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const script = (s: string) => s.replace(/<\/script/gi, '<\\/script');
const style = (s: string) => s.replace(/<\/style/gi, '<\\/style');

export async function sourceHash(files: Record<string, string>) {
  const canonical = JSON.stringify(Object.fromEntries(Object.keys(files).sort().map(k => [k, files[k]])));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function normalize(path: string) {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') { if (!parts.length) throw new Error('Import poza projektem'); parts.pop(); }
    else if (part && part !== '.') parts.push(part);
  }
  return '/' + parts.join('/');
}

function headFrom(html: string, assetBase: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const head = [`<title>${esc(doc.title || 'Strona')}</title>`];
  for (const tag of doc.head.querySelectorAll('meta[name="description"], meta[name="theme-color"], link, style')) {
    if (tag.tagName === 'META') head.push(`<meta name="${esc(tag.getAttribute('name') || '')}" content="${esc(tag.getAttribute('content') || '')}">`);
    if (tag.tagName === 'STYLE') head.push(`<style>${style(tag.textContent || '')}</style>`);
    if (tag.tagName === 'LINK') {
      const rel = tag.getAttribute('rel') || '';
      const href = tag.getAttribute('href') || '';
      // Local project CSS comes through the module graph, never an unbuilt URL.
      if (['stylesheet', 'preconnect'].includes(rel) && /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)(\/|$)/.test(href)) {
        head.push(`<link rel="${rel}" href="${esc(href)}"${tag.hasAttribute('crossorigin') ? ' crossorigin="anonymous"' : ''}>`);
      } else if (rel === 'icon' && /^(https:\/\/|data:image\/|\/api\/)/.test(href)) {
        head.push(`<link rel="icon" href="${esc(href.startsWith('/') ? new URL(href, assetBase).href : href)}">`);
      }
    }
  }
  return { html: head.join('\n'), lang: doc.documentElement.lang || 'pl' };
}

export async function compileReactProject(files: Record<string, string>, assetBase = window.location.origin): Promise<PreviewArtifact> {
  const start = performance.now();
  const hash = await sourceHash(files);
  const cacheKey = `${COMPILER_VERSION}:${assetBase}:${hash}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  await warmPreviewCompiler();
  const virtual: Record<string, string> = {};
  for (const [path, contents] of Object.entries(files)) {
    if (!path.startsWith('main/frontend/') || path.includes('..') || path.includes('\\')) throw new Error(`Niedozwolona ścieżka: ${path}`);
    virtual['/' + path.slice('main/frontend/'.length)] = contents;
  }
  if (!virtual['/src/main.tsx']) throw new Error('Brak src/main.tsx');
  const usedImports = new Set<string>();
  const plugin: esbuild.Plugin = {
    name: 'sitemorph-project',
    setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (args.kind === 'url-token' && /^(https?:|data:|blob:)/.test(args.path)) return { path: args.path, external: true };
        if (args.kind === 'import-rule' && /^https:\/\/fonts\.googleapis\.com\//.test(args.path)) return { path: args.path, external: true };
        if (args.kind === 'url-token' && args.path.startsWith('/api/')) return { path: new URL(args.path, assetBase).href, external: true };
        if (args.path in imports) { usedImports.add(args.path); return { path: args.path, external: true }; }
        if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { errors: [{ text: `Nieobsługiwany import: ${args.path}` }] };
        const base = normalize(args.path.startsWith('@/') ? '/src/' + args.path.slice(2) : args.path.startsWith('/') ? args.path : args.importer.slice(0, args.importer.lastIndexOf('/') + 1) + args.path);
        const path = ['', '.tsx', '.ts', '.jsx', '.js', '.css', '.json', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'].map(ext => base + ext).find(p => p in virtual);
        return path ? { path, namespace: 'project' } : { errors: [{ text: `Brak pliku: ${args.path} (${args.importer})` }] };
      });
      build.onLoad({ filter: /.*/, namespace: 'project' }, args => {
        const ext = args.path.split('.').pop() || '';
        const loader: esbuild.Loader = args.path.endsWith('.module.css') ? 'local-css' : ext === 'svg' ? 'dataurl' : ['tsx', 'ts', 'jsx', 'js', 'css', 'json'].includes(ext) ? ext as esbuild.Loader : 'text';
        // Uploaded assets need absolute URLs in opaque-origin srcDoc and on custom domains.
        const contents = virtual[args.path].replace(/(["'`])(\/api\/builder\/asset\/[a-zA-Z0-9_-]+)\1/g, (_m, q, url) => q + new URL(url, assetBase).href + q);
        return { contents, loader, resolveDir: '/' };
      });
    },
  };
  const result = await esbuild.build({ entryPoints: ['/src/main.tsx'], bundle: true, write: false,
    outdir: '/out', entryNames: 'bundle', format: 'esm', target: 'es2020', jsx: 'automatic',
    platform: 'browser', plugins: [plugin], logLevel: 'silent', minify: true });
  const js = result.outputFiles?.find(f => f.path.endsWith('.js'))?.text;
  const css = result.outputFiles?.find(f => f.path.endsWith('.css'))?.text || '';
  if (!js || !css.trim()) throw new Error('Projekt musi zawierać działający JavaScript i zaimportowany CSS.');
  const cssWarnings = result.warnings.filter(w => /css|@import|declaration|selector/i.test(w.text));
  if (cssWarnings.length) throw new Error('Niepoprawne style: ' + cssWarnings.map(w => w.text).join('; '));
  const head = headFrom(virtual['/index.html'] || '', assetBase);
  const buildId = crypto.randomUUID();
  // Run before the module. Observe actual React rendering, not an arbitrary 1.6s guess.
  const observer = `(function(){
    var failed=false, sent=false;
    function tell(m){if(parent!==window)parent.postMessage({__sm:'sitemorph',buildId:${JSON.stringify(buildId)},m:m},'*')}
    window.addEventListener('error',function(e){failed=true;tell({t:'runtime-error',message:e.message||'Nie udało się załadować strony'})});
    window.addEventListener('unhandledrejection',function(e){failed=true;tell({t:'runtime-error',message:String(e.reason&&e.reason.message||e.reason||'Błąd strony')})});
    var root=document.getElementById('root');
    var timer=setTimeout(function(){if(!sent)tell({t:'runtime-error',message:'Strona nie uruchomiła się w ciągu 30 sekund. Sprawdź połączenie i zależności.'})},30000);
    function inspect(){if(sent||failed||!root||!root.childElementCount)return;sent=true;clearTimeout(timer);observer.disconnect();
      Promise.race([document.fonts.ready,new Promise(function(r){setTimeout(r,8000)})]).then(function(){requestAnimationFrame(function(){
        if(failed)return;var d=document.documentElement;tell({t:'mounted',ok:true});
        if(d.scrollWidth>d.clientWidth+2)tell({t:'overflow',w:d.scrollWidth,c:d.clientWidth});
      })});}
    var observer=new MutationObserver(inspect);if(root)observer.observe(root,{childList:true,subtree:true});inspect();
    document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;var id=a.getAttribute('href').slice(1);var target=document.getElementById(id);if(target){e.preventDefault();target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}});
  })();`;
  const csp = `default-src 'none'; script-src 'unsafe-inline' https://esm.sh; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src https: data: blob: ${new URL(assetBase).origin}; media-src https: data:; connect-src https://esm.sh; base-uri 'none'; form-action https:; object-src 'none'`;
  const preloads = [...usedImports].map(i => `<link rel="modulepreload" href="${esc(imports[i])}" crossorigin>`).join('\n');
  const html = `<!doctype html><html lang="${esc(head.lang)}"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${esc(csp)}"><meta name="viewport" content="width=device-width, initial-scale=1">${head.html}
    <script type="importmap">${JSON.stringify({ imports }).replace(/</g, '\\u003c')}</script>${preloads}
    <style>html,body,#root{margin:0;min-height:100%}*,*::before,*::after{box-sizing:border-box}</style>
    <style>${style(css)}</style></head><body><div id="root"></div><script>${script(observer)}</script><script type="module">${script(js)}</script></body></html>`;
  const artifact: PreviewArtifact = { html, sourceHash: hash, buildId, compilerVersion: COMPILER_VERSION, compileMs: Math.round(performance.now() - start) };
  if (cache.size >= 6) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, artifact);
  return artifact;
}
