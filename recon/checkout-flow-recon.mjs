// Walk through the full ticketing/checkout flow on yosemitecinema.com.
// NEVER submits payment. Captures inventory + screenshots at each step.
// Run: node recon/checkout-flow-recon.mjs

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? 'https://www.yosemitecinema.com';

const out = { baseURL: BASE, generatedAt: new Date().toISOString(), steps: {} };

function record(name, data) {
  out.steps[name] = data;
  const preview = JSON.stringify(data, null, 2).slice(0, 1800);
  console.log(`\n=== ${name} ===\n${preview}\n`);
}

async function inventory(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, [role="button"], input, select'))
      .slice(0, 120)
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
      }));
  });
}

async function snapshotStep(page, label) {
  await page.screenshot({ path: resolve(__dirname, 'screenshots', `${label}.png`) }).catch(() => {});
  return {
    url: page.url(),
    title: await page.title(),
    h1: await page.locator('h1').first().innerText().catch(() => null),
    bodyPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 2000),
    interactive: await inventory(page),
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Step 1: find a movie with showtimes
  await page.goto(BASE + '/now-playing', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /now playing/i }).first().waitFor({ timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelectorAll('a[href*="/movie/"]').length > 0,
    { timeout: 30_000 },
  );

  const hrefs = await page.$$eval('a[href*="/movie/"]', (els) =>
    Array.from(new Set(els.map((e) => e.getAttribute('href')).filter(Boolean))).slice(0, 12),
  );

  let scheduledMovieURL = null;
  for (const href of hrefs) {
    const url = href.startsWith('http') ? href : new URL(href, BASE).toString();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const hasTimes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some((b) =>
        /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim()),
      ),
    );
    if (hasTimes) {
      scheduledMovieURL = url;
      break;
    }
  }
  if (!scheduledMovieURL) {
    console.error('No movie with showtimes found');
    await browser.close();
    process.exit(2);
  }
  record('00_picked_movie', { url: scheduledMovieURL });

  // Step 2: click first showtime
  const timeHandle = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find((b) =>
      /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim()),
    );
  });
  const elt = timeHandle.asElement();
  await elt.scrollIntoViewIfNeeded();
  await elt.click();
  await page.waitForURL(/\/checkout\/showing\//, { timeout: 15_000 });
  await page.waitForTimeout(4000);
  record('01_tickets_tab_before_guest', await snapshotStep(page, '20-tickets-before-guest'));

  // Step 3: click Continue As Guest
  const guestBtn = page.getByRole('button', { name: /continue as guest/i });
  await guestBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await guestBtn.click();
  await page.waitForTimeout(5000);
  record('02_tickets_tab_after_guest', await snapshotStep(page, '21-tickets-after-guest'));

  // Step 4: try to find ticket-type controls & quantity widgets
  // Look for +/- buttons, number inputs, "Add", "Continue", "Next" buttons.
  const ticketControls = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, input, [role="button"]'));
    return all
      .map((el) => ({
        tag: el.tagName,
        text: (el.innerText || '').trim().slice(0, 60),
        ariaLabel: el.getAttribute('aria-label'),
        type: el.getAttribute('type'),
        value: el.value !== undefined ? el.value : null,
        disabled: el.hasAttribute('disabled'),
      }))
      .filter((x) => {
        const t = (x.text || '').toLowerCase();
        return (
          t === '+' ||
          t === '-' ||
          /\b(adult|child|senior|matinee|member|guest|day pass|ticket)\b/i.test(t) ||
          /next|continue|food|drink|cart|add/i.test(t) ||
          (x.ariaLabel && /quantity|ticket|adult|child|senior|add|remove|increase|decrease/i.test(x.ariaLabel))
        );
      });
  });
  record('03_ticket_type_controls', { count: ticketControls.length, items: ticketControls });

  // Step 5: try to advance to the next step (Food & Drink)
  // Look for a "Next" or "Food & Drink" button
  const nextCandidates = [
    page.getByRole('button', { name: /^next.*food/i }),
    page.getByRole('button', { name: /^next/i }),
    page.getByRole('button', { name: /food\s*&\s*drink/i }),
    page.getByRole('button', { name: /continue/i }),
  ];
  let advanced = false;
  for (const cand of nextCandidates) {
    if ((await cand.count()) > 0) {
      const text = await cand.first().innerText().catch(() => null);
      try {
        await cand.first().click({ timeout: 3000 });
        advanced = true;
        record('04_advanced_via', { text });
        break;
      } catch {}
    }
  }
  if (!advanced) {
    record('04_advanced_via', { result: 'could not click any "next/food/continue" button — ticket types may be required first' });
  }

  await page.waitForTimeout(5000);
  record('05_food_drink_tab', await snapshotStep(page, '22-food-drink-tab'));

  // Step 6: try clicking the "Cart" tab directly
  const cartTab = page.getByText('Cart', { exact: true }).first();
  if ((await cartTab.count()) > 0) {
    try {
      await cartTab.click({ timeout: 3000 });
      await page.waitForTimeout(3000);
      record('06_cart_tab', await snapshotStep(page, '23-cart-tab'));
    } catch (e) {
      record('06_cart_tab_ERROR', { error: String(e) });
    }
  }

  // Step 7: try clicking the "Payment" tab directly (INVENTORY ONLY — never submit)
  const payTab = page.getByText('Payment', { exact: true }).first();
  if ((await payTab.count()) > 0) {
    try {
      await payTab.click({ timeout: 3000 });
      await page.waitForTimeout(4000);
      record('07_payment_tab', await snapshotStep(page, '24-payment-tab'));
    } catch (e) {
      record('07_payment_tab_ERROR', { error: String(e) });
    }
  }

  await browser.close();

  writeFileSync(resolve(__dirname, 'checkout-findings.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${resolve(__dirname, 'checkout-findings.json')}`);
})();
