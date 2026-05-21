import { expect, test } from '../../fixtures';

test.describe('@regression @cart Workflow M — cart validation', () => {
  test('M.1 — on the cart page, grand total equals the sum of line totals', async ({
    nowPlayingPage,
    moviePage,
    checkoutShowingPage,
    checkoutItemsPage,
    checkoutCartPage,
  }) => {
    await test.step('enter checkout, add one ticket, advance to cart', async () => {
      await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
      await moviePage.clickFirstShowtime();
      await checkoutShowingPage.expectLoaded();
      await checkoutShowingPage.continueAsGuest();
      await checkoutShowingPage.clickFirstTicketTypeAdd();
      await checkoutShowingPage.expectCartTicketCount(1);
      await checkoutShowingPage.clickNextFoodAndDrink();
      await checkoutItemsPage.expectLoaded();
      await checkoutItemsPage.clickNextCart();
      await checkoutCartPage.expectLoaded();
    });

    await test.step('grand total matches sum of line totals', async () => {
      await checkoutCartPage.checkTotalsMatch();
      const lines = await checkoutCartPage.readLineTotals();
      const grand = await checkoutCartPage.readGrandTotal();
      expect(lines.length).toBeGreaterThan(0);
      expect(grand).toBeGreaterThan(0);
    });
  });

  test('M.2 — cart total reactively updates when a ticket is added', async ({
    nowPlayingPage,
    moviePage,
    checkoutShowingPage,
  }) => {
    await test.step('enter checkout as guest', async () => {
      await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
      await moviePage.clickFirstShowtime();
      await checkoutShowingPage.expectLoaded();
      await checkoutShowingPage.continueAsGuest();
    });

    // Capture cart summary $ after first add → V1
    await checkoutShowingPage.clickFirstTicketTypeAdd();
    await checkoutShowingPage.expectCartTicketCount(1);
    const v1 = await checkoutShowingPage.readCartSummaryDollars();
    expect(v1, 'cart summary should show a dollar value after first add').toBeGreaterThan(0);

    // Capture cart summary $ after second add → V2
    await checkoutShowingPage.clickFirstTicketTypeAdd();
    await checkoutShowingPage.expectCartTicketCount(2);
    const v2 = await checkoutShowingPage.readCartSummaryDollars();
    expect(v2, 'cart summary should increase after adding a second ticket').toBeGreaterThan(v1);
  });

  test('M.4 — reload on /checkout/cart clears the cart and redirects home', async ({
    nowPlayingPage,
    moviePage,
    checkoutShowingPage,
    checkoutItemsPage,
    checkoutCartPage,
    page,
  }) => {
    await test.step('reach cart with a ticket added', async () => {
      await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
      await moviePage.clickFirstShowtime();
      await checkoutShowingPage.expectLoaded();
      await checkoutShowingPage.continueAsGuest();
      await checkoutShowingPage.clickFirstTicketTypeAdd();
      await checkoutShowingPage.clickNextFoodAndDrink();
      await checkoutItemsPage.clickNextCart();
      await checkoutCartPage.expectLoaded();
    });

    const beforeReloadTotal = await checkoutCartPage.readGrandTotal();
    expect(beforeReloadTotal, 'cart should have non-zero total before reload').toBeGreaterThan(0);

    // M.4 — contract: reload should NOT preserve cart state
    await checkoutCartPage.reload();

    // After reload, the SPA redirects to /
    await expect(page).toHaveURL(/yosemitecinema\.com\/?$/, { timeout: 10_000 });
    // Cart is empty — "Your Cart is Empty" renders in both complementary AND main panels
    await expect(page.getByText(/your cart is empty/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
