// Focused recon — movie detail page + showtime click flow.
// Run: node recon/movie-detail-recon.mjs

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? 'https://www.yosemitecinema.com';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const out = {};
  const externalHosts = new Set();
  ctx.on('request', (req) => {
    try {
      const h = new URL(req.url()).host;
      if (h && !h.endsWith('yosemitecinema.com')) externalHosts.add(h);
    } catch {}
  });

  // Step 1: load /now-playing, wait for heading, then for movie links
  await page.goto(BASE + '/now-playing', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /now playing/i }).first().waitFor({ timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelectorAll('a[href*="/movie/"]').length > 0,
    { timeout: 30_000 },
  );

  const hrefs = await page.$$eval('a[href*="/movie/"]', (els) =>
    Array.from(new Set(els.map((e) => e.getAttribute('href')))).slice(0, 15),
  );
  out.now_playing_movie_hrefs = hrefs;

  // Step 2: navigate to first movie detail page
  const firstHref = hrefs[0];
  const movieURL = firstHref.startsWith('http') ? firstHref : new URL(firstHref, BASE).toString();
  await page.goto(movieURL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000); // generous SPA mount time
  await page.screenshot({ path: resolve(__dirname, 'screenshots', '10-movie-detail.png') });

  out.movie_detail = {
    url: page.url(),
    title: await page.title(),
    h1: await page.locator('h1').first().innerText().catch(() => null),
    bodyTextPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 1500),
  };

  // Inventory ALL interactive elements on movie detail page
  const inv = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, [role="button"]')).map((el) => ({
      tag: el.tagName,
      text: (el.innerText || '').trim().slice(0, 80),
      href: el.getAttribute('href'),
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      cls: el.getAttribute('class')?.slice(0, 60),
    }));
  });
  out.movie_detail_interactive_full = inv;

  // Find candidate showtime elements: time format, "book", "buy", "ticket", or non-nav anchors
  const showtimes = inv.filter((x) => {
    const t = (x.text || '').toLowerCase();
    const navTexts = ['showtimes', 'coming soon', 'virtual reality', 'members', 'view next showings', 'accept & dismiss', 'cookie policy.', 'privacy policy', 'community', 'private rentals', 'contact us', 'gift cards', 'advertise', 'faq page'];
    if (navTexts.some((n) => t === n.toLowerCase())) return false;
    return (
      /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i.test(x.text) ||
      /book|buy|ticket|showtime|reserve|seat|select|add to cart|order/i.test(t)
    );
  });
  out.movie_detail_showtime_candidates = showtimes;

  // Try clicking the first candidate
  if (showtimes.length > 0) {
    const target = showtimes[0];
    let locator;
    if (target.href) {
      locator = page.locator(`a[href="${target.href}"]`).first();
    } else {
      locator = page.locator(`button:has-text("${target.text.split('\n')[0].slice(0, 40)}")`).first();
    }

    const popups = [];
    ctx.on('page', (p) => popups.push(p));

    const beforeURL = page.url();
    try {
      await locator.click({ timeout: 5000 });
    } catch (e) {
      out.click_error = String(e);
    }
    await page.waitForTimeout(5000);
    await page.screenshot({ path: resolve(__dirname, 'screenshots', '11-after-showtime-click.png') });

    out.click_result = {
      target,
      beforeURL,
      afterURL: page.url(),
      sameTabNavigated: page.url() !== beforeURL,
      popups: await Promise.all(
        popups.map(async (p) => {
          try {
            await p.waitForLoadState('domcontentloaded', { timeout: 5000 });
          } catch {}
          return { url: p.url(), title: await p.title().catch(() => null) };
        }),
      ),
      newH1: await page.locator('h1').first().innerText().catch(() => null),
      newBodyPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 800),
    };

    // Inventory after-click page
    const postInv = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a, button, [role="button"]'))
        .slice(0, 80)
        .map((el) => ({
          tag: el.tagName,
          text: (el.innerText || '').trim().slice(0, 60),
          href: el.getAttribute('href'),
        })),
    );
    out.after_click_interactive_sample = postInv;
  }

  out.external_hosts_observed = Array.from(externalHosts).sort();

  await browser.close();

  writeFileSync(resolve(__dirname, 'movie-findings.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})();
