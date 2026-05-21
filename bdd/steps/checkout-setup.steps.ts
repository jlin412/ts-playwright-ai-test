import { createBdd } from 'playwright-bdd';
import { test } from './fixtures';

const { Given } = createBdd(test);

// Composite Givens that chain multiple POMs to set up a checkout state.
// Lives here (not on a single POM) because each step touches several fixtures.

Given('I am on the Food & Drink page as a guest with one ticket', async ({
  nowPlayingPage, moviePage, checkoutShowingPage,
}) => {
  await nowPlayingPage.goto();
  await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
  await moviePage.clickFirstShowtime();
  await checkoutShowingPage.continueAsGuest();
  await checkoutShowingPage.clickFirstTicketTypeAdd();
  await checkoutShowingPage.clickNextFoodAndDrink();
});

Given('I am on the payment page as a guest with one ticket in cart', async ({
  nowPlayingPage, moviePage, checkoutShowingPage, checkoutItemsPage, checkoutCartPage,
}) => {
  await nowPlayingPage.goto();
  await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
  await moviePage.clickFirstShowtime();
  await checkoutShowingPage.continueAsGuest();
  await checkoutShowingPage.clickFirstTicketTypeAdd();
  await checkoutShowingPage.clickNextFoodAndDrink();
  await checkoutItemsPage.clickNextCart();
  await checkoutCartPage.clickNextPayment();
});
