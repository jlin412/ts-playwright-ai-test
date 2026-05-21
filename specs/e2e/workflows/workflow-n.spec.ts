import { expect, test } from '../../fixtures';

// All N tests start by driving through the full K→cart→payment flow.
// Extracted as a helper that receives already-destructured fixtures.
async function reachPaymentPage(
  nowPlayingPage: Awaited<ReturnType<typeof test.extend>>['nowPlayingPage'],
  moviePage: Awaited<ReturnType<typeof test.extend>>['moviePage'],
  checkoutShowingPage: Awaited<ReturnType<typeof test.extend>>['checkoutShowingPage'],
  checkoutItemsPage: Awaited<ReturnType<typeof test.extend>>['checkoutItemsPage'],
  checkoutCartPage: Awaited<ReturnType<typeof test.extend>>['checkoutCartPage'],
  checkoutPaymentPage: Awaited<ReturnType<typeof test.extend>>['checkoutPaymentPage'],
) {
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
  await checkoutCartPage.clickNextPayment();
  await checkoutPaymentPage.expectLoaded();
}

test.describe('@regression @checkout Workflow N — payment form validation', () => {
  test('N.1 — PAY button is disabled on page load', async ({
    nowPlayingPage, moviePage, checkoutShowingPage,
    checkoutItemsPage, checkoutCartPage, checkoutPaymentPage,
  }) => {
    await test.step('reach payment page', async () => {
      await reachPaymentPage(nowPlayingPage, moviePage, checkoutShowingPage,
        checkoutItemsPage, checkoutCartPage, checkoutPaymentPage);
    });
    await test.step('N.1: PAY button is disabled before any card data is entered', async () => {
      await checkoutPaymentPage.expectPayButtonDisabled();
    });
  });

  test('N.2 — email format validation shows inline error', async ({
    nowPlayingPage, moviePage, checkoutShowingPage,
    checkoutItemsPage, checkoutCartPage, checkoutPaymentPage,
  }) => {
    await test.step('reach payment page', async () => {
      await reachPaymentPage(nowPlayingPage, moviePage, checkoutShowingPage,
        checkoutItemsPage, checkoutCartPage, checkoutPaymentPage);
    });
    await test.step('N.2a: invalid email triggers "Not a valid email address" error', async () => {
      await checkoutPaymentPage.fillEmail('notanemail');
      await checkoutPaymentPage.blurEmail();
      await checkoutPaymentPage.expectEmailError();
    });
    await test.step('N.2b: correcting the email clears the error', async () => {
      await checkoutPaymentPage.fillEmail('tester@example.com');
      await checkoutPaymentPage.blurEmail();
      await expect(checkoutPaymentPage.emailError).not.toBeVisible({ timeout: 5_000 });
    });
  });

  test('N.6 — Stripe expiry past-date marks field invalid', async ({
    nowPlayingPage, moviePage, checkoutShowingPage,
    checkoutItemsPage, checkoutCartPage, checkoutPaymentPage,
  }) => {
    await test.step('reach payment page', async () => {
      await reachPaymentPage(nowPlayingPage, moviePage, checkoutShowingPage,
        checkoutItemsPage, checkoutCartPage, checkoutPaymentPage);
    });
    await test.step('N.6: past expiry date sets aria-invalid on the expiry field', async () => {
      await checkoutPaymentPage.fillStripeExpiry('01 / 20');
      await checkoutPaymentPage.expectStripeFieldInvalid('expiry');
    });
  });

  test('N.7 — Stripe CVC incomplete marks field invalid', async ({
    nowPlayingPage, moviePage, checkoutShowingPage,
    checkoutItemsPage, checkoutCartPage, checkoutPaymentPage,
  }) => {
    await test.step('reach payment page', async () => {
      await reachPaymentPage(nowPlayingPage, moviePage, checkoutShowingPage,
        checkoutItemsPage, checkoutCartPage, checkoutPaymentPage);
    });
    await test.step('N.7: single-digit CVC sets aria-invalid on the CVC field', async () => {
      // Fill a valid expiry first so Stripe advances to CVC validation
      await checkoutPaymentPage.fillStripeExpiry('12 / 30');
      await checkoutPaymentPage.fillStripeCvc('1');
      await checkoutPaymentPage.expectStripeFieldInvalid('cvc');
    });
  });
});
