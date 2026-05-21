// Click an actual showtime time button and capture the destination.
// Run: node recon/showtime-click-recon.mjs

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

  // Use a film known to have scheduled showtimes (Experience Yosemite VR)
  await page.goto(BASE + '/movie/7579', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: resolve(__dirname, 'screenshots', '12-experience-yosemite.png') });

  const popups = [];
  ctx.on('page', (p) => popups.push(p));

  // Locate via evaluateHandle — find a button whose innerText matches a time
  const handle = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find((b) => /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i.test((b.innerText || '').trim()));
  });
  const elt = handle.asElement();
  const exists = !!elt;
  const text = exists ? await elt.innerText() : null;

  const beforeURL = page.url();
  if (exists) {
    await elt.scrollIntoViewIfNeeded().catch(() => {});
    await elt.click({ timeout: 5000 }).catch((e) => console.error('click err', e));
  }
  await page.waitForTimeout(6000);
  await page.screenshot({ path: resolve(__dirname, 'screenshots', '13-after-time-click.png') });

  const afterURL = page.url();

  const out = {
    movieURL: page.url(),
    timeButtonFound: exists,
    timeButtonText: text,
    beforeURL,
    afterURL,
    sameTabNavigated: afterURL !== beforeURL,
    popups: await Promise.all(
      popups.map(async (p) => {
        try {
          await p.waitForLoadState('domcontentloaded', { timeout: 5000 });
        } catch {}
        return { url: p.url(), title: await p.title().catch(() => null) };
      }),
    ),
    newH1: await page.locator('h1').first().innerText().catch(() => null),
    newTitle: await page.title(),
    newBodyPreview: (await page.locator('body').innerText().catch(() => '')).slice(0, 2000),
    newInteractive: await page.evaluate(() =>
      Array.from(document.querySelectorAll('a, button, [role="button"], input'))
        .slice(0, 80)
        .map((el) => ({
          tag: el.tagName,
          text: (el.innerText || '').trim().slice(0, 80),
          href: el.getAttribute('href'),
          type: el.getAttribute('type'),
          name: el.getAttribute('name'),
          placeholder: el.getAttribute('placeholder'),
          ariaLabel: el.getAttribute('aria-label'),
        })),
    ),
  };

  await browser.close();
  writeFileSync(resolve(__dirname, 'showtime-findings.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 6000));
})();
