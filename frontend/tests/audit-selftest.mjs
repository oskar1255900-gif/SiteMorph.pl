/**
 * Kontrola samego audytu: wstrzykuje celowo za mały przycisk i sprawdza,
 * czy reguła < 44px faktycznie go wykryje. Bez tego "0 problemów" nic nie znaczy.
 *   node tests/audit-selftest.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.AUDIT_URL || 'http://localhost:3000';

const measure = () => {
  const small = [];
  const interactive = document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]');
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).visibility === 'hidden') continue;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) continue;
    const label = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40);
    if (r.height < 44) small.push({ label, w: Math.round(r.width), h: Math.round(r.height) });
  }
  return small;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(800);

const before = await page.evaluate(measure);

// 1) wstrzykujemy 20px przycisk — reguła MUSI go zgłosić
await page.evaluate(() => {
  const b = document.createElement('button');
  b.id = 'audit-canary-tiny';
  b.textContent = 'TINY CANARY';
  b.style.cssText = 'height:20px;width:60px;position:fixed;top:0;left:0;z-index:99999';
  document.body.appendChild(b);
});
const withCanary = await page.evaluate(measure);
const caught = withCanary.some((s) => s.label.includes('TINY CANARY'));

// 2) usuwamy — kontrola wraca do stanu wyjściowego
await page.evaluate(() => document.getElementById('audit-canary-tiny')?.remove());
const after = await page.evaluate(measure);

console.log(JSON.stringify({
  detected: caught,
  beforeCount: before.length,
  withCanaryCount: withCanary.length,
  afterCount: after.length,
  canarySample: withCanary.find((s) => s.label.includes('TINY CANARY')) || null,
}, null, 2));

await browser.close();
if (!caught) {
  console.error('FAIL: audyt NIE wykrył celowo za małego przycisku — reguła jest martwa.');
  process.exit(1);
}
console.log('PASS: reguła <44px realnie wykrywa za małe kontrolki.');
