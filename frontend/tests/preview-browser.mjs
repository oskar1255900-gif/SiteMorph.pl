import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { build } from 'esbuild';
import { projectFixture } from './fixtures.mjs';
import { runDesignChecks } from './design-runtime-browser.mjs';

const outputDir = resolve(process.env.TEST_OUTPUT_DIR || 'test-results');
await mkdir(outputDir, { recursive: true });
process.env.VITE_SUPABASE_URL ||= 'http://127.0.0.1:4178';
process.env.VITE_SUPABASE_ANON_KEY ||= 'offline-test-public-key';
const server = await createServer({ server: { host: '127.0.0.1', port: 4178, strictPort: true } });
await server.listen();
let extra = process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } : {};
if (process.env.TEST_CHROMIUM_MODULE) {
  const { default: portable } = await import(process.env.TEST_CHROMIUM_MODULE);
  extra = { executablePath: await portable.executablePath(), args: portable.args };
}
const browser = await chromium.launch({ headless: true, ...extra });
let fontRequests = 0;
const modules = new Map();
const require = createRequire(import.meta.url);
for (const name of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client']) {
  const names = Object.keys(require(name)).filter(k => k !== 'default' && /^[a-zA-Z_$][\w$]*$/.test(k));
  const result = await build({ stdin: { contents: `import value from '${name}';export const {${names.join(',')}}=value;export default value;`, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'esm', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' },
    plugins: name === 'react' ? [] : [{ name: 'shared-react', setup(b) { b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', external: true })); } }], minify: true,
    banner: name === 'react' ? {} : { js: "import * as sharedReact from 'react';const require=(id)=>{if(id==='react')return sharedReact;throw new Error('Unsupported test dependency '+id)};" } });
  modules.set(name, result.outputFiles[0].text);
}
const fontPath = process.env.TEST_FONT_PATH;
assert(fontPath, 'Set TEST_FONT_PATH to a local .ttf or .woff2 for offline font loading checks.');
const fontBytes = await readFile(fontPath);
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await context.route('https://esm.sh/**', async route => {
  const url = route.request().url();
  const key = url.includes('react-dom@') ? 'react-dom/client' : url.includes('jsx-dev-runtime') ? 'react/jsx-dev-runtime' : url.includes('jsx-runtime') ? 'react/jsx-runtime' : 'react';
  if (key === 'react') await new Promise(resolve => setTimeout(resolve, 1900));
  await route.fulfill({ body: modules.get(key), contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
});
await context.route('https://fonts.googleapis.com/**', async route => {
  fontRequests++;
  const url = new URL(route.request().url());
  const names = url.searchParams.getAll('family').map(value => value.split(':')[0]);
  let css = '';
  for (const name of names) {
    const slug = name.toLowerCase().replaceAll(' ', '-');
    try {
      if (!process.env.TEST_FONT_ROOT) throw new Error('Use fallback font');
      const source = await readFile(resolve(process.env.TEST_FONT_ROOT, slug, '400.css'), 'utf8');
      css += source.replaceAll('./files/', `https://fonts.gstatic.com/fontsource/${slug}/`);
    } catch {
      css += `@font-face{font-family:'${name}';src:url('https://fonts.gstatic.com/test-font.ttf') format('truetype');font-weight:100 900;font-display:swap}`;
    }
  }
  await route.fulfill({ body: css, contentType: 'text/css', headers: { 'Access-Control-Allow-Origin': '*' } });
});
await context.route('https://fonts.gstatic.com/**', async route => {
  const match = new URL(route.request().url()).pathname.match(/^\/fontsource\/([a-z0-9-]+)\/([a-z0-9.-]+)$/);
  const body = match ? await readFile(resolve(process.env.TEST_FONT_ROOT, match[1], 'files', match[2])) : fontBytes;
  await route.fulfill({ body, contentType: match ? 'font/woff2' : 'font/ttf', headers: { 'Access-Control-Allow-Origin': '*' } });
});
const page = await context.newPage();
page.on('pageerror', error => console.error('Preview runtime:', error.message));
page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
await page.route('http://127.0.0.1:4178/', route => route.fulfill({ body: '<html><head></head><body style="margin:0"><div id="root"></div></body></html>', contentType: 'text/html' }));
const results = [];
try {
  await page.goto('http://127.0.0.1:4178/');
  for (const brand of ['mochi', 'architecture']) {
    const files = projectFixture(brand);
    const artifact = await page.evaluate(async files => {
      const compiler = await import('/src/lib/previewCompiler.ts');
      return compiler.compileReactProject(files);
    }, files);
    assert(!artifact.html.includes('display:none!important'), 'Unimported CSS must not leak into preview');
    assert(artifact.html.includes('Head+Font'), 'index.html font link must survive compilation');
    await page.evaluate(html => {
      window.__messages = [];
      window.addEventListener('message', event => { if (event.data?.__sm === 'sitemorph') window.__messages.push(event.data); });
      const iframe = document.createElement('iframe'); iframe.id = 'preview'; iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-forms');
      iframe.style.cssText = 'display:block;width:100%;height:100vh;border:0'; iframe.srcdoc = html;
      document.body.replaceChildren(iframe);
    }, artifact.html);
    await page.waitForFunction(() => window.__messages.some(d => d.m.t === 'mounted' || d.m.t === 'runtime-error'), null, { timeout: 35000 });
    const messages = await page.evaluate(() => window.__messages);
    assert(!messages.some(d => d.m.t === 'runtime-error'), JSON.stringify(messages));
    const frame = page.frames().find(f => f.parentFrame());
    assert(frame, 'Preview frame exists');
    const metrics = await frame.evaluate(async () => {
      await document.fonts.ready;
      return { title: document.title, nav: getComputedStyle(document.querySelector('nav')).display,
        h1: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
        font: getComputedStyle(document.body).fontFamily, fontsLoaded: [...document.fonts].filter(f => f.status === 'loaded').length,
        columns: getComputedStyle(document.querySelector('.hero')).gridTemplateColumns,
        overflow: document.documentElement.scrollWidth > innerWidth + 2,
        reduced: getComputedStyle(document.querySelector('.cta')).transitionDuration };
    });
    assert.equal(metrics.nav, 'flex'); assert(metrics.h1 >= 60); assert(metrics.fontsLoaded >= 2);
    assert.equal(metrics.overflow, false); assert.equal(metrics.reduced, '0s');
    await page.screenshot({ path: resolve(outputDir, brand + '-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await frame.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 2, columns: getComputedStyle(document.querySelector('.hero')).gridTemplateColumns }));
    assert.equal(mobile.overflow, false); assert.equal(mobile.columns.split(' ').length, 1);
    await page.screenshot({ path: resolve(outputDir, brand + '-mobile.png'), fullPage: true });
    const cacheMs = await page.evaluate(async files => { const c = await import('/src/lib/previewCompiler.ts'); const start = performance.now(); await c.compileReactProject(files); return performance.now() - start; }, files);
    results.push({ brand, compileMs: artifact.compileMs, cacheMs, desktop: metrics, mobile });
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  if (process.env.TEST_DESIGN_V2 === '1') await runDesignChecks({ page, context, outputDir });
  const bad = projectFixture();
  bad['main/frontend/src/App.tsx'] += "\nimport Missing from './DoesNotExist';console.log(Missing);";
  const error = await page.evaluate(async files => { try { await (await import('/src/lib/previewCompiler.ts')).compileReactProject(files); return ''; } catch (e) { return e.message; } }, bad);
  assert.match(error, /DoesNotExist/);
  assert(fontRequests >= 4);
  // Exercise the actual Builder UI with deterministic HTTP responses, no model calls.
  const ui = await context.newPage();
  ui.on('pageerror', error => console.error('Builder runtime:', error.message));
  const projects = [];
  const saves = [];
  let calls = 0;
  let publishBody;
  await ui.route('http://127.0.0.1:4178/', async route => route.fulfill({ body: await server.transformIndexHtml('/', '<html><body><div id="root"></div><script type="module" src="/tests/harness.tsx"></script></body></html>'), contentType: 'text/html' }));
  await ui.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    let data = {};
    if (path === '/api/builder/generate') {
      calls++;
      const files = projectFixture(calls >= 4 ? 'architecture' : 'mochi');
      if (calls === 2) files['main/frontend/src/main.tsx'] += "\nimport './missing-file';";
      if (calls === 3) files['main/frontend/src/main.tsx'] = "throw new Error('Test runtime failure');\n" + files['main/frontend/src/main.tsx'];
      data = { files, meta: { title: calls >= 4 ? 'Forma Studio' : 'Mad Mochi' }, design_tokens: { accent: '#597849' }, section_plan: Array.from({ length: 9 }, (_, i) => ({ id: String(i) })), generator_warnings: [], timings: { model_ms: 10 } };
    } else if (path.startsWith('/api/projects')) {
      if (req.method() === 'GET') data = projects;
      else {
        const body = req.postDataJSON(); saves.push({ method: req.method(), body });
        const saved = { ...body, id: req.method() === 'POST' ? projects.length + 1 : Number(path.split('/').pop()) };
        if (req.method() === 'POST') projects.push(saved); else projects[projects.findIndex(p => p.id === saved.id)] = saved;
        data = saved;
      }
    } else if (path === '/api/publish') { publishBody = req.postDataJSON(); data = { id: 'test', url: '/p/test' }; }
    await route.fulfill({ body: JSON.stringify(data), contentType: 'application/json' });
  });
  await ui.goto('http://127.0.0.1:4178/');
  await ui.locator('textarea').press('Enter');
  await ui.getByText(/Brak kredytów!/).waitFor();
  assert.equal(calls, 0);
  await ui.evaluate(() => window.__setCredits(500));
  await ui.locator('textarea').press('Enter');
  await ui.getByText('Strona gotowa!', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal(calls, 1);
  assert.equal(await ui.locator('#test-credits').textContent(), '485');
  await ui.getByRole('button', { name: 'Zapisz projekt', exact: true }).click();
  await ui.getByText('Zapisano projekt wraz z podglądem ✓').waitFor();
  await ui.getByRole('button', { name: 'Zapisz zmiany', exact: true }).click();
  await ui.getByRole('button', { name: 'Opublikuj', exact: true }).click();
  await ui.locator('input[value="http://127.0.0.1:4178/p/test"]').waitFor();
  assert(saves.some(s => s.method === 'PATCH' && s.body.content.artifact.html));
  assert.equal(saves[0].body.content.metadata.section_plan.length, 9);
  assert.equal(publishBody.source_hash, saves.at(-1).body.content.artifact.sourceHash);
  await ui.getByRole('button', { name: 'Zamknij publikację' }).click();
  await ui.getByRole('button', { name: /Wygeneruj nową stronę/ }).click();
  await ui.getByRole('alert').filter({ hasText: /missing-file/ }).waitFor();
  assert.equal(await ui.locator('#test-credits').textContent(), '485');
  assert((await ui.locator('iframe').getAttribute('title')).includes('Mad Mochi'));
  await ui.getByRole('button', { name: /Wygeneruj nową stronę/ }).click();
  await ui.getByRole('alert').filter({ hasText: /Zachowano poprzednią stronę/ }).waitFor({ timeout: 30000 });
  assert.equal(await ui.locator('#test-credits').textContent(), '485');
  await ui.getByRole('button', { name: /Wygeneruj nową stronę/ }).click();
  await ui.getByText('Strona gotowa!', { exact: true }).waitFor({ timeout: 30000 });
  await ui.getByRole('button', { name: 'Zapisz projekt', exact: true }).click();
  await ui.getByText('Zapisano projekt wraz z podglądem ✓').waitFor();
  assert.equal(calls, 4);
  assert.equal(await ui.locator('#test-credits').textContent(), '470');
  assert.equal(projects.length, 2);
  assert.equal(projects[0].name, 'Mad Mochi');
  assert.equal(projects[1].name, 'Forma Studio');
  // An identical cached artifact must still mount in a fresh iframe and complete.
  await ui.getByRole('button', { name: /Wygeneruj nową stronę/ }).click();
  await ui.getByText('Strona gotowa!', { exact: true }).waitFor({ timeout: 30000 });
  await ui.getByRole('button', { name: 'Zapisz projekt', exact: true }).click();
  await ui.getByText('Zapisano projekt wraz z podglądem ✓').waitFor();
  assert.equal(calls, 5); assert.equal(projects.length, 3);
  assert.equal(await ui.locator('#test-credits').textContent(), '455');
  assert.equal(projects[1].content.artifact.sourceHash, projects[2].content.artifact.sourceHash);
  assert.notEqual(projects[1].domain, projects[2].domain);
  await ui.reload();
  await ui.getByRole('button', { name: 'Mad Mochi', exact: true }).click();
  await ui.getByText('Strona gotowa!', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal(calls, 5, 'Opening a saved project never invokes AI');
  assert.equal(await ui.locator('#test-credits').textContent(), '0', 'Opening an existing project does not charge credits');
  await ui.close();
  const uiResults = { generationRequests: calls, createdProjects: projects.length,
    generationTimesMs: projects.map(p => p.content.metadata.timings.client_total_ms),
    cases: ['retry after low credits', 'save full content with PATCH', 'publish saved artifact', 'preserve previous preview on compile failure', 'preserve previous preview on runtime failure', 'charge only mounted generations', 'new generation creates new project', 'identical cached artifact remounts', 'open saved project after reload without AI or credits'] };
  await writeFile(resolve(outputDir, 'preview-results.json'), JSON.stringify({ offlineFixtures: true, fontRequests, results, uiResults }, null, 2));
  console.log(JSON.stringify({ passed: true, cases: ['CSS imports', 'CSS modules', 'index font links', 'CSS font imports with semicolons', 'actual font loading', 'slow module mount', 'mobile layout', 'reduced motion', 'missing import rejection', 'artifact cache'], results, uiResults }, null, 2));
} finally { await browser.close(); await server.close(); }
