/**
 * Pomiar układu pulpitu — czy najważniejsze elementy mieszczą się w pierwszym ekranie.
 *   node tests/dashboard-layout.mjs
 * Zrzuty: screens/dash-vp-{width}.png (viewport, nie fullPage)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'screens');
const BASE = process.env.AUDIT_URL || 'http://localhost:3000';
const REF = process.env.SUPABASE_REF || 'hofyecansuojihtkwdli';
mkdirSync(OUT, { recursive: true });

const session = {
  access_token: 'audit-token', refresh_token: 'audit-refresh', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: '00000000-0000-0000-0000-000000000000', aud: 'authenticated', role: 'authenticated',
    email: 'demo@sitemorph.pl', app_metadata: {}, user_metadata: { credits_synced: true, credits_granted: true },
    created_at: new Date().toISOString() },
};

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'pl-PL' });
await context.addInitScript(({ session, ref }) => {
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
  localStorage.setItem('sitemorph-cookies-accepted', '1');
  localStorage.setItem('sitemorph-credits', '42');
  localStorage.setItem('sitemorph-theme', 'dark');
}, { session, ref: REF });

const page = await context.newPage();
await page.route('**/api/admin/gate/check', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"unlocked":true}' }));
await page.route('**/api/credits', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"credits":42}' }));
await page.route('**/api/projects/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
const enter = page.locator('button:has-text("Wróć do aplikacji"), button:has-text("Zacznij zarabiać")').first();
await enter.click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1600);

const report = {};
for (const [w, h] of [[1440, 900], [390, 844]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const m = await page.evaluate((vh) => {
    const doc = document.documentElement;
    const composer = document.querySelector('textarea, textarea[placeholder], [data-testid="composer"]')
      || [...document.querySelectorAll('textarea')][0];
    const quick = [...document.querySelectorAll('button')].find((b) => /Kreator AI|Lead Finder|Projekty|Akademia/.test(b.textContent || ''));
    const firstRow = [...document.querySelectorAll('li, tr, [class*="project"]')].find((el) => /Brak projektów|projekt|Projekt/.test(el.textContent || ''));
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
    const qr = rect(quick);
    return {
      docScrollHeight: doc.scrollHeight,
      bodyPaddingTop: getComputedStyle(document.body).paddingTop,
      bodyMarginTop: getComputedStyle(document.body).marginTop,
      bodyScrollTop: document.body.scrollTop,
      htmlScrollTop: doc.scrollTop,
      viewport: vh,
      composer: rect(composer),
      quickActions: qr,
      gapComposerToQuick: rect(composer) && qr ? qr.top - rect(composer).bottom : null,
      firstProjectRow: rect(firstRow),
      quickInFirstViewport: qr ? qr.bottom <= vh : null,
    };
  }, h);
  report[`${w}x${h}`] = m;
  await page.screenshot({ path: resolve(OUT, `dash-vp-${w}.png`) });
}

console.log(JSON.stringify(report, null, 2));
await browser.close();
