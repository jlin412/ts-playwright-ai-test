// Recon for Workflow M — probe /checkout/cart for:
//  - quantity controls (+/-, clickable numbers, etc.)
//  - per-line remove/delete buttons
//  - total locator
//  - reload persistence (does the cart survive a page reload?)
// Run: node recon/cart-recon.mjs

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

async function inventory(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, [role="button"], input, select'))
      .slice(0, 160)
      .map((el) => ({
        tag: el.tagName,
        text: (el.innerText || '').trim().slice(0, 80),
        type: el.getAttribute('type'),
        href: el.getAttribute('href'),
        name: el.getAttribute('name'),
        ariaLabel: el.getAttribute('aria-label'),
        placeholder: el.getAttribute('placeholder'),
        role: el.getAttribute('role'),
        disabled: el.hasAttribute('disabled'),
        testId: el.getAttribute('data-test-id'),
        cls: el.getAttribute('class')?.slice(0, 80),
      }));
  });
}

async function snapshot(page, label) {
  await page.screenshot({ path: resolve(__dirname, 'screenshots', `${label}.png`) }).catch(() => {});
  return {
    url: page.url(),
    bodyPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 2500),
    interactive: await inventory(page),
  };
}

async function ensureCookiesDismissed(page) {
  const btn = page.getByRole('button', { name: /accept\s*&\s*dismiss/i });
  if (await btn.first().isVisible().catch(() => false)) await btn.first().click().catch(() => {});
}

async function reachCartTab(page) {
  // 1) Find a movie with showtimes
  await page.goto(BASE + '/now-playing', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /now playing/i }).first().waitFor({ timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelectorAll('a[href*="/movie/"]').length > 0,
    { timeout: 30_000 },
  );
  const hrefs = await page.$$eval('a[href*="/movie/"]', (els) =>
    Array.from(new Set(els.map((e) => e.getAttribute('href')).filter(Boolean))).slice(0, 12),
  );
  for (const href of hrefs) {
    const url = href.startsWith('http') ? href : new URL(href, BASE).toString();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const hasTimes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some((b) =>
        /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim()),
      ),
    );
    if (hasTimes) break;
  }

  // 2) Click first showtime
  const timeHandle = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll('button')).find((b) =>
      /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim()),
    ),
  );
  await timeHandle.asElement().scrollIntoViewIfNeeded();
  await timeHandle.asElement().click();
  await page.waitForURL(/\/checkout\/showing\//, { timeout: 15_000 });
  await page.waitForTimeout(4000);

  // 3) Continue as guest
  await ensureCookiesDismissed(page);
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.waitForTimeout(4500);

  // 4) Click second ADD (first ticket type, skip Day Pass)
  await page.evaluate(() => {
    const adds = Array.from(document.querySelectorAll('button')).filter(
      (b) => (b.innerText || '').trim().toUpperCase() === 'ADD' && !b.disabled,
    );
    (adds[1] || adds[0])?.click();
  });
  await page.waitForTimeout(3500);

  // 5) Advance to Food & Drink
  await page.getByRole('button', { name: /^next:\s*food\s*&\s*drink$/i }).click();
  await page.waitForURL(/\/checkout\/items/, { timeout: 15_000 });
  await page.waitForTimeout(3500);

  // 6) Advance to Cart
  await page.getByRole('button', { name: /^next:\s*cart$/i }).click();
  await page.waitForURL(/\/checkout\/cart/, { timeout: 15_000 });
  await page.waitForTimeout(4000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await reachCartTab(page);
  record('A_cart_tab_initial', await snapshot(page, '40-cart-initial'));

  // Look for +/- quantity buttons near the cart line ("VR Adult" / qty / $price)
  const qtyControls = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, [role="button"], input'));
    return all
      .map((el) => ({
        tag: el.tagName,
        text: (el.innerText || '').trim().slice(0, 30),
        ariaLabel: el.getAttribute('aria-label'),
        testId: el.getAttribute('data-test-id'),
        title: el.getAttribute('title'),
        cls: el.getAttribute('class')?.slice(0, 80),
      }))
      .filter((x) => {
        const t = (x.text || '').toLowerCase();
        const tag = x.tag;
        return (
          t === '+' ||
          t === '-' ||
          /add|remove|delete|trash|minus|plus|decrement|increment/i.test(t) ||
          (x.ariaLabel && /add|remove|delete|increase|decrease|quantity/i.test(x.ariaLabel)) ||
          (x.testId && /add|remove|delete|quantity/i.test(x.testId)) ||
          (tag === 'INPUT' && (x.title || '').toLowerCase().includes('qty'))
        );
      });
  });
  record('B_cart_qty_remove_candidates', { count: qtyControls.length, items: qtyControls });

  // Try to find total / subtotal explicit elements
  const totalProbes = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const matches = [];
    for (const el of all) {
      const t = (el.innerText || '').trim();
      if (/^(total|subtotal|grand total|sub-total)$/i.test(t) && el.childElementCount === 0) {
        // capture sibling and parent for context
        matches.push({
          text: t,
          parentText: (el.parentElement?.innerText || '').trim().slice(0, 200),
        });
      }
    }
    return matches.slice(0, 10);
  });
  record('C_total_label_locators', totalProbes);

  // Locate the "1" qty digit on the cart line — what's its containing element?
  const qtyDigitContext = await page.evaluate(() => {
    const cartItems = Array.from(document.querySelectorAll('*')).filter((el) => {
      const t = (el.innerText || '').trim();
      return /^vr adult|^vr child|^adult|^child|^senior$/i.test(t) && el.childElementCount === 0;
    });
    return cartItems.slice(0, 5).map((el) => ({
      itemText: el.innerText.trim(),
      parentHTML: el.parentElement?.outerHTML.slice(0, 600) || null,
    }));
  });
  record('D_qty_digit_context', qtyDigitContext);

  // Try reload — does cart survive?
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  record('E_after_reload', await snapshot(page, '41-cart-after-reload'));

  // Check localStorage / sessionStorage for cart state
  const storage = await page.evaluate(() => {
    const dump = (s) => {
      const o = {};
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        o[k] = s.getItem(k)?.slice(0, 200);
      }
      return o;
    };
    return {
      cookies: document.cookie,
      localStorage: dump(localStorage),
      sessionStorage: dump(sessionStorage),
    };
  });
  record('F_storage_after_reload', storage);

  // Check if we can directly visit /checkout/cart on a fresh context
  const newCtx = await browser.newContext();
  const newPage = await newCtx.newPage();
  await newPage.goto(BASE + '/checkout/cart', { waitUntil: 'domcontentloaded' });
  await newPage.waitForTimeout(5000);
  record('G_fresh_context_cart_visit', {
    url: newPage.url(),
    bodyPreview: (await newPage.locator('body').innerText().catch(() => '')).slice(0, 1200),
  });

  await browser.close();
  writeFileSync(resolve(__dirname, 'cart-findings.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${resolve(__dirname, 'cart-findings.json')}`);
})();
