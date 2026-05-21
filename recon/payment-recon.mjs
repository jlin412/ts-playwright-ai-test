// Recon for Workflow N — /checkout/payment field inventory + safe validation probes.
// NEVER fills real card numbers. NEVER clicks the final PAY button.
// Run: node recon/payment-recon.mjs

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

async function snapshot(page, label) {
  await page.screenshot({ path: resolve(__dirname, 'screenshots', `${label}.png`) }).catch(() => {});
  return {
    url: page.url(),
    bodyPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 2500),
  };
}

async function acceptCookies(page) {
  const btn = page.getByRole('button', { name: /accept\s*&\s*dismiss/i });
  if (await btn.first().isVisible().catch(() => false)) await btn.first().click().catch(() => {});
}

async function reachPaymentPage(page) {
  // Navigate /now-playing → movie → showtime → guest → ADD → Food & Drink → Cart → Payment
  await page.goto(BASE + '/now-playing', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /now playing/i }).first().waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll('a[href*="/movie/"]').length > 0, { timeout: 30_000 });
  const hrefs = await page.$$eval('a[href*="/movie/"]', els =>
    Array.from(new Set(els.map(e => e.getAttribute('href')).filter(Boolean))).slice(0, 12));
  for (const href of hrefs) {
    const url = href.startsWith('http') ? href : new URL(href, BASE).toString();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const ok = await page.evaluate(() => Array.from(document.querySelectorAll('button'))
      .some(b => /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim())));
    if (ok) break;
  }
  const th = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll('button')).find(b =>
      /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim())));
  await th.asElement().scrollIntoViewIfNeeded();
  await th.asElement().click();
  await page.waitForURL(/\/checkout\/showing\//, { timeout: 15_000 });
  await page.waitForTimeout(4000);
  await acceptCookies(page);
  await page.getByRole('button', { name: /continue as guest/i }).click();
  await page.waitForTimeout(4500);
  await page.evaluate(() => {
    const adds = Array.from(document.querySelectorAll('button')).filter(
      b => (b.innerText || '').trim().toUpperCase() === 'ADD' && !b.disabled);
    (adds[1] || adds[0])?.click();
  });
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: /^next:\s*food\s*&\s*drink$/i }).click();
  await page.waitForURL(/\/checkout\/items/, { timeout: 15_000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /^next:\s*cart$/i }).click();
  await page.waitForURL(/\/checkout\/cart/, { timeout: 15_000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /^next:\s*payment$/i }).click();
  await page.waitForURL(/\/checkout\/payment/, { timeout: 15_000 });
  await page.waitForTimeout(5000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const networkLog = [];
  page.on('request', req => {
    if (req.method() !== 'GET') {
      try { networkLog.push({ method: req.method(), url: new URL(req.url()).hostname + new URL(req.url()).pathname }); } catch {}
    }
  });

  await reachPaymentPage(page);
  record('A_payment_page_loaded', await snapshot(page, '50-payment-loaded'));

  // Inventory ALL inputs/buttons on the host page (outside iframes)
  const hostInventory = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, button, select, textarea'))
      .map(el => ({
        tag: el.tagName,
        type: el.getAttribute('type'),
        name: el.getAttribute('name'),
        id: el.getAttribute('id'),
        placeholder: el.getAttribute('placeholder'),
        ariaLabel: el.getAttribute('aria-label'),
        testId: el.getAttribute('data-test-id'),
        value: el.value || null,
        disabled: el.hasAttribute('disabled'),
        required: el.hasAttribute('required'),
        text: (el.innerText || '').trim().slice(0, 60),
      }));
  });
  record('B_host_page_inventory', { count: hostInventory.length, items: hostInventory });

  // Count Stripe iframes and enumerate them
  const stripeFrames = await page.evaluate(() => {
    const iframes = Array.from(document.querySelectorAll('iframe'));
    return iframes.map(f => ({
      name: f.getAttribute('name'),
      src: (f.getAttribute('src') || '').slice(0, 120),
      title: f.getAttribute('title'),
      allow: f.getAttribute('allow'),
      sandbox: f.getAttribute('sandbox'),
    }));
  });
  record('C_stripe_iframe_inventory', { count: stripeFrames.length, frames: stripeFrames });

  // Try frameLocator on the first Stripe frame
  const stripeFrameLocators = page.locator('iframe[name*="__privateStripeFrame"], iframe[src*="stripe"]');
  const frameCount = await stripeFrameLocators.count();
  record('D_stripe_frame_count', { count: frameCount });

  if (frameCount > 0) {
    try {
      const firstFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();
      // Or try more generic: iframe[src*="stripe"]
      const frameInv = await firstFrame.locator('input, button').all();
      const frameItems = [];
      for (const el of frameInv.slice(0, 20)) {
        frameItems.push({
          tag: await el.evaluate(e => e.tagName),
          placeholder: await el.getAttribute('placeholder'),
          ariaLabel: await el.getAttribute('aria-label'),
          type: await el.getAttribute('type'),
        });
      }
      record('E_stripe_frame_inputs', { count: frameItems.length, items: frameItems });
    } catch (err) {
      record('E_stripe_frame_inputs_ERROR', { error: String(err) });
    }
  }

  // Probe 1: click PAY with empty email → what error surfaces?
  record('F_probe_empty_submit_before', await snapshot(page, '51-before-empty-submit'));
  const payBtn = page.getByRole('button', { name: /^pay\s*\$/i });
  if (await payBtn.count() > 0) {
    await payBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
    record('G_probe_empty_submit_after', await snapshot(page, '52-after-empty-submit'));
    const errors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[role="alert"], .error, [class*="error"], [class*="invalid"], [class*="warning"]'))
        .map(el => ({ text: (el.innerText || '').trim().slice(0, 120), class: el.className?.slice(0, 80) }))
        .filter(x => x.text);
    });
    record('H_errors_after_empty_submit', { count: errors.length, errors });
  }

  // Probe 2: enter invalid email, click PAY
  const emailInput = page.getByLabel(/^email$/i).first();
  if (await emailInput.count() > 0) {
    await emailInput.fill('notanemail');
    await page.waitForTimeout(500);
    if (await payBtn.count() > 0) {
      await payBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
      record('I_probe_bad_email_after', await snapshot(page, '53-bad-email'));
      const emailErrors = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[role="alert"], [class*="error"], [class*="invalid"]'))
          .map(el => (el.innerText || '').trim().slice(0, 120))
          .filter(Boolean);
      });
      record('J_email_validation_errors', { errors: emailErrors });
    }
    // Also check HTML5 validation message
    const htmlValidity = await emailInput.evaluate(el => ({
      valid: el.validity?.valid,
      message: el.validationMessage,
    })).catch(() => null);
    record('K_email_html5_validity', htmlValidity);
  }

  // Probe 3: enter valid email, then try PAY — see what Stripe does (without card info)
  if (await emailInput.count() > 0) {
    await emailInput.fill('test@example.com');
    await page.waitForTimeout(500);
    if (await payBtn.count() > 0) {
      await payBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(4000);
      record('L_probe_valid_email_no_card', await snapshot(page, '54-valid-email-no-card'));
    }
  }

  // Final network log
  record('Z_non_GET_requests', networkLog.slice(-30));

  await browser.close();
  writeFileSync(resolve(__dirname, 'payment-findings.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${resolve(__dirname, 'payment-findings.json')}`);
})();
