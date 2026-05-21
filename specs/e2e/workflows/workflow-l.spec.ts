import { expect, test } from '../../fixtures';

// Helper: reach /checkout/items with 1 ticket in cart
async function reachFoodPage(
  nowPlayingPage: any, moviePage: any,
  checkoutShowingPage: any, checkoutItemsPage: any,
) {
  await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
  await moviePage.clickFirstShowtime();
  await checkoutShowingPage.expectLoaded();
  await checkoutShowingPage.continueAsGuest();
  await checkoutShowingPage.clickFirstTicketTypeAdd();
  await checkoutShowingPage.expectCartTicketCount(1);
  await checkoutShowingPage.clickNextFoodAndDrink();
  await checkoutItemsPage.expectLoaded();
}

test.describe('@regression @concessions Workflow L — food & drink ordering', () => {
  test('L.2 — required modifier: Sodas dialog opens and shows required-flavour warning', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, checkoutItemsPage,
  }) => {
    await test.step('reach food & drink page', async () => {
      await reachFoodPage(nowPlayingPage, moviePage, checkoutShowingPage, checkoutItemsPage);
    });

    await test.step('L.2a: clicking Add on Sodas opens the modifier dialog', async () => {
      await checkoutItemsPage.openItemDialog('Sodas');
      await checkoutItemsPage.expectDialogOpen();
    });

    await test.step('L.2b: Soda Flavors group shows "Required — choose below" warning', async () => {
      await checkoutItemsPage.expectRequiredWarningVisible();
    });

    await test.step('L.2c: clicking ADD without selecting a flavour keeps the dialog open', async () => {
      await checkoutItemsPage.tryAddWithoutRequired();
      await checkoutItemsPage.expectDialogOpen();
    });
  });

  test('L.3 — modifier affects price: selecting a different Sodas size updates the dialog total', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, checkoutItemsPage,
  }) => {
    await test.step('reach food & drink page and open Sodas dialog', async () => {
      await reachFoodPage(nowPlayingPage, moviePage, checkoutShowingPage, checkoutItemsPage);
      await checkoutItemsPage.openItemDialog('Sodas');
    });

    await test.step('L.3a: default selection shows Small price', async () => {
      const total = await checkoutItemsPage.dialogTotal();
      expect(total, 'default Sodas total should be > 0').toBeGreaterThan(0);
    });

    await test.step('L.3b: selecting Medium changes the total', async () => {
      const before = await checkoutItemsPage.dialogTotal();
      await checkoutItemsPage.selectDialogOption('Medium');
      const after = await checkoutItemsPage.dialogTotal();
      expect(after, 'Medium total should differ from Small total').not.toBe(before);
      expect(after).toBeGreaterThan(before); // Medium costs more
    });
  });

  test('L.3c — completing required modifiers and confirming adds item to cart', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, checkoutItemsPage,
  }) => {
    await test.step('reach food & drink page and open Sodas dialog', async () => {
      await reachFoodPage(nowPlayingPage, moviePage, checkoutShowingPage, checkoutItemsPage);
      await checkoutItemsPage.openItemDialog('Sodas');
    });

    await test.step('select required Soda Flavour', async () => {
      await checkoutItemsPage.selectDialogOption('Coke');
      await checkoutItemsPage.expectRequiredWarningGone();
    });

    await test.step('confirm adds Sodas to the food cart', async () => {
      await checkoutItemsPage.confirmDialog();
      await checkoutItemsPage.expectDialogClosed();
      // Cart sidebar should now contain a Sodas line
      await expect(checkoutItemsPage.foodCartLine('Sodas')).toBeVisible({ timeout: 10_000 });
    });
  });

  test('L.5 — adding multiple simple items creates separate cart lines', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, checkoutItemsPage,
  }) => {
    await test.step('reach food & drink page', async () => {
      await reachFoodPage(nowPlayingPage, moviePage, checkoutShowingPage, checkoutItemsPage);
    });

    await test.step('add first simple item (Skittles)', async () => {
      await checkoutItemsPage.addSimpleItem('Skittles');
      await checkoutItemsPage.checkFoodCartCount(1);
    });

    await test.step('add second simple item (Milk Duds)', async () => {
      await checkoutItemsPage.addSimpleItem('Milk Duds');
      await checkoutItemsPage.checkFoodCartCount(2);
    });
  });
});
