import { expect, test } from '../../fixtures';

const BASE = 'https://www.yosemitecinema.com';

test.describe('@regression @browse Workflows A–J — informational pages & navigation', () => {
  // ── Workflow A: Browse & view a movie detail page ──────────────────────
  test('A — movie detail page loads with title and showtime section', async ({
    nowPlayingPage, moviePage,
  }) => {
    await nowPlayingPage.goto();
    await nowPlayingPage.expectLoaded();

    const hrefs = await nowPlayingPage.movieHrefs(1);
    expect(hrefs.length, 'now-playing should list at least one movie').toBeGreaterThan(0);

    const url = hrefs[0].startsWith('http') ? hrefs[0] : new URL(hrefs[0], BASE).toString();
    await moviePage.goto(url);
    await expect(moviePage.h1).toBeVisible({ timeout: 15_000 });

    // Structural assertion: either showtimes OR "Nothing Scheduled" is present
    const hasShowtimes = (await moviePage.showtimeButtons().count()) > 0;
    const hasNothing = (await moviePage.nothingScheduled.count()) > 0;
    expect(hasShowtimes || hasNothing, 'movie page must show showtimes or nothing-scheduled').toBe(true);
  });

  // ── Workflow B: Coming Soon page ──────────────────────────────────────
  // Note: coming-soon content is volatile — may show 0 films when all
  // announced films have started playing. Test asserts the page loads.
  test('B — coming soon page loads correctly', async ({ comingSoonPage }) => {
    await comingSoonPage.goto();
    await comingSoonPage.expectLoaded();
    await comingSoonPage.expectPageFunctional();
  });

  // ── Workflow C: Calendar / Showtimes ──────────────────────────────────
  test('C — calendar page loads with showtime content', async ({ calendarPage }) => {
    await calendarPage.goto();
    await calendarPage.expectLoaded();
    await calendarPage.expectCalendarContentPresent();
  });

  // ── Workflow D: Membership pricing ────────────────────────────────────
  test('D — membership page shows all three tiers and day pass price', async ({
    membershipPage,
  }) => {
    await membershipPage.goto();
    await membershipPage.expectLoaded();
    await membershipPage.expectTiersVisible();
    await membershipPage.expectPricesVisible();
    await membershipPage.expectDayPassVisible();
  });

  // ── Workflow E: VR experience page ────────────────────────────────────
  test('E — VR page mentions Experience Yosemite, Bryan Cranston, and Positron', async ({
    vrExperiencePage,
  }) => {
    await vrExperiencePage.goto();
    await vrExperiencePage.expectLoaded();
    await vrExperiencePage.expectKeyContent();
  });

  // ── Workflow F: Our Story page ────────────────────────────────────────
  test('F — our story page shows team members and media mentions', async ({
    ourStoryPage,
  }) => {
    await ourStoryPage.goto();
    await ourStoryPage.expectLoaded();
    await ourStoryPage.expectTeamVisible();
    await ourStoryPage.expectMediaMentions();
  });

  // ── Workflow G: Contact page ──────────────────────────────────────────
  test('G — contact page shows support email and phone number', async ({
    contactPage,
  }) => {
    await contactPage.goto();
    await contactPage.expectLoaded();
    await contactPage.expectContactInfo();
  });

  // ── Workflow H: Navigation menu integrity ────────────────────────────
  // Nav links display as uppercase via CSS but their accessible names are
  // title-case ("Showtimes", "Coming Soon") — use case-insensitive matching.
  test.describe('H — navigation menu links', () => {
    const navCases = [
      { name: /^showtimes$/i, urlPattern: /\/calendar/, heading: /calendar/i },
      { name: /^coming soon$/i, urlPattern: /\/coming-soon/, heading: /coming soon/i },
    ];

    for (const { name, urlPattern, heading } of navCases) {
      test(`H — nav "${name.source}" goes to the correct page`, async ({ homePage, page }) => {
        await homePage.goto();
        await homePage.expectLoaded();
        await page.getByRole('link', { name }).first().click();
        await expect(page).toHaveURL(urlPattern, { timeout: 15_000 });
        await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
      });
    }
  });

  // ── Workflow I: Showtime boundary ────────────────────────────────────
  test('I — showtime click leads to the same-origin /checkout/showing route', async ({
    nowPlayingPage, moviePage, page,
  }) => {
    await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
    await moviePage.clickFirstShowtime();
    await expect(page).toHaveURL(/\/checkout\/showing\/[^/]+\/\d+/, { timeout: 20_000 });
  });

  // ── Workflow J: Unknown route handling ───────────────────────────────
  // The SPA redirects unknown routes to /now-playing (not a 404 page).
  // Assert: the site gracefully handles unknown routes (no blank/error page,
  // the URL changes away from the unknown path).
  test('J — unknown route is handled gracefully (redirects to a known page)', async ({ page }) => {
    const unknownPath = '/this-route-does-not-exist-xyz-abc-123';
    await page.goto(unknownPath, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const url = page.url();

    // Site should NOT stay on the unknown path
    expect(url, 'unknown route should redirect away from the original path').not.toContain(unknownPath);

    // Site should land on a recognisable yosemitecinema.com route
    expect(url, 'should redirect to a known yosemitecinema.com page').toContain('yosemitecinema.com');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
  });
});
