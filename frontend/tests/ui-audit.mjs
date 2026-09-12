/**
 * Audyt UI SiteMorph — uruchamiany przy działającym `npm run dev` (port 3000).
 *   node tests/ui-audit.mjs
 *
 * Sprawdza: brak poziomego overflow, minimalne rozmiary kontrolek (44px),
 * działanie kotwic na landingu oraz robi zrzuty desktop/mobile.
 * Nie wymaga backendu — brama "w budowie" i endpointy API są zamockowane.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'screens');
const BASE = process.env.AUDIT_URL || 'http://localhost:3000';
const SUPABASE_REF = process.env.SUPABASE_REF || 'hofyecansuojihtkwdli';

mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const LAPTOP = { width: 1024, height: 768 };
const PHONE = { width: 390, height: 844 };
const SMALL_PHONE = { width: 360, height: 800 };

const report = { screens: [], anchors: {}, problems: [] };

const measure = () => {
  const root = document.documentElement;
  const overflow = root.scrollWidth - window.innerWidth;
  const small = [];
  const interactive = document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="radio"]');
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;               // ukryte
    if (getComputedStyle(el).visibility === 'hidden') continue;
    // Checkbox/radio: powierzchnia dotyku to etykieta, nie sam kwadracik.
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      const wrap = el.closest('label') || el.parentElement;
      const wr = wrap?.getBoundingClientRect();
      if (wr && wr.height >= 44) continue;
    }
    const label = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40);
    // Przełączniki i małe kontrolki inline oceniamy tylko po wysokości.
    if (r.height < 44) small.push({ label, w: Math.round(r.width), h: Math.round(r.height) });
  }
  return { overflow, small: small.slice(0, 20), smallCount: small.length };
};const snap = async (page, name, size, expectTheme) => {
  await page.setViewportSize(size);
  await page.waitForTimeout(600);
  const path = resolve(OUT, `${name}-${size.width}.png`);
  await page.screenshot({ path, fullPage: true });
  const m = await page.evaluate(measure);
  const theme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  report.screens.push({ name, width: size.width, theme, ...m });
  if (expectTheme && theme !== expectTheme) report.problems.push(`${name}@${size.width}: oczekiwano motywu ${expectTheme}, jest ${theme}`);
  if (m.overflow > 1) report.problems.push(`${name}@${size.width}: poziomy overflow ${m.overflow}px`);
  if (m.smallCount > 0) report.problems.push(`${name}@${size.width}: ${m.smallCount} kontrolek < 44px`);
  return path;
};

// Klikaj tylko widoczne elementy (szuflada mobilna siedzi w DOM poza ekranem).
const clickVisible = async (page, selector) => {
  const all = page.locator(selector);
  const n = await all.count();
  for (let i = 0; i < n; i++) {
    const el = all.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
  }
  return false;
};

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'pl-PL' });

const session = {
  access_token: 'audit-token',
  refresh_token: 'audit-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: '00000000-0000-0000-0000-000000000000',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'demo@sitemorph.pl',
    app_metadata: {},
    user_metadata: { credits_synced: true, credits_granted: true },
    created_at: new Date().toISOString(),
  },
};

await context.addInitScript(({ session, ref }) => {
  try {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    localStorage.setItem('sitemorph-cookies-accepted', '1');
    localStorage.setItem('sitemorph-credits', '42');
    localStorage.setItem('sitemorph-theme', 'dark');
  } catch { /* ignore */ }
}, { session, ref: SUPABASE_REF });

const page = await context.newPage();
page.on('pageerror', (e) => report.problems.push(`pageerror: ${e.message}`));

await page.route('**/api/admin/gate/check', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unlocked: true }) }));
await page.route('**/api/credits', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ credits: 42 }) }));
await page.route('**/api/projects/', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

// ---------- BRAMA "W BUDOWIE" (pierwszy ekran dla niezalogowanych) ----------
const gate = await context.newPage();
await gate.route('**/api/admin/gate/check', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unlocked: false }) }));
await gate.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
await gate.waitForTimeout(1200);
await snap(gate, 'gate', DESKTOP);
await snap(gate, 'gate', PHONE);
// Wejście do panelu musi mieć pełny obszar dotyku, mimo dyskretnej stylizacji.
const gatePanel = gate.locator('button:has-text("Panel")').first();
if (await gatePanel.count() === 0) {
  report.problems.push('brama: brak przycisku wejścia do panelu');
} else {
  const box = await gatePanel.boundingBox();
  if (!box || box.height < 44) report.problems.push(`brama: przycisk „Panel" ma ${Math.round(box?.height || 0)}px wysokości (< 44px)`);
  await gatePanel.click({ timeout: 8000 }).catch(() => {});
  await gate.waitForTimeout(700);
  const modalBox = await gate.locator('input[type="password"]').first().boundingBox().catch(() => null);
  if (!modalBox) report.problems.push('brama: modal hasła nie otworzył się po kliknięciu „Panel"');
  else if (modalBox.height < 48) report.problems.push(`brama: pole hasła ma ${Math.round(modalBox.height)}px (< 48px)`);
  await snap(gate, 'gate-modal', PHONE);
}
await gate.close();

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200); // splash

// ---------- LANDING ----------
await snap(page, 'landing', DESKTOP);
await snap(page, 'landing', PHONE);
await snap(page, 'landing', SMALL_PHONE);

await page.setViewportSize(DESKTOP);
for (const id of ['hero', 'jak-to-dziala', 'funkcje', 'cennik']) {
  report.anchors[id] = await page.locator(`#${id}`).count();
}
// kotwice z nawigacji muszą istnieć
for (const [label, id] of [['Jak to działa', 'jak-to-dziala'], ['Funkcje', 'funkcje'], ['Cennik', 'cennik']]) {
  const el = page.locator(`header button:has-text("${label}")`).first();
  if (await el.count() === 0) report.problems.push(`landing: brak przycisku nawigacji „${label}"`);
  else {
    await el.click();
    await page.waitForTimeout(700);
    const visible = await page.evaluate((anchor) => {
      const s = document.getElementById(anchor);
      if (!s) return false;
      const r = s.getBoundingClientRect();
      return r.top > -200 && r.top < window.innerHeight;
    }, id);
    if (!visible) report.problems.push(`landing: kotwica #${id} nie przewinęła się do widoku`);
  }
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);

// Motyw jasny (biały + niebieski tekst) — musi zostać czytelny tak samo.
await clickVisible(page, 'button[aria-label="Zmień motyw"]');
await page.waitForTimeout(700);
await snap(page, 'landing-light', DESKTOP, 'light');
await clickVisible(page, 'button[aria-label="Zmień motyw"]');
await page.waitForTimeout(500);
report.themeAfterLanding = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');

// ---------- PULPIT ----------
const enterApp = page.locator('button:has-text("Wróć do aplikacji"), button:has-text("Zacznij zarabiać")').first();
await enterApp.click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);
if (await page.locator('text=Opisz stronę, a ja ją zbuduję.').count() === 0) {
  report.problems.push('pulpit: nie udało się wejść do panelu (brak nagłówka pulpitu)');
} else {
  await snap(page, 'dashboard', DESKTOP, 'dark');
  await snap(page, 'dashboard', LAPTOP, 'dark');
  await snap(page, 'dashboard', PHONE, 'dark');
  await snap(page, 'dashboard', SMALL_PHONE, 'dark');
  await page.setViewportSize(DESKTOP);
  await clickVisible(page, 'button[aria-label="Zmień motyw"]');
  await page.waitForTimeout(700);
  await snap(page, 'dashboard-light', DESKTOP, 'light');
  await clickVisible(page, 'button[aria-label="Zmień motyw"]');
  await page.waitForTimeout(500);
}

// ---------- LEAD FINDER ----------
await page.setViewportSize(DESKTOP);
await page.waitForTimeout(400);
if (await clickVisible(page, 'aside button:has-text("Lead Finder")')) {
  await page.waitForTimeout(1000);
  await snap(page, 'leadfinder', DESKTOP);
  await snap(page, 'leadfinder', PHONE);
} else {
  report.problems.push('panel: nie udało się otworzyć Lead Findera');
}

// ---------- KREATOR ----------
await page.setViewportSize(DESKTOP);
await page.waitForTimeout(300);
if (await clickVisible(page, 'aside button:has-text("Kreator AI")')) {
  await page.waitForTimeout(1800);
  await snap(page, 'builder', DESKTOP);
  await snap(page, 'builder', PHONE);
  await clickVisible(page, 'button:has-text("Kod")');
  await page.waitForTimeout(700);
  await snap(page, 'builder-code', DESKTOP);
} else {
  report.problems.push('panel: nie udało się otworzyć Kreatora');
}

// ---------- POZOSTAŁE ZAKŁADKI ----------
await clickVisible(page, 'header button:has-text("Kreator"), button:has-text("Kreator")');
await page.waitForTimeout(1200);
for (const [tab, label] of [['Cennik i plany', 'pricing'], ['Finanse', 'finance'], ['Akademia', 'tutorials'], ['Pomoc', 'help'], ['Ustawienia', 'settings']]) {
  await page.setViewportSize(DESKTOP);
  await page.waitForTimeout(300);
  if (!(await clickVisible(page, `aside button:has-text("${tab}")`))) {
    report.problems.push(`panel: brak zakładki „${tab}"`);
    continue;
  }
  await page.waitForTimeout(900);
  await snap(page, label, DESKTOP);
  await snap(page, label, PHONE);
}

await browser.close();
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
