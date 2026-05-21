// Reconnaissance script — NOT a test.
// Map critical conversion paths and where they lead.
// Run with:  node recon/run-recon.mjs
// Output: console JSON + writes recon/findings.json + screenshots/

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SHOTS = resolve(__dirname, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.BASE_URL ?? 'https://www.yosemitecinema.com';

const findings = {
  baseURL: BASE,
  generatedAt: new Date().toISOString(),
  flows: {},
};

function recordFlow(name, data) {
  findings.flows[name] = data;
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(data, null, 2).slice(0, 6000));
}

async function shot(page, name) {
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`), fullPage: false }).catch(() => {});
}

async function inventory(page) {
  return await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a, button, [role="button"]'));
    return els.slice(0, 120).map((el) => ({
      tag: el.tagName,
      text: (el.innerText || '').trim().slice(0, 80),
      href: el.getAttribute('href'),
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
    }));
  });
}

async function captureNavOrPopup(page, triggerFn, label) {
  const context = page.context();
  const popups = [];
  const listener = (p) => popups.push(p);
  context.on('page', listener);

  const beforeURL = page.url();
  const beforeHost = beforeURL.startsWith('http') ? new URL(beforeURL).host : null;

  let navError = null;
  try {
    await triggerFn();
  } catch (err) {
    navError = String(err);
  }

  await page.waitForTimeout(4000);
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 });
  } catch {}

  const afterURL = page.url();
  const samePageNavigated = afterURL !== beforeURL;

  const popupInfo = await Promise.all(
    popups.map(async (p) => {
      try {
        await p.waitForLoadState('domcontentloaded', { timeout: 8000 });
      } catch {}
      return {
        url: p.url(),
        host: p.url().startsWith('http') ? new URL(p.url()).host : null,
        title: await p.title().catch(() => null),
      };
    }),
  );

  context.off('page', listener);

  return {
    label,
    beforeURL,
    beforeHost,
    afterURL,
    afterHost: afterURL.startsWith('http') ? new URL(afterURL).host : null,
    samePageNavigated,
    popups: popupInfo,
    crossOrigin:
      (samePageNavigated && afterURL.startsWith('http') && new URL(afterURL).host !== beforeHost) ||
      popupInfo.some((p) => p.host && p.host !== beforeHost),
    navError,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const externalRequests = new Set();
  context.on('request', (req) => {
    try {
      const host = new URL(req.url()).host;
      const skip = [
        'yosemitecinema.com',
        'gstatic.com',
        'googleapis.com',
        'typekit.net',
        'typekit.com',
        'google-analytics.com',
        'googletagmanager.com',
        'datadoghq.com',
        'rollbar.com',
        'acsbapp.com',
        'imgix.net',
        'doubleclick.net',
        'youtube.com',
        'ytimg.com',
        'fontawesome.com',
      ];
      if (host && !skip.some((s) => host.endsWith(s))) {
        externalRequests.add(host);
      }
    } catch {}
  });

  // ---------- /now-playing inventory ----------
  try {
    await page.goto(BASE + '/now-playing', { waitUntil: 'domcontentloaded' });
    // SPA needs time to mount — match the smoke test's heading-wait pattern
    await page
      .getByRole('heading', { name: /now playing/i })
      .first()
      .waitFor({ state: 'visible', timeout: 25_000 })
      .catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, '01-now-playing');

    const movieAnchors = await page.locator('a[href*="/movie/"]').all();
    const movieHrefs = [];
    for (const a of movieAnchors.slice(0, 10)) {
      movieHrefs.push(await a.getAttribute('href'));
    }
    recordFlow('now_playing_inventory', {
      url: page.url(),
      title: await page.title(),
      movieLinkCount: movieAnchors.length,
      firstTenHrefs: movieHrefs,
    });

    if (movieAnchors.length > 0) {
      const firstHref = await movieAnchors[0].getAttribute('href');
      await movieAnchors[0].click();
      await page.waitForLoadState('domcontentloaded');
      // wait for movie page to mount
      await page
        .locator('main')
        .waitFor({ state: 'visible', timeout: 15_000 })
        .catch(() => {});
      await page.waitForTimeout(3500);
      await shot(page, '02-movie-detail');

      const inv = await inventory(page);
      recordFlow('movie_detail_inventory', {
        followedHref: firstHref,
        url: page.url(),
        title: await page.title(),
        h1: await page.locator('h1').first().innerText().catch(() => null),
        interactiveCount: inv.length,
        interactiveSample: inv,
      });

      // Look for showtime-looking elements: anything with time-of-day text, "Showtime", "Book", "Buy"
      const showtimeProbes = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('a, button, [role="button"]'));
        return all
          .map((el) => ({
            tag: el.tagName,
            text: (el.innerText || '').trim().slice(0, 60),
            href: el.getAttribute('href'),
            role: el.getAttribute('role'),
          }))
          .filter((x) => {
            const t = x.text;
            return (
              /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i.test(t) ||
              /book|buy|ticket|showtime|reserve|select|seats?/i.test(t) ||
              (x.href && /ticket|book|checkout|seat|veezi/i.test(x.href))
            );
          });
      });
      recordFlow('movie_detail_showtime_probes', { count: showtimeProbes.length, items: showtimeProbes });

      if (showtimeProbes.length > 0) {
        // try to click the first one
        const probe = showtimeProbes[0];
        const target = probe.href
          ? page.locator(`a[href="${probe.href}"]`).first()
          : page.getByRole('button', { name: probe.text }).first();

        const click = await captureNavOrPopup(
          page,
          async () => {
            await target.click({ trial: false }).catch(() => {});
          },
          `probe: ${JSON.stringify(probe)}`,
        );
        await shot(page, '03-after-showtime-click');
        recordFlow('movie_showtime_click', click);

        // Inventory whatever surfaced
        const postInv = await inventory(page);
        recordFlow('after_showtime_click_inventory', {
          url: page.url(),
          title: await page.title(),
          h1: await page.locator('h1').first().innerText().catch(() => null),
          interactiveCount: postInv.length,
          interactiveSample: postInv,
        });
      }
    }
  } catch (err) {
    recordFlow('flow_K_ERROR', { error: String(err) });
  }

  // ---------- /membership--guest-pricing ----------
  try {
    const mp = await context.newPage();
    await mp.goto(BASE + '/membership--guest-pricing', { waitUntil: 'domcontentloaded' });
    await mp.waitForTimeout(5000);
    await shot(mp, '04-membership');

    const inv = await inventory(mp);
    const ctaHits = inv.filter((x) =>
      /subscribe|join|sign\s*up|get started|choose|select|enroll|become/i.test(x.text || ''),
    );
    recordFlow('membership_page_inventory', {
      url: mp.url(),
      title: await mp.title(),
      h1: await mp.locator('h1').first().innerText().catch(() => null),
      interactiveCount: inv.length,
      ctaCandidates: ctaHits,
      interactiveSample: inv.slice(0, 40),
    });

    if (ctaHits.length > 0) {
      const target = mp.getByRole('button', { name: new RegExp(`^${ctaHits[0].text.split('\n')[0]}`, 'i') }).first();
      const has = (await target.count()) > 0;
      if (has) {
        const click = await captureNavOrPopup(
          mp,
          async () => {
            await target.click().catch(() => {});
          },
          `cta: "${ctaHits[0].text}"`,
        );
        await shot(mp, '05-after-membership-click');
        recordFlow('membership_cta_click', click);
      }
    }
  } catch (err) {
    recordFlow('flow_O_ERROR', { error: String(err) });
  }

  // ---------- /checkout/items (direct) ----------
  try {
    const cp = await context.newPage();
    await cp.goto(BASE + '/checkout/items', { waitUntil: 'domcontentloaded' });
    await cp.waitForTimeout(5000);
    await shot(cp, '06-checkout-items');
    const inv = await inventory(cp);
    recordFlow('checkout_items_inventory', {
      url: cp.url(),
      title: await cp.title(),
      h1: await cp.locator('h1').first().innerText().catch(() => null),
      interactiveCount: inv.length,
      interactiveSample: inv.slice(0, 40),
      bodyTextPreview: (await cp.locator('body').innerText().catch(() => '')).slice(0, 800),
    });
  } catch (err) {
    recordFlow('checkout_inventory_ERROR', { error: String(err) });
  }

  // ---------- /calendar (showtimes) ----------
  try {
    const cal = await context.newPage();
    await cal.goto(BASE + '/calendar', { waitUntil: 'domcontentloaded' });
    await cal.waitForTimeout(5000);
    await shot(cal, '07-calendar');
    const inv = await inventory(cal);
    recordFlow('calendar_inventory', {
      url: cal.url(),
      title: await cal.title(),
      h1: await cal.locator('h1').first().innerText().catch(() => null),
      interactiveCount: inv.length,
      interactiveSample: inv.slice(0, 60),
    });
  } catch (err) {
    recordFlow('calendar_inventory_ERROR', { error: String(err) });
  }

  recordFlow('external_hosts_observed_filtered', {
    note: 'analytics/CDN/fonts hosts excluded',
    hosts: Array.from(externalRequests).sort(),
  });

  await browser.close();

  const outFile = resolve(__dirname, 'findings.json');
  writeFileSync(outFile, JSON.stringify(findings, null, 2));
  console.log(`\nWrote ${outFile}`);
})();
