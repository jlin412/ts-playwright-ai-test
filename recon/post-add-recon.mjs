// Continue the recon: click ADD on a ticket type and see what surfaces.
// Then try to advance through Food & Drink → Cart → Payment.
// NEVER submits payment.
// Run: node recon/post-add-recon.mjs

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? 'https://www.yosemitecinema.com';

const out = { baseURL: BASE, generatedAt: new Date().toISOString(), steps: {} };

function record(name, data) {
  out.steps[name] = data;
  const preview = JSON.stringify(data, null, 2).slice(0, 2500);
  console.log(`\n=== ${name} ===\n${preview}\n`);
}

async function inventory(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, [role="button"], input, select'))
      .slice(0, 150)
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

async function snapshot(page, label) {
  await page.screenshot({ path: resolve(__dirname, 'screenshots', `${label}.png`) }).catch(() => {});
  return {
    url: page.url(),
    title: await page.title(),
    bodyPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 2500),
    interactive: await inventory(page),
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Log all requests so we can see if ADD triggers an API call
  const requestsLog = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET' || req.url().includes('/api/') || req.url().includes('/checkout/')) {
      requestsLog.push({ method: req.method(), url: req.url() });
    }
  });

  // Step 1-2: navigate to a movie with showtimes & click first time
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
  console.log('Movie:', scheduledMovieURL);

  const timeHandle = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find((b) =>
      /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim()),
    );
  });
  await timeHandle.asElement().scrollIntoViewIfNeeded();
  await timeHandle.asElement().click();
  await page.waitForURL(/\/checkout\/showing\//, { timeout: 15_000 });
  await page.waitForTimeout(4000);

  // Step 3: Continue as Guest
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.waitForTimeout(5000);
  record('A_after_guest', await snapshot(page, '30-after-guest'));

  // Step 4: Click ADD on the first NON-Day-Pass ticket type.
  // From recon: structure is "DAY PASS $18.00 ADD" then "Tickets" section with "VR Adult/Child" + ADD.
  // We want a ticket-type ADD, not Day Pass.
  // Strategy: find the heading "Tickets" then the first ADD after it.
  const ticketAddInfo = await page.evaluate(() => {
    // Find the "Tickets" header (it appears in the body twice — tab label + section label).
    // Prefer the SECTION label that's near the ticket types.
    const addBtns = Array.from(document.querySelectorAll('button')).filter(
      (b) => (b.innerText || '').trim().toUpperCase() === 'ADD' && !b.hasAttribute('disabled'),
    );
    // Skip the first ADD (Day Pass) and try the second (first actual ticket type)
    if (addBtns.length < 2) return { hits: addBtns.length };

    // For visibility, capture surrounding context for each
    const context = addBtns.map((b, i) => {
      const ancestor = b.closest('div');
      return {
        index: i,
        nearbyText: (ancestor?.innerText || '').trim().slice(0, 200),
      };
    });
    return { hits: addBtns.length, context };
  });
  record('B_add_button_context', ticketAddInfo);

  // Click the 2nd ADD button (skipping Day Pass)
  await page.evaluate(() => {
    const addBtns = Array.from(document.querySelectorAll('button')).filter(
      (b) => (b.innerText || '').trim().toUpperCase() === 'ADD' && !b.hasAttribute('disabled'),
    );
    // Click the second ADD (first ticket type, e.g., VR Adult)
    if (addBtns[1]) addBtns[1].click();
  });
  await page.waitForTimeout(6000);
  record('C_after_first_add', await snapshot(page, '31-after-first-add'));

  // Step 5: Now look for a "NEXT" / progression button
  const nextProbes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .map((b) => ({
        text: (b.innerText || '').trim().slice(0, 60),
        ariaLabel: b.getAttribute('aria-label'),
        disabled: b.hasAttribute('disabled'),
      }))
      .filter((x) => /next|continue|food|drink|cart|proceed|checkout|pay/i.test(x.text || ''));
  });
  record('D_progression_buttons', nextProbes);

  // Try clicking Food & Drink tab now that cart has items
  const foodTab = page.getByText('Food & Drink', { exact: true }).first();
  if ((await foodTab.count()) > 0) {
    await foodTab.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(4000);
    record('E_food_drink_tab', await snapshot(page, '32-food-drink-tab'));
  }

  // Click Cart tab
  const cartTab = page.getByText('Cart', { exact: true }).first();
  if ((await cartTab.count()) > 0) {
    await cartTab.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(4000);
    record('F_cart_tab', await snapshot(page, '33-cart-tab'));
  }

  // Click Payment tab (INVENTORY ONLY)
  const payTab = page.getByText('Payment', { exact: true }).first();
  if ((await payTab.count()) > 0) {
    await payTab.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(5000);
    record('G_payment_tab', await snapshot(page, '34-payment-tab'));
  }

  record('Z_requests_log', requestsLog.slice(-40));

  await browser.close();

  writeFileSync(resolve(__dirname, 'post-add-findings.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${resolve(__dirname, 'post-add-findings.json')}`);
})();
