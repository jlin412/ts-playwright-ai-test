import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then, When } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';
import { acceptCookieBanner } from './utils';

@Fixture<typeof test>('checkoutItemsPage')
export class CheckoutItemsPage {
  readonly nextCartButton: Locator;
  readonly popcornCategory: Locator;
  readonly beveragesCategory: Locator;
  readonly beerWineCategory: Locator;
  readonly snacksCategory: Locator;
  readonly treatsCategory: Locator;
  readonly foodCategory: Locator;
  readonly searchInput: Locator;
  readonly promoInput: Locator;
  readonly promoApplyButton: Locator;
  readonly promoError: Locator;

  // ── Modifier dialog (Quasar q-dialog, role="dialog") ─────────────────────
  readonly itemDialog: Locator;
  readonly dialogAddButton: Locator;
  readonly dialogCloseButton: Locator;
  readonly dialogRequiredWarning: Locator;

  constructor(readonly page: Page) {
    this.nextCartButton = page.locator('[data-test-id="checkout-controls-next-button"]');

    this.popcornCategory = page.getByText('Popcorn', { exact: true }).first();

    this.beveragesCategory = page.getByText('Beverages', { exact: true }).first();
    this.beerWineCategory = page.getByText('Beer and Wine', { exact: true }).first();
    this.snacksCategory = page.getByText('Snacks', { exact: true }).first();
    this.treatsCategory = page.getByText('Treats', { exact: true }).first();
    this.foodCategory = page.getByText('Food', { exact: true }).first();

    this.searchInput = page.getByPlaceholder(/search/i);

    // Promo code (located in the right-side cart sidebar)
    this.promoInput = page.getByLabel(/add gift card, voucher, promo code/i).last();
    this.promoApplyButton = page.getByRole('button', { name: /^apply$/i }).last();
    // Error that appears when an invalid/unrecognised code is applied
    this.promoError = page.getByText('code not found', { exact: false }).first();

    // Modifier dialog
    this.itemDialog = page.getByRole('dialog');
    this.dialogAddButton = page.getByRole('dialog').getByRole('button', { name: /^add$/i });
    this.dialogCloseButton = page.getByRole('dialog').getByRole('button', { name: /^close$/i });
    // "Required — choose below" text with optional preceding warning icon
    this.dialogRequiredWarning = page.getByRole('dialog').getByText('Required — choose below', { exact: false });
  }

  static readonly URL_PATTERN = /\/checkout\/items\/?$/;

  async expectLoaded() {
    await expect(this.page).toHaveURL(CheckoutItemsPage.URL_PATTERN, { timeout: 20_000 });
    await expect(this.popcornCategory).toBeVisible({ timeout: 15_000 });
  }

  async clickNextCart() {
    await expect(this.nextCartButton).toBeEnabled({ timeout: 15_000 });
    await this.nextCartButton.click();
    await this.page.waitForURL(/\/checkout\/cart/, { timeout: 15_000 });
  }

  // ── Cart summary (persists across checkout steps) ────────────────────────
  cartSummary(): Locator {
    return this.page.getByText(/^\s*\d+\s+tickets?\s*·\s*\$\d+\.\d{2}\s*$/);
  }

  async expectCartTicketCount(n: number) {
    await expect
      .poll(async () => {
        const txt = (await this.cartSummary().first().innerText().catch(() => '')) ?? '';
        const m = txt.match(/^\s*(\d+)\s+(ticket|tickets)/);
        return m ? Number(m[1]) : 0;
      }, { timeout: 15_000, intervals: [400, 800, 1500] })
      .toBe(n);
  }

  // ── Food-cart sidebar helpers ─────────────────────────────────────────────
  // The right-side Quasar drawer is the cart sidebar on /checkout/items.
  private get cartSidebar(): Locator {
    return this.page.locator('.q-drawer--right').first();
  }

  // e.g. "1 item · $8.00" or "2 items · $10.50" in the right-side cart drawer
  foodCartSummary(): Locator {
    return this.cartSidebar.getByText(/\d+ items?\s*·\s*\$[\d.]+/);
  }

  // A specific food item line inside the cart sidebar.
  // Scoped to the right drawer to avoid matching category headings and toasts.
  foodCartLine(itemName: string): Locator {
    return this.cartSidebar.getByText(new RegExp(itemName, 'i')).first();
  }

  // ── Item interaction: click the "Add" button for a named item ─────────────
  //
  // Uses evaluate (one round-trip) for reliability under parallel test load.
  // Strategy 1: img[alt="ItemName"] → walk up until Add button found.
  // Strategy 2: text-proximity scan — Add button inside a short ancestor containing name.
  //
  private async clickItemAdd(itemName: string): Promise<boolean> {
    return this.page.evaluate((name) => {
      // Strategy 1: anchor on img alt
      const img = document.querySelector(`img[alt="${name}"]`);
      if (img) {
        let el: Element | null = img.parentElement;
        for (let d = 0; el && d < 8; d++, el = el.parentElement) {
          const btn = Array.from(el.querySelectorAll('button')).find(
            (b) => (b.innerText || '').trim() === 'Add' && !(b as HTMLButtonElement).disabled,
          );
          if (btn) { btn.click(); return true; }
        }
      }
      // Strategy 2: text-proximity
      const addBtns = Array.from(document.querySelectorAll('button')).filter(
        (b) => (b.innerText || '').trim() === 'Add' && !(b as HTMLButtonElement).disabled,
      );
      for (const btn of addBtns) {
        let ancestor: Element | null = btn.parentElement;
        for (let d = 0; ancestor && d < 6; d++, ancestor = ancestor.parentElement) {
          const text = (ancestor as HTMLElement).innerText || '';
          if (text.includes(name) && text.trim().length < 400) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    }, itemName);
  }

  // Wait for a specific item card (by img alt text) to be visible in the DOM.
  private async waitForItemVisible(itemName: string) {
    await this.page
      .locator(`img[alt="${itemName}"]`)
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
  }

  // Open the modifier dialog for an item that requires options (e.g., Sodas, Popcorn)
  async openItemDialog(itemName: string) {
    await acceptCookieBanner(this.page);
    await this.waitForItemVisible(itemName);
    const ok = await this.clickItemAdd(itemName);
    if (!ok) throw new Error(`Could not find Add button for item: ${itemName}`);
    await expect(this.itemDialog).toBeVisible({ timeout: 8_000 });
  }

  // Add an item to the food cart. Auto-confirms any pre-filled modifier dialog.
  async addSimpleItem(itemName: string) {
    await acceptCookieBanner(this.page);
    await this.waitForItemVisible(itemName);
    const ok = await this.clickItemAdd(itemName);
    if (!ok) throw new Error(`Could not find Add button for item: ${itemName}`);
    // If a modifier dialog opened with pre-selected defaults, confirm it immediately.
    const dialogOpened = await this.itemDialog.isVisible({ timeout: 1_500 }).catch(() => false);
    if (dialogOpened) {
      await this.dialogAddButton.click();
      await this.expectDialogClosed();
    }
    // Wait for item to appear in the persistent cart sidebar
    await this.cartSidebar.getByText(new RegExp(itemName, 'i')).waitFor({ timeout: 10_000 });
  }

  // ── Dialog modifier interactions ─────────────────────────────────────────

  async expectDialogOpen() {
    await expect(this.itemDialog).toBeVisible({ timeout: 10_000 });
  }

  async expectDialogClosed() {
    await expect(this.itemDialog).not.toBeVisible({ timeout: 10_000 });
  }

  async expectRequiredWarningVisible() {
    await expect(this.dialogRequiredWarning.first()).toBeVisible({ timeout: 8_000 });
  }

  async expectRequiredWarningGone() {
    await expect(this.dialogRequiredWarning).not.toBeVisible({ timeout: 8_000 });
  }

  async dialogTotal(): Promise<number> {
    // The dialog footer shows "Total: $6.25" — getByText uses substring matching,
    // so no anchors needed. Parse the $X.XX from the element's innerText.
    const el = this.page.getByRole('dialog').getByText('Total:', { exact: false }).first();
    const text = await el.innerText().catch(() => '');
    const m = text.match(/\$\s*([\d.]+)/);
    return m ? parseFloat(m[1]) : NaN;
  }

  // Click an option label inside the dialog (size, flavour, modifier)
  async selectDialogOption(label: string) {
    await this.page.getByRole('dialog').getByText(label, { exact: true }).click();
  }

  async confirmDialog() {
    await this.dialogAddButton.click();
    // Action confirmation: dialog closes after a successful confirm
    await this.expectDialogClosed();
  }

  async closeDialog() {
    await this.dialogCloseButton.click();
  }

  // ── BDD step decorators ──────────────────────────────────────────────────

  @Given('I am on the Food & Drink checkout page')
  async openDirect() {
    await this.page.goto('/checkout/items', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3000);
  }

  @Then('I land on the Food & Drink page')
  async checkLanded() {
    await this.expectLoaded();
  }

  @Then('the Food & Drink page cart summary still shows {int} ticket(s)')
  async checkCartCarriedOver(n: number) {
    await this.expectCartTicketCount(n);
  }

  @When('I advance to Cart')
  async advanceToCartStep() {
    await this.clickNextCart();
  }

  @When('I open the modifier dialog for {string}')
  async openDialogStep(itemName: string) {
    await this.openItemDialog(itemName);
  }

  @Then('the modifier dialog is open')
  async checkDialogOpen() {
    await this.expectDialogOpen();
  }

  @Then('the required modifier warning is visible')
  async checkRequiredWarningVisible() {
    await this.expectRequiredWarningVisible();
  }

  @Then('the required modifier warning is not visible')
  async checkRequiredWarningNotVisible() {
    await this.expectRequiredWarningGone();
  }

  @Then('the modifier dialog is not open')
  async checkDialogNotOpen() {
    await this.expectDialogClosed();
  }

  @When('I try to add the item without completing required modifiers')
  async tryAddWithoutRequired() {
    await this.dialogAddButton.click();
    // Give the UI a moment to respond (if it validates client-side, dialog stays open)
    await this.page.waitForTimeout(1000);
  }

  @Then('the modifier dialog is still open')
  async checkDialogStillOpen() {
    await this.expectDialogOpen();
  }

  @When('I select {string} from the modifier dialog')
  async selectOptionStep(label: string) {
    await this.selectDialogOption(label);
  }

  @Then('the dialog total shows {string}')
  async checkDialogTotal(expected: string) {
    const el = this.page.getByRole('dialog').getByText(new RegExp('Total:\\s*' + expected.replace('$', '\\$'), 'i'));
    await expect(el).toBeVisible({ timeout: 8_000 });
  }

  @When('I confirm the modifier dialog')
  async confirmDialogStep() {
    await this.confirmDialog();
  }

  @Then('the food cart contains {string}')
  async checkFoodCartContains(itemName: string) {
    await expect(this.foodCartLine(itemName)).toBeVisible({ timeout: 10_000 });
  }

  @When('I add {string} directly to the food cart')
  async addSimpleItemStep(itemName: string) {
    await this.addSimpleItem(itemName);
  }

  // ── Promo code helpers ───────────────────────────────────────────────────

  async applyPromoCode(code: string) {
    await this.promoInput.waitFor({ state: 'visible', timeout: 10_000 });
    await this.promoInput.fill(code);
    await this.promoApplyButton.click();
    await this.page.waitForTimeout(2000);
  }

  async expectPromoError() {
    await expect(this.promoError).toBeVisible({ timeout: 10_000 });
  }

  @When('I apply promo code {string}')
  async applyPromoStep(code: string) {
    await this.applyPromoCode(code);
  }

  @Then('a promo code error is shown')
  async checkPromoError() {
    await this.expectPromoError();
  }

  @Then('the food cart shows at least {int} food item(s)')
  async checkFoodCartCount(n: number) {
    // Sum item counts from all "N item(s) · $X.XX" badges in the right sidebar
    await expect
      .poll(
        async () => {
          const texts = await this.cartSidebar
            .getByText(/\d+ items?\s*·\s*\$[\d.]+/)
            .allInnerTexts()
            .catch(() => [] as string[]);
          let total = 0;
          for (const t of texts) {
            const m = t.match(/^(\d+)\s+items?/);
            if (m) total += Number(m[1]);
          }
          return total;
        },
        { timeout: 15_000, intervals: [500, 1000] },
      )
      .toBeGreaterThanOrEqual(n);
  }
}
