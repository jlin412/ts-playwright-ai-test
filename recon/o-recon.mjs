// Workflow O recon:
// 1. Membership page — find subscription CTAs (O.2)
// 2. Promo code field — enter invalid code, capture error text (O.6)
// Run: node recon/o-recon.mjs

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

async function inv(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .map(el => ({
        tag: el.tagName, text: (el.innerText || '').trim().slice(0, 80),
        href: el.getAttribute('href'), testId: el.getAttribute('data-test-id'),
        ariaLabel: el.getAttribute('aria-label'),
      }))
      .filter(x => x.text || x.href)
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── Membership page deep probe ─────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/membership--guest-pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: resolve(__dirname, 'screenshots', '70-membership.png') });

    record('A_membership_full_body', {
      bodyPreview: (await page.locator('body').innerText()).slice(0, 3000),
    });

    // Scroll and look for CTAs in the bottom of the page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(2000);
    record('A2_membership_mid_scroll', {
      bodyPreview: (await page.locator('body').innerText()).slice(0, 3000),
    });

    // Look for any buttons that could be subscribe/join/select CTAs
    const allInteractive = await inv(page);
    const ctaCandidates = allInteractive.filter(x => {
      const t = (x.text || '').toLowerCase();
      const h = (x.href || '').toLowerCase();
      return /subscribe|join|sign.?up|select|choose|enroll|get.?start|become|start|purchase|buy/i.test(t)
        || /subscribe|signup|join|enroll/i.test(h);
    });
    record('B_membership_cta_candidates', { all: allInteractive.slice(0, 60), ctas: ctaCandidates });

    // Scroll to bottom and check again
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: resolve(__dirname, 'screenshots', '71-membership-bottom.png') });
    record('C_membership_bottom_body', {
      bodyPreview: (await page.locator('body').innerText()).slice(-2000),
    });

    await ctx.close();
  }

  // ── Promo code: invalid code error ────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // Navigate directly to /checkout/items (requires cart session — use fresh context)
    await page.goto(BASE + '/checkout/items', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // The promo code field should be visible even without cart items
    const promoInput = page.getByLabel(/add gift card, voucher, promo code/i);
    const applyBtn = page.getByRole('button', { name: /^apply$/i }).last();

    if (await promoInput.count() > 0) {
      await promoInput.last().fill('INVALID-CODE-XYZ');
      await page.waitForTimeout(500);
      await applyBtn.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: resolve(__dirname, 'screenshots', '72-promo-invalid.png') });

      const body = (await page.locator('body').innerText()).slice(0, 3000);
      const errors = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[role="alert"], [class*="error"], [class*="warning"], .q-notification__message'))
          .map(el => (el.innerText || '').trim().slice(0, 200))
          .filter(Boolean)
      );
      record('D_invalid_promo_result', {
        url: page.url(),
        bodyPreview: body,
        alertsFound: errors,
      });

      // Also try on /checkout/cart directly
      await page.goto(BASE + '/checkout/cart', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);

      const cartPromo = page.getByLabel(/add gift card, voucher, promo code/i);
      if (await cartPromo.count() > 0) {
        await cartPromo.last().fill('INVALID-CODE-XYZ');
        await page.getByRole('button', { name: /^apply$/i }).last().click();
        await page.waitForTimeout(4000);
        await page.screenshot({ path: resolve(__dirname, 'screenshots', '73-promo-cart-invalid.png') });
        const cartErrors = await page.evaluate(() =>
          Array.from(document.querySelectorAll('[role="alert"], [class*="error"], .q-notification__message'))
            .map(el => (el.innerText || '').trim().slice(0, 200))
            .filter(Boolean)
        );
        record('E_invalid_promo_cart_result', {
          url: page.url(),
          bodyPreview: (await page.locator('body').innerText()).slice(0, 2500),
          alertsFound: cartErrors,
        });
      }
    } else {
      record('D_invalid_promo_result', { error: 'Promo input not found on /checkout/items' });
    }

    await ctx.close();
  }

  await browser.close();
  writeFileSync(resolve(__dirname, 'o-findings.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${resolve(__dirname, 'o-findings.json')}`);
})();
