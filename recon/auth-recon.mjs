// Recon: what does the checkout page look like after a successful member login?
// Run: node recon/auth-recon.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? 'https://www.yosemitecinema.com';
const EMAIL = process.env.TEST_MEMBER_EMAIL;
const PASSWORD = process.env.TEST_MEMBER_PASSWORD;
const out = { baseURL: BASE, generatedAt: new Date().toISOString(), steps: {} };

function record(name, data) {
  out.steps[name] = data;
  console.log(`\n=== ${name} ===\n${JSON.stringify(data, null, 2).slice(0, 3000)}\n`);
}

async function snap(page, label) {
  await page.screenshot({ path: resolve(__dirname, 'screenshots', `${label}.png`) }).catch(() => {});
  return {
    url: page.url(),
    title: await page.title(),
    bodyPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 3000),
  };
}

async function inv(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a, input, [role="button"]'))
      .slice(0, 80)
      .map(el => ({
        tag: el.tagName, text: (el.innerText || '').trim().slice(0, 60),
        type: el.getAttribute('type'), href: el.getAttribute('href'),
        ariaLabel: el.getAttribute('aria-label'), testId: el.getAttribute('data-test-id'),
        placeholder: el.getAttribute('placeholder'),
      }))
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Step 1: reach the Tickets tab (checkout showing page)
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
  record('A_movie_selected', { url: page.url() });

  const th = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll('button')).find(b =>
      /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim())));
  await th.asElement().click();
  await page.waitForURL(/\/checkout\/showing\//, { timeout: 15_000 });
  await page.waitForTimeout(4000);
  record('B_before_login', await snap(page, '80-before-login'));

  // Step 2: login with member credentials
  const emailField = page.getByLabel('Email').first();
  const passwordField = page.getByLabel('Password').first();
  const loginBtn = page.getByRole('button', { name: /^log in$/i });

  if (await emailField.count() > 0) {
    await emailField.fill(EMAIL);
    await passwordField.fill(PASSWORD);
    await loginBtn.click();
    await page.waitForTimeout(6000); // allow auth redirect / SPA update
    await page.screenshot({ path: resolve(__dirname, 'screenshots', '81-after-login.png') });
    record('C_after_login', await snap(page, '81-after-login'));
    record('C2_after_login_inventory', { items: await inv(page) });
  } else {
    record('C_after_login', { error: 'Email field not found on checkout page' });
  }

  // Step 3: look for ticket types + pricing as a member
  const ticketInfo = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    return all
      .map(el => (el.innerText || '').trim())
      .filter(t => t.length > 0 && t.length < 200 &&
        (/\$\d+|\bfree\b|included|member|adult|child|senior|vr/i.test(t)))
      .slice(0, 30);
  });
  record('D_member_ticket_info', { items: ticketInfo });

  // Step 4: look for logout option anywhere
  const logoutLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a, button, [role="button"]'))
      .map(el => ({ text: (el.innerText || '').trim().slice(0, 60), href: el.getAttribute('href') }))
      .filter(x => /log.?out|sign.?out/i.test(x.text || '') || /logout|signout/i.test(x.href || ''))
  );
  record('E_logout_options', { items: logoutLinks });

  // Step 5: check for member name / account indicator
  const memberIndicators = await page.evaluate(() =>
    Array.from(document.querySelectorAll('*'))
      .map(el => (el.innerText || '').trim())
      .filter(t => t.includes('@') || /hero.?points|welcome|my account|member/i.test(t))
      .filter(t => t.length < 100)
      .slice(0, 10)
  );
  record('F_member_indicators', { items: memberIndicators });

  // Step 6: try to advance as member — what does the checkout look like?
  const nextBtn = page.getByRole('button', { name: /next.*food|continue/i });
  if (await nextBtn.count() > 0) {
    const btnText = await nextBtn.first().innerText();
    record('G_next_button_as_member', { text: btnText });
  } else {
    // Look for any progression button
    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .map(b => (b.innerText || '').trim())
        .filter(t => t.length > 2)
    );
    record('G_all_buttons_visible', { buttons: allBtns });
  }

  // Step 7: also test the bad-password flow
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  await page2.goto(BASE + '/now-playing', { waitUntil: 'domcontentloaded' });
  await page2.getByRole('heading', { name: /now playing/i }).first().waitFor({ timeout: 30_000 });
  await page2.waitForFunction(() => document.querySelectorAll('a[href*="/movie/"]').length > 0, { timeout: 30_000 });
  const hrefs2 = await page2.$$eval('a[href*="/movie/"]', els =>
    Array.from(new Set(els.map(e => e.getAttribute('href')).filter(Boolean))).slice(0, 12));
  for (const href of hrefs2) {
    const url = href.startsWith('http') ? href : new URL(href, BASE).toString();
    await page2.goto(url, { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(4000);
    const ok2 = await page2.evaluate(() => Array.from(document.querySelectorAll('button'))
      .some(b => /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim())));
    if (ok2) break;
  }
  const th2 = await page2.evaluateHandle(() =>
    Array.from(document.querySelectorAll('button')).find(b =>
      /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim())));
  await th2.asElement().click();
  await page2.waitForURL(/\/checkout\/showing\//, { timeout: 15_000 });
  await page2.waitForTimeout(4000);

  const ef2 = page2.getByLabel('Email').first();
  const pf2 = page2.getByLabel('Password').first();
  if (await ef2.count() > 0) {
    await ef2.fill(EMAIL);
    await pf2.fill('WRONGPASSWORD123!');
    await page2.getByRole('button', { name: /^log in$/i }).click();
    await page2.waitForTimeout(4000);
    await page2.screenshot({ path: resolve(__dirname, 'screenshots', '82-wrong-password.png') });
    const errText = await page2.evaluate(() =>
      Array.from(document.querySelectorAll('[role="alert"], [class*="error"], .q-notification__message'))
        .map(el => (el.innerText || '').trim().slice(0, 200)).filter(Boolean)
    );
    const bodyPreview = (await page2.locator('body').innerText()).slice(0, 2000);
    record('H_wrong_password_result', { errors: errText, bodyPreview });
  }

  await browser.close();
  writeFileSync(resolve(__dirname, 'auth-findings.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${resolve(__dirname, 'auth-findings.json')}`);
})();
