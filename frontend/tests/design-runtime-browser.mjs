import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function runDesignChecks({ page, context, outputDir }) {
  const cases = JSON.parse(await readFile(resolve(outputDir, 'design-cases.json'), 'utf8'));
  // Controlled image fixtures exercise crops/loading/interaction without claiming photo relevance.
  await context.route('https://fixtures.sitemorph.test/**', route => route.fulfill({
    contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' },
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" viewBox="0 0 1000 1200"><rect width="1000" height="1200" fill="#c8b7a3"/><path d="M0 900L500 220L1000 640V1200H0Z" fill="#6c7564"/><path d="M600 0H1000V1200H600Z" fill="#444e48" opacity=".45"/><text x="70" y="1100" font-family="sans-serif" font-size="38" fill="#fff">PHOTO FIXTURE</text></svg>',
  }));
  const results = [];
  for (const fixture of cases) {
    await page.setViewportSize({ width: 1280, height: 900 });
    const artifact = await page.evaluate(async files => (await import('/src/lib/previewCompiler.ts')).compileReactProject(files), fixture.files);
    await page.evaluate(html => {
      window.__messages = [];
      const iframe = document.createElement('iframe'); iframe.id = 'preview';
      iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-forms');
      iframe.style.cssText = 'display:block;width:100%;height:100vh;border:0'; iframe.srcdoc = html;
      document.body.replaceChildren(iframe);
    }, artifact.html);
    await page.waitForFunction(() => window.__messages.some(d => d.m.t === 'mounted' || d.m.t === 'runtime-error'), null, { timeout: 35000 });
    const messages = await page.evaluate(() => window.__messages);
    assert(!messages.some(d => d.m.t === 'runtime-error' || (d.m.t === 'mounted' && !d.m.ok)), JSON.stringify(messages));
    const frame = page.frames().find(f => f.parentFrame());
    await frame.locator('h1').waitFor();
    const metrics = await frame.evaluate(async () => {
      await document.fonts.ready;
      const h1 = document.querySelector('h1');
      const links = [...document.querySelectorAll('a[href^="#"]')];
      return { title: document.title, headings: document.querySelectorAll('h1').length,
        displayFont: getComputedStyle(h1).fontFamily, bodyFont: getComputedStyle(document.body).fontFamily,
        h1Size: parseFloat(getComputedStyle(h1).fontSize),
        primaryCtaBottom: document.querySelector('.sm-hero .sm-actions a').getBoundingClientRect().bottom,
        fontsLoaded: [...document.fonts].filter(f => f.status === 'loaded').length,
        sections: document.querySelectorAll('main>section').length,
        brokenAnchors: links.filter(link => !document.getElementById(link.getAttribute('href').slice(1))).length,
        overflow: document.documentElement.scrollWidth > innerWidth + 2,
        animations: document.getAnimations().length, heroClass: document.querySelector('.sm-hero').className };
    });
    assert.equal(metrics.headings, 1); assert.equal(metrics.brokenAnchors, 0);
    assert.equal(metrics.overflow, false, fixture.brand + ' desktop overflow');
    assert(metrics.h1Size >= 56); assert(metrics.fontsLoaded >= 2, JSON.stringify(metrics));
    assert(metrics.primaryCtaBottom <= 900, fixture.brand + ' primary desktop CTA should be visible');
    assert.equal(metrics.animations, 0, 'Reduced motion must disable animation');
    assert.equal(metrics.sections, fixture.bindings.section_primitives.length);
    await page.screenshot({ path: resolve(outputDir, `v2-${fixture.brand}-desktop.png`) });
    if (fixture.brand === 'law') {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await frame.waitForFunction(() => document.getAnimations().length > 0);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await frame.waitForFunction(() => document.getAnimations().length === 0);
    }
    if (fixture.brand === 'mochi') {
      await frame.getByRole('tab', { name: 'Matcha', exact: true }).click();
      assert.equal(await frame.getByRole('tab', { name: 'Matcha', exact: true }).getAttribute('aria-selected'), 'true');
      await frame.getByRole('tabpanel').getByText('Matcha latte', { exact: true }).waitFor();
      await frame.getByRole('tab', { name: 'Matcha', exact: true }).press('ArrowLeft');
      assert.equal(await frame.getByRole('tab', { name: 'Mochi donuts', exact: true }).getAttribute('aria-selected'), 'true');
      await frame.locator('.sm-gallery-item').first().click();
      await frame.getByRole('dialog').waitFor();
      await frame.getByRole('button', { name: 'Zamknij zdjęcie' }).press('Escape');
      assert.equal(await frame.getByRole('dialog').count(), 0);
      assert(await frame.locator('.sm-gallery-item').first().evaluate(node => document.activeElement === node));
    }
    if (fixture.brand === 'law') {
      await frame.locator('summary').first().click();
      assert.equal(await frame.locator('details').first().getAttribute('open'), '');
    }
    if (fixture.brand === 'detailing') {
      await frame.getByRole('button', { name: 'Następne pozycje' }).click();
      assert(await frame.locator('.sm-rail--scroll').evaluate(node => node.scrollLeft > 0));
    }
    assert.equal(await frame.locator('form').evaluate(form => form.checkValidity()), false);
    await frame.getByLabel('Imię', { exact: true }).fill('Test');
    await frame.getByLabel('E-mail', { exact: true }).fill('test@visitor.test');
    await frame.getByLabel('Wiadomość', { exact: true }).fill('Proszę o kontakt.');
    assert.equal(await frame.locator('form').evaluate(form => form.checkValidity()), true);
    await frame.getByText('Wysyłka przez Twój program pocztowy.', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await frame.evaluate(() => scrollTo(0, 0));
    const mobile = await frame.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 2,
      h1Size: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
      bodySize: parseFloat(getComputedStyle(document.body).fontSize), navVisible: getComputedStyle(document.querySelector('nav')).display }));
    assert.equal(mobile.overflow, false, fixture.brand + ' mobile overflow');
    assert(mobile.h1Size >= 36 && mobile.h1Size <= 80); assert(mobile.bodySize >= 16);
    assert.equal(mobile.navVisible, 'none');
    await page.screenshot({ path: resolve(outputDir, `v2-${fixture.brand}-mobile.png`) });
    await frame.getByRole('button', { name: 'Otwórz menu' }).click();
    assert.equal(await frame.getByRole('button', { name: 'Zamknij menu' }).getAttribute('aria-expanded'), 'true');
    await frame.getByRole('navigation').getByRole('link', { name: 'Oferta' }).click();
    assert.equal(await frame.getByRole('button', { name: 'Otwórz menu' }).getAttribute('aria-expanded'), 'false');
    assert(await frame.evaluate(() => Math.abs(document.getElementById('oferta').getBoundingClientRect().top) < 100));
    results.push({ brand: fixture.brand, designCompileMs: fixture.designCompileMs, bundleMs: artifact.compileMs, desktop: metrics, mobile });
  }
  assert(new Set(results.map(r => r.desktop.heroClass)).size >= 4, 'Business fixtures must have distinct actual hero layouts');
  assert.equal(new Set(results.map(r => r.desktop.displayFont)).size, 5);
  // A hero image may fail after the model/API already succeeded.
  const failedImageFiles = { ...cases.find(c => c.brand === 'architecture').files };
  const config = JSON.parse(failedImageFiles['main/frontend/src/data/site.json']);
  config.pagePlan.sections[0].props.media[0].src = 'https://fixtures.sitemorph.test/broken.webp';
  failedImageFiles['main/frontend/src/data/site.json'] = JSON.stringify(config);
  await context.route('https://fixtures.sitemorph.test/broken.webp', route => route.abort());
  const failedImageArtifact = await page.evaluate(async files => (await import('/src/lib/previewCompiler.ts')).compileReactProject(files), failedImageFiles);
  await page.evaluate(html => { document.getElementById('preview').srcdoc = html; }, failedImageArtifact.html);
  await page.frames().find(f => f.parentFrame()).locator('.sm-hero--type').waitFor();
  const percentile = (values, q) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1];
  const timings = { samples: results.length, aiMeasured: false,
    designCompileP50Ms: percentile(results.map(r => r.designCompileMs), .5),
    designCompileP95Ms: percentile(results.map(r => r.designCompileMs), .95),
    warmBundleP50Ms: percentile(results.map(r => r.bundleMs), .5),
    warmBundleP95Ms: percentile(results.map(r => r.bundleMs), .95) };
  await writeFile(resolve(outputDir, 'design-results.json'), JSON.stringify({ results, timings }, null, 2));
  console.log('Design V2 browser checks passed:', JSON.stringify(timings));
  await page.setViewportSize({ width: 1280, height: 900 });
  return results;
}
