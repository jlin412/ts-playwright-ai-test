// Recon for Workflow L — /checkout/items
// Probe: click Add on several items, capture modifier dialogs,
// quantity controls, cart line additions, and negative paths.
// Run: node recon/food-recon.mjs

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? 'https://www.yosemitecinema.com';
const out = { baseURL: BASE, generatedAt: new Date().toISOString(), steps: {} };

function record(name, data) {
  out.steps[name] = data;
  console.log(`\n=== ${name} ===\n${JSON.stringify(data, null, 2).slice(0, 2500)}\n`);
}

async function snap(page, label) {
  await page.screenshot({ path: resolve(__dirname, 'screenshots', `${label}.png`) }).catch(() => {});
  return {
    url: page.url(),
    bodyPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 2000),
  };
}

async function inv(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('button, input, select, [role="button"]'))
      .slice(0, 80)
      .map(el => ({
        tag: el.tagName, text: (el.innerText || '').trim().slice(0, 60),
        type: el.getAttribute('type'), ariaLabel: el.getAttribute('aria-label'),
        testId: el.getAttribute('data-test-id'), disabled: el.hasAttribute('disabled'),
        role: el.getAttribute('role'),
      }))
  );
}

async function reachFoodPage(page) {
  await page.goto(BASE + '/now-playing', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /now playing/i }).first().waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll('a[href*="/movie/"]').length > 0, { timeout: 30_000 });
  const hrefs = await page.$$eval('a[href*="/movie/"]', els =>
    Array.from(new Set(els.map(e => e.getAttribute('href')).filter(Boolean))).slice(0, 12));
  for (const href of hrefs) {
    const url = href.startsWith('http') ? href : new URL(href, BASE).toString();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const ok = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .some(b => /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim())));
    if (ok) break;
  }
  const th = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll('button')).find(b =>
      /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim())));
  await th.asElement().click();
  await page.waitForURL(/\/checkout\/showing\//, { timeout: 15_000 });
  await page.waitForTimeout(4000);
  const btn = page.getByRole('button', { name: /accept\s*&\s*dismiss/i });
  if (await btn.first().isVisible().catch(() => false)) await btn.first().click().catch(() => {});
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.waitForTimeout(4500);
  await page.evaluate(() => {
    const adds = Array.from(document.querySelectorAll('button'))
      .filter(b => (b.innerText || '').trim().toUpperCase() === 'ADD' && !b.disabled);
    (adds[1] || adds[0])?.click();
  });
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: /^next:\s*food\s*&\s*drink$/i }).click();
  await page.waitForURL(/\/checkout\/items/, { timeout: 15_000 });
  await page.waitForTimeout(4000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await reachFoodPage(page);
  record('A_food_page_initial', await snap(page, '60-food-initial'));
  record('A_food_page_inventory', { items: await inv(page) });

  // --- Probe each add-able category ---
  const categories = [
    { label: 'Popcorn ($6.00)', nameMatch: 'Popcorn', priceMatch: '$6.00' },
    { label: 'Caramel Corn ($10.00)', nameMatch: 'Caramel Corn', priceMatch: '$10.00' },
    { label: 'Sodas ($6.25)', nameMatch: 'Sodas', priceMatch: '$6.25' },
    { label: 'Churros ($7.00)', nameMatch: 'Churros', priceMatch: '$7.00' },
    { label: 'Extras ($0.00)', nameMatch: 'Extras', priceMatch: '$0.00' },
    { label: 'French Toast Sticks 5 ($8.00)', nameMatch: 'French Toast Sticks 5', priceMatch: '$8.00' },
  ];

  for (const cat of categories) {
    // Reload page between probes to keep state clean
    await page.goto(BASE + '/checkout/items', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // Find the Add button closest to this item's name
    const clicked = await page.evaluate(({ nameMatch }) => {
      // Find the item card containing nameMatch text
      const all = Array.from(document.querySelectorAll('*'));
      const card = all.find(el =>
        (el.innerText || '').includes(nameMatch) &&
        el.innerText.trim().length < 300 &&
        el.querySelectorAll('button').length > 0
      );
      if (!card) return { found: false };
      const addBtn = Array.from(card.querySelectorAll('button'))
        .find(b => (b.innerText || '').trim().toLowerCase() === 'add' && !b.disabled);
      if (!addBtn) return { found: true, noAddBtn: true };
      addBtn.click();
      return { found: true, clicked: true };
    }, { nameMatch: cat.nameMatch });

    await page.waitForTimeout(3000);

    const afterSnap = await snap(page, `61-after-add-${cat.nameMatch.toLowerCase().replace(/\s+/g, '-')}`);
    const afterInv = await inv(page);

    // Check if a dialog / drawer / modal surfaced
    const dialogs = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="drawer"], [class*="q-dialog"]'));
      return candidates.map(el => ({
        role: el.getAttribute('role'),
        class: el.className?.slice(0, 80),
        text: (el.innerText || '').trim().slice(0, 400),
        visible: window.getComputedStyle(el).display !== 'none',
      }));
    });

    // Look for quantity controls (+/- in the cart)
    const qtyCandidates = afterInv.filter(el => {
      const t = (el.text || '').trim();
      return t === '+' || t === '-' || /^(1|2|3|qty|quantity)$/.test(t);
    });

    record(`B_probe_${cat.nameMatch.replace(/\s+/g, '_')}`, {
      clicked,
      bodyPreview: afterSnap.bodyPreview,
      dialogs: dialogs.filter(d => d.visible),
      qtyCandidates,
      addBtnsAfter: afterInv.filter(e => (e.text || '').toLowerCase() === 'add').length,
      totalInteractive: afterInv.length,
    });
  }

  // --- If a modifier dialog appears anywhere, probe it deeper ---
  // Re-run Popcorn and inspect the dialog structure
  await page.goto(BASE + '/checkout/items', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const popcornClicked = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('*')).filter(el =>
      (el.innerText || '').includes('Popcorn') &&
      el.innerText.trim().length < 200 &&
      el.querySelectorAll('button').length > 0
    );
    const addBtn = cards.flatMap(c =>
      Array.from(c.querySelectorAll('button')).filter(b =>
        (b.innerText || '').trim().toLowerCase() === 'add' && !b.disabled)
    )[0];
    if (addBtn) { addBtn.click(); return true; }
    return false;
  });
  await page.waitForTimeout(3000);
  record('C_popcorn_deep', {
    clicked: popcornClicked,
    body: (await page.locator('body').innerText().catch(() => '')).slice(0, 2500),
    dialogs: await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="dialog"], [class*="q-dialog"]'))
        .map(el => ({
          html: el.outerHTML.slice(0, 1000),
          text: (el.innerText || '').trim().slice(0, 500),
          visible: window.getComputedStyle(el).display !== 'none',
        })).filter(d => d.visible)
    ),
    interactive: await inv(page),
  });

  await page.screenshot({ path: resolve(__dirname, 'screenshots', '62-popcorn-deep.png') }).catch(() => {});

  await browser.close();
  writeFileSync(resolve(__dirname, 'food-findings.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${resolve(__dirname, 'food-findings.json')}`);
})();
