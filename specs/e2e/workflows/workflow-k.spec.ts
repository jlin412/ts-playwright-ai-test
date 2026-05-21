import { expect, test } from '../../fixtures';

test.describe('@regression @purchase Workflow K — ticket purchase', () => {
  test('K phase 1 — movie → showtime click → checkout-showing page mounts with all tabs', async ({
    nowPlayingPage,
    moviePage,
    checkoutShowingPage,
  }) => {
    // K.1 — pick a movie from /now-playing that has scheduled showtimes
    const movieURL = await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
    expect(movieURL).toMatch(/\/movie\//);

    // K.2 — click the first available showtime
    await moviePage.clickFirstShowtime();

    // Land on the checkout-showing route (URL pattern: /checkout/showing/{slug}/{showtime-id})
    await checkoutShowingPage.expectLoaded();

    // All 4 stepper tabs render
    await checkoutShowingPage.expectAllTabsRendered();

    // Guest checkout entry is available
    await checkoutShowingPage.expectGuestEntryAvailable();
  });

  test('K phase 2 — guest can add multiple tickets and advance to Food & Drink', async ({
    nowPlayingPage,
    moviePage,
    checkoutShowingPage,
    checkoutItemsPage,
  }) => {
    // K.1+K.2 — enter checkout from a scheduled showtime
    await test.step('enter checkout from first scheduled showtime', async () => {
      await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
      await moviePage.clickFirstShowtime();
      await checkoutShowingPage.expectLoaded();
    });

    // Continue as guest
    await test.step('continue as guest', async () => {
      await checkoutShowingPage.continueAsGuest();
    });

    // K.4a — add first ticket type once → cart shows 1 ticket
    await test.step('K.4a: add first ticket type, expect 1 ticket in cart', async () => {
      await checkoutShowingPage.clickFirstTicketTypeAdd();
      await checkoutShowingPage.expectCartTicketCount(1);
    });

    // K.4b — add same ticket type again → cart shows 2 tickets
    await test.step('K.4b: add same ticket type again, expect 2 tickets', async () => {
      await checkoutShowingPage.clickFirstTicketTypeAdd();
      await checkoutShowingPage.expectCartTicketCount(2);
    });

    // K.5 — advance to Food & Drink, cart summary persists
    await test.step('K.5: click NEXT: FOOD & DRINK, land on /checkout/items', async () => {
      await checkoutShowingPage.clickNextFoodAndDrink();
      await checkoutItemsPage.expectLoaded();
      await checkoutItemsPage.expectCartTicketCount(2);
    });
  });
});
