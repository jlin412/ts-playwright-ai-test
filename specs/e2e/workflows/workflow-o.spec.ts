import { expect, test } from '../../fixtures';

test.describe('@regression @membership Workflow O — membership & discount flows', () => {
  // ── O.1 (extended): Membership page shows feature items ───────────────
  test('O.1 — membership page shows tier benefits and day pass description', async ({
    membershipPage,
  }) => {
    await membershipPage.goto();
    await membershipPage.expectLoaded();

    await test.step('tiers and prices visible', async () => {
      await membershipPage.expectTiersVisible();
      await membershipPage.expectPricesVisible();
    });

    await test.step('at least one perk description visible', async () => {
      await membershipPage.expectFeatureItemsVisible();
    });

    await test.step('day pass description visible', async () => {
      await membershipPage.expectDayPassDescriptionVisible();
    });
  });

  // ── O.4: Day Pass upsell appears in guest checkout on Tickets tab ──────
  test('O.4 — day pass upsell shown at $18.00 after continuing as guest', async ({
    nowPlayingPage, moviePage, checkoutShowingPage,
  }) => {
    await test.step('enter checkout as guest', async () => {
      await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
      await moviePage.clickFirstShowtime();
      await checkoutShowingPage.expectLoaded();
      await checkoutShowingPage.continueAsGuest();
    });

    await test.step('O.4: DAY PASS upsell visible with $18.00 price', async () => {
      await checkoutShowingPage.expectDayPassUpsell();
    });
  });

  // ── O.6: Invalid promo code shows "code not found" error ──────────────
  // Accessible directly on /checkout/items without a cart session.
  test('O.6 — invalid promo code shows "code not found" error', async ({
    checkoutItemsPage, page,
  }) => {
    await test.step('navigate to food & drink page', async () => {
      await page.goto('https://www.yosemitecinema.com/checkout/items', {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForTimeout(3000);
    });

    await test.step('O.6: apply an invalid code', async () => {
      await checkoutItemsPage.applyPromoCode('INVALID-CODE-XYZ');
    });

    await test.step('O.6: error "code not found" is displayed', async () => {
      await checkoutItemsPage.expectPromoError();
    });
  });
});
