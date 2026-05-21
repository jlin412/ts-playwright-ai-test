// Tier 2 recon: full post-login member state mapping
// Covers: ticket pricing, Hero Points, Redemptions, Members nav, bookmarks, account pages
// Run: node recon/tier2-recon.mjs
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
const out = { generatedAt: new Date().toISOString(), steps: {} };

function record(name, data) {
  out.steps[name] = data;
  console.log(`\n=== ${name} ===\n${JSON.stringify(data, null, 2).slice(0, 2500)}\n`);
}

async function snap(page, label) {
  await page.screenshot({ path: resolve(__dirname, 'screenshots', `${label}.png`) });
  return {
    url: page.url(),
    bodyPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 3000),
  };
}

async function inv(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .map(el => ({
        tag: el.tagName,
        text: (el.innerText || '').trim().slice(0, 80),
        href: el.getAttribute('href'),
        testId: el.getAttribute('data-test-id'),
      }))
      .filter(x => x.text || x.href)
  );
}

async function acceptCookies(page) {
  const btn = page.getByRole('button', { name: /accept\s*&\s*dismiss/i });
  if (await btn.first().isVisible({ timeout: 2000 }).catch(() => false)) await btn.first().click().catch(() => {});
}

async function loginOnCheckoutPage(page) {
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
  await th.asElement().click();
  await page.waitForURL(/\/checkout\/showing\//, { timeout: 15_000 });
  await page.waitForTimeout(4000);
  await acceptCookies(page);
  await page.getByLabel('Email').first().fill(EMAIL);
  await page.getByLabel('Password').first().fill(PASSWORD);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForTimeout(5000);
  const body = await page.locator('body').innerText();
  if (body.includes('Incorrect email or password')) throw new Error('Login failed');
  return page.url();
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── A: Tickets tab as member ──────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const showingUrl = await loginOnCheckoutPage(page);
    record('A_logged_in_url', { url: showingUrl });
    record('A_tickets_tab_member', await snap(page, '90-member-tickets'));

    // Capture all ticket-related text
    const ticketInfo = await page.evaluate(() => {
      const allText = Array.from(document.querySelectorAll('*'))
        .map(el => (el.innerText || '').trim())
        .filter(t => t.length > 0 && t.length < 300 &&
          /\$\d|\bfree\b|\bmember\b|\bvr\b|\badult\b|\bchild\b|\bhero\s*point/i.test(t))
        .slice(0, 40);
      return [...new Set(allText)];
    });
    record('A_member_ticket_info', { items: ticketInfo });

    // Compare: does it show ADD buttons (member pays) or "Included" type text?
    const addBtns = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
        .filter(b => (b.innerText || '').trim().toUpperCase() === 'ADD' && !b.disabled);
      return btns.map(b => {
        let p = b.parentElement;
        for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
          const t = (p.innerText || '').trim();
          if (t.length < 300) return t;
        }
        return '';
      });
    });
    record('A_add_buttons_context', { count: addBtns.length, contexts: addBtns });

    // Is Day Pass shown for a member?
    const hasDayPass = (await page.locator('body').innerText()).includes('DAY PASS');
    record('A_day_pass_shown', { hasDayPass });

    // ── Add a ticket and check cart as member ────────────────────────────
    await page.evaluate(() => {
      const adds = Array.from(document.querySelectorAll('button'))
        .filter(b => (b.innerText || '').trim().toUpperCase() === 'ADD' && !b.disabled);
      // For member, skip Day Pass (index 0 if present) and click first ticket type
      const target = adds.length > 1 ? adds[1] : adds[0];
      target?.click();
    });
    await page.waitForTimeout(3500);
    record('A2_cart_after_member_add', await snap(page, '91-member-cart-after-add'));

    // Advance to cart
    const nextFoodBtn = page.getByRole('button', { name: /^next:\s*food\s*&\s*drink$/i });
    if (await nextFoodBtn.count() > 0) {
      await nextFoodBtn.click();
      await page.waitForURL(/\/checkout\/items/, { timeout: 15_000 });
      await page.waitForTimeout(3000);
      const nextCartBtn = page.getByRole('button', { name: /^next:\s*cart$/i });
      if (await nextCartBtn.count() > 0) {
        await nextCartBtn.click();
        await page.waitForURL(/\/checkout\/cart/, { timeout: 15_000 });
        await page.waitForTimeout(3000);
        record('A3_cart_page_member', await snap(page, '92-member-cart-page'));

        // Check for Hero Points / Redemptions section
        const redemptions = await page.evaluate(() => {
          const all = Array.from(document.querySelectorAll('*'));
          return all
            .map(el => (el.innerText || '').trim())
            .filter(t => /redemption|hero.?point|free.?(ticket|item|popcorn)/i.test(t) && t.length < 300)
            .slice(0, 15);
        });
        record('A4_redemptions_info', { items: redemptions });
      }
    }
    await ctx.close();
  }

  // ── B: Members nav dropdown ──────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // Login first via checkout, then navigate to home
    await loginOnCheckoutPage(page);
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await acceptCookies(page);
    record('B_home_after_login', await snap(page, '93-home-logged-in'));

    // Click Members dropdown
    const membersBtn = page.getByRole('button', { name: /^members/i });
    if (await membersBtn.count() > 0) {
      await membersBtn.click();
      await page.waitForTimeout(2000);
      record('B_members_dropdown', await snap(page, '94-members-dropdown'));
      record('B_members_inventory', { items: await inv(page) });
    }

    // Check for account link
    const accountLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a, button'))
        .map(el => ({ text: (el.innerText || '').trim().slice(0, 60), href: el.getAttribute('href') }))
        .filter(x => /account|profile|dashboard|my.?(order|ticket|history|subscription)|logout|sign.?out/i.test(x.text || x.href || ''))
    );
    record('B_account_links', { items: accountLinks });
    await ctx.close();
  }

  // ── C: Bookmark / favourite on movie cards ───────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginOnCheckoutPage(page);
    await page.goto(BASE + '/now-playing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await acceptCookies(page);
    await page.screenshot({ path: resolve(__dirname, 'screenshots', '95-now-playing-logged-in.png') });

    // Find bookmark/star/heart icon buttons
    const iconBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .map(el => ({
          text: (el.innerText || '').trim().slice(0, 60),
          ariaLabel: el.getAttribute('aria-label'),
          img: el.querySelector('img')?.getAttribute('src') ?? null,
        }))
        .filter(x => /bookmark|star|favorite|heart|wish/i.test(x.text || x.ariaLabel || ''))
    );
    record('C_bookmark_buttons', { count: iconBtns.length, items: iconBtns.slice(0, 10) });

    // Click first bookmark button and see what changes
    if (iconBtns.length > 0) {
      const firstBookmark = page.getByRole('button').filter({ hasText: /bookmark/i }).first();
      if (await firstBookmark.count() > 0) {
        const before = await firstBookmark.innerText();
        await firstBookmark.click();
        await page.waitForTimeout(2000);
        const after = await firstBookmark.innerText().catch(() => 'gone');
        record('C_bookmark_toggle', { before, after, url: page.url() });
        await page.screenshot({ path: resolve(__dirname, 'screenshots', '96-after-bookmark.png') });
      }
    }
    await ctx.close();
  }

  // ── D: Account/profile page ──────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginOnCheckoutPage(page);

    // Try common account URLs
    const accountUrls = ['/account', '/profile', '/my-account', '/dashboard', '/user', '/member'];
    for (const path of accountUrls) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const url = page.url();
      const body = (await page.locator('body').innerText()).slice(0, 500);
      if (!url.endsWith('/') && !url.includes('/now-playing') && !url.includes('/404')) {
        record(`D_account_path_${path.replace('/', '')}`, { url, bodyPreview: body });
      }
    }
    await ctx.close();
  }

  await browser.close();
  writeFileSync(resolve(__dirname, 'tier2-findings.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${resolve(__dirname, 'tier2-findings.json')}`);
})();
