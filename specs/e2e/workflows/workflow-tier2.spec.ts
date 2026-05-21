import { expect, test } from '../../fixtures';

// All Tier 2 tests require a member login. Run serially to avoid
// hammering the live SPA with parallel authenticated sessions.
test.describe.configure({ mode: 'serial' });

const EMAIL = process.env.TEST_MEMBER_EMAIL ?? '';
const PASSWORD = process.env.TEST_MEMBER_PASSWORD ?? '';

test.beforeEach(async ({}, testInfo) => {
  if (!EMAIL || !PASSWORD) testInfo.skip();
});

// Helper: login via checkout and return to the page that was set up
async function loginViaCheckout(
  nowPlayingPage: any, moviePage: any,
  checkoutShowingPage: any, authPage: any,
) {
  await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
  await moviePage.clickFirstShowtime();
  await checkoutShowingPage.expectLoaded();
  await authPage.fillAndSubmitLogin(EMAIL, PASSWORD);
  await authPage.expectLoggedIn();
}

// ── T2.1: Account Dashboard ─────────────────────────────────────────────
test('T2.1 — account dashboard shows greeting, all sections, and LOG OUT', async ({
  nowPlayingPage, moviePage, checkoutShowingPage, authPage, accountPage, page,
}) => {
  await test.step('login and navigate to /account', async () => {
    await loginViaCheckout(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await accountPage.goto();
    await accountPage.expectLoaded();
  });

  await test.step('greeting "Hi, [name]" is visible', async () => {
    await expect(accountPage.greeting).toBeVisible();
  });

  await test.step('all dashboard sections are present', async () => {
    await accountPage.expectDashboardSections();
  });

  await test.step('LOG OUT link is visible', async () => {
    await accountPage.expectLogOutVisible();
  });
});

// ── T2.2: Hero Points / Redemptions on cart page ────────────────────────
test('T2.2 — Redemptions section shows Hero Points and redemption tiers in cart', async ({
  nowPlayingPage, moviePage, checkoutShowingPage, authPage,
  checkoutItemsPage, checkoutCartPage,
}) => {
  await test.step('login and add a ticket to cart', async () => {
    await loginViaCheckout(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await checkoutShowingPage.clickFirstTicketTypeAdd();
    await checkoutShowingPage.expectCartTicketCount(1);
    await checkoutShowingPage.clickNextFoodAndDrink();
    await checkoutItemsPage.expectLoaded();
    await checkoutItemsPage.clickNextCart();
    await checkoutCartPage.expectLoaded();
  });

  await test.step('T2.2a: Redemptions section is visible', async () => {
    await checkoutCartPage.expectRedemptionsSectionVisible();
  });

  await test.step('T2.2b: Hero Points balance is displayed', async () => {
    await checkoutCartPage.expectHeroPointsDisplayed();
  });

  await test.step('T2.2c: Redemption tiers listed (Free Ticket, Free Item, Free Popcorn)', async () => {
    await checkoutCartPage.expectRedemptionOptionsListed();
  });
});

// ── T2.3: Bookmark toggle on movie cards ────────────────────────────────
test('T2.3 — bookmark icon toggles from outline to filled and back', async ({
  nowPlayingPage, moviePage, checkoutShowingPage, authPage, page,
}) => {
  await test.step('login and navigate to /now-playing', async () => {
    await loginViaCheckout(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await page.goto('https://www.yosemitecinema.com/now-playing', { waitUntil: 'domcontentloaded' });
    await nowPlayingPage.expectLoaded();
  });

  // Use delta-based assertions: bookmark state persists server-side across runs,
  // so check the CHANGE in count rather than absolute values.
  let outlineBefore = 0;

  await test.step('T2.3a: at least one outline bookmark is visible', async () => {
    await nowPlayingPage.expectAtLeastOneOutlineBookmark();
    outlineBefore = await nowPlayingPage.outlineBookmarks().count();
    expect(outlineBefore).toBeGreaterThan(0);
  });

  await test.step('T2.3b: clicking outline bookmark decreases outline count by 1', async () => {
    await nowPlayingPage.clickFirstOutlineBookmark();
    await expect
      .poll(() => nowPlayingPage.outlineBookmarks().count(), { timeout: 10_000 })
      .toBe(outlineBefore - 1);
  });

  await test.step('T2.3c: clicking the filled bookmark restores outline count', async () => {
    await nowPlayingPage.clickFirstFilledBookmark();
    await expect
      .poll(() => nowPlayingPage.outlineBookmarks().count(), { timeout: 10_000 })
      .toBe(outlineBefore);
  });
});

// ── T2.4: Logout ─────────────────────────────────────────────────────────
test('T2.4 — logging out via the account page clears the member session', async ({
  nowPlayingPage, moviePage, checkoutShowingPage, authPage, accountPage, page,
}) => {
  await test.step('login and navigate to account page', async () => {
    await loginViaCheckout(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await accountPage.goto();
    await accountPage.expectLoaded();
  });

  await test.step('T2.4a: LOG OUT link is present', async () => {
    await accountPage.expectLogOutVisible();
  });

  await test.step('T2.4b: clicking LOG OUT redirects away from /account', async () => {
    await accountPage.logout();
    await expect(page).not.toHaveURL(/\/account/, { timeout: 10_000 });
  });
});

// ── T2.5: Member checkout greeting (O.3 deeper) ──────────────────────────
test('T2.5 — member checkout shows personalised greeting and no guest prompts', async ({
  nowPlayingPage, moviePage, checkoutShowingPage, authPage,
}) => {
  await test.step('login via checkout', async () => {
    await loginViaCheckout(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
  });

  await test.step('T2.5a: member personalised greeting visible', async () => {
    await checkoutShowingPage.expectMemberGreeting();
  });

  await test.step('T2.5b: "Continue As Guest" and "Sign Up" are gone', async () => {
    await expect(authPage.continueAsGuestButton).not.toBeVisible({ timeout: 5_000 });
    await expect(authPage.signUpButton).not.toBeVisible();
  });

  await test.step('T2.5c: My Movies section accessible on account page', async () => {
    await checkoutShowingPage.page.goto('https://www.yosemitecinema.com/account',
      { waitUntil: 'domcontentloaded' });
    await checkoutShowingPage.page.waitForTimeout(3000);
    await expect(checkoutShowingPage.page.getByText('My Movies', { exact: true }).first())
      .toBeVisible({ timeout: 10_000 });
  });
});
