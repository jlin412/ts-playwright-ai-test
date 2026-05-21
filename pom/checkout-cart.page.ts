import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Then, When } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('checkoutCartPage')
export class CheckoutCartPage {
  readonly nextPaymentButton: Locator;
  readonly emptyCartMessage: Locator;
  readonly totalLabel: Locator;

  constructor(readonly page: Page) {
    this.nextPaymentButton = page.locator('[data-test-id="checkout-controls-next-button"]');
    this.emptyCartMessage = page.getByText(/your cart is empty/i).first();
    this.totalLabel = page.getByText('Total', { exact: true }).last();
  }

  static readonly URL_PATTERN = /\/checkout\/cart\/?$/;

  async expectLoaded() {
    await expect(this.page).toHaveURL(CheckoutCartPage.URL_PATTERN, { timeout: 20_000 });
    await expect(this.totalLabel).toBeVisible({ timeout: 15_000 });
  }

  // Per-line totals live in BOTH the complementary (sidebar) summary AND the main
  // panel — restrict to the complementary panel so we don't double-count.
  lineTotals(): Locator {
    return this.page
      .getByRole('complementary')
      .locator('[data-test-id="cart-item-display-total"]');
  }

  static parseDollars(s: string | null | undefined): number {
    if (!s) return NaN;
    const m = s.match(/\$\s*([\d,]+\.\d{2})/);
    return m ? Number(m[1].replace(/,/g, '')) : NaN;
  }

  async readLineTotals(): Promise<number[]> {
    const texts = await this.lineTotals().allInnerTexts();
    return texts.map((t) => CheckoutCartPage.parseDollars(t)).filter((n) => !Number.isNaN(n));
  }

  // The grand "Total" + $X.XX live as siblings (possibly with intervening
  // Quasar wrappers). Iterate "Total"-textual elements in reverse and probe
  // their following siblings for a $X.XX value.
  async readGrandTotal(): Promise<number> {
    const dollarText = await this.page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('*')).filter(
        (el) => (el.textContent || '').trim() === 'Total',
      );
      for (let i = candidates.length - 1; i >= 0; i--) {
        let sib: Element | null = candidates[i].nextElementSibling;
        while (sib) {
          const t = (sib.textContent || '').trim();
          const m = t.match(/^\$\s*([\d,]+\.\d{2})$/);
          if (m) return m[1];
          sib = sib.nextElementSibling;
        }
      }
      return null;
    });
    return dollarText ? Number(dollarText.replace(/,/g, '')) : NaN;
  }

  @Then('I land on the cart page')
  async checkLanded() {
    await this.expectLoaded();
  }

  @Then('the cart shows {int} line item(s)')
  async checkLineCount(n: number) {
    await expect(this.lineTotals()).toHaveCount(n, { timeout: 15_000 });
  }

  @Then('the grand total equals the sum of the line totals')
  async checkTotalsMatch() {
    await expect
      .poll(
        async () => {
          const lines = await this.readLineTotals();
          const grand = await this.readGrandTotal();
          if (lines.length === 0 || Number.isNaN(grand)) return null;
          const lineSum = Number(lines.reduce((a, b) => a + b, 0).toFixed(2));
          return lineSum === Number(grand.toFixed(2)) ? true : { lineSum, grand };
        },
        {
          timeout: 15_000,
          intervals: [500, 1000, 2000],
          message: 'Waiting for grand total to equal the sum of line totals',
        },
      )
      .toBe(true);
  }

  // ── Hero Points / Redemptions (member-only, visible on /checkout/cart) ──

  readonly redemptionsSection: Locator;
  readonly heroPointsText: Locator;

  // Initialise the new locators (called after super construction)
  private _initRedemptions() {
    (this as any).redemptionsSection = this.page.getByText('Redemptions', { exact: true }).first();
    (this as any).heroPointsText = this.page.getByText(/\d+\s+Hero\s+Points/i).first();
  }

  async expectRedemptionsSectionVisible() {
    await expect(this.page.getByText('Redemptions', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  }

  async expectHeroPointsDisplayed() {
    await expect(this.page.getByText(/Hero\s+Points/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async expandRedemptions() {
    // The Redemptions accordion is collapsed by default — click to expand
    const header = this.page.getByText('Redemptions', { exact: true }).first();
    await header.click();
    await this.page.waitForTimeout(1000);
  }

  async expectRedemptionOptionsListed() {
    // Expand the accordion first, then assert the three tiers
    await this.expandRedemptions();
    await expect(this.page.getByText('Free Ticket', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('Free Item', { exact: false }).first()).toBeVisible();
    await expect(this.page.getByText('Free Popcorn', { exact: false }).first()).toBeVisible();
  }

  async clickNextPayment() {
    await expect(this.nextPaymentButton).toBeEnabled({ timeout: 15_000 });
    await this.nextPaymentButton.click();
    await this.page.waitForURL(/\/checkout\/payment/, { timeout: 15_000 });
    // Action confirmation: payment page is fully rendered (Pay button visible)
    await this.page
      .locator('[data-test-id="payments-form-pay-with-card-button"]')
      .waitFor({ state: 'visible', timeout: 15_000 });
  }

  @When('I advance to Payment')
  async advanceToPaymentStep() {
    await this.clickNextPayment();
  }

  @When('I reload the cart page')
  async reload() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2500);
  }

  @Then('the cart is empty')
  async checkEmpty() {
    await expect(this.emptyCartMessage).toBeVisible({ timeout: 15_000 });
  }

  @Then('I am redirected to the home page')
  async checkRedirectedHome() {
    await expect(this.page).toHaveURL(/\/$/, { timeout: 10_000 });
  }
}
