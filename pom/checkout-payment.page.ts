import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { Fixture, Then, When } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';
import { acceptCookieBanner } from './utils';

@Fixture<typeof test>('checkoutPaymentPage')
export class CheckoutPaymentPage {
  readonly emailInput: Locator;
  readonly payButton: Locator;
  readonly emailError: Locator;
  readonly promoInput: Locator;
  readonly applyButton: Locator;

  constructor(readonly page: Page) {
    this.emailInput = page.locator('[data-test-id="payments-form-email-address"]');
    this.payButton = page.locator('[data-test-id="payments-form-pay-with-card-button"]');
    this.emailError = page.getByText('Not a valid email address', { exact: true });
    this.promoInput = page.getByLabel(/add gift card, voucher, promo code/i).last();
    this.applyButton = page.getByRole('button', { name: /^apply$/i }).last();
  }

  static readonly URL_PATTERN = /\/checkout\/payment\/?$/;

  // ── Stripe Card Element lives in the first __privateStripeFrame iframe.
  // Playwright traverses nested sub-frames automatically, so all four card
  // fields (card number, expiry, CVC, ZIP) are reachable from this one locator.
  stripeFrame(): FrameLocator {
    return this.page.frameLocator('iframe[name*="__privateStripeFrame"]').first();
  }

  stripeCardInput(): Locator {
    return this.stripeFrame().getByPlaceholder('1234 1234 1234 1234');
  }

  stripeExpiryInput(): Locator {
    return this.stripeFrame().getByPlaceholder('MM / YY');
  }

  stripeCvcInput(): Locator {
    return this.stripeFrame().getByPlaceholder('CVC');
  }

  stripeZipInput(): Locator {
    return this.stripeFrame().getByPlaceholder('12345');
  }

  // Stripe surfaces inline errors as elements with the 'P1-invalid' or error
  // class. We use a broad role="alert" or text-pattern check inside the frame.
  stripeFieldError(): Locator {
    return this.stripeFrame().locator('[role="alert"], [class*="invalid"], [class*="Error"]').first();
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(CheckoutPaymentPage.URL_PATTERN, { timeout: 20_000 });
    await expect(this.payButton).toBeVisible({ timeout: 15_000 });
  }

  async expectPayButtonDisabled() {
    await expect(this.payButton).toBeDisabled({ timeout: 15_000 });
  }

  async fillEmail(value: string) {
    await this.emailInput.waitFor({ state: 'visible', timeout: 15_000 });
    await this.emailInput.fill(value);
  }

  async blurEmail() {
    await this.emailInput.press('Tab');
  }

  async expectEmailError(text = 'Not a valid email address') {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 10_000 });
  }

  // Fill a Stripe field and then Tab out to trigger its inline validation.
  async fillStripeExpiry(value: string) {
    await acceptCookieBanner(this.page);
    const input = this.stripeExpiryInput();
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    await input.fill(value);
    await input.press('Tab');
  }

  async fillStripeCvc(value: string) {
    await acceptCookieBanner(this.page);
    const input = this.stripeCvcInput();
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    await input.fill(value);
    await input.press('Tab');
  }

  async fillStripeZip(value: string) {
    await acceptCookieBanner(this.page);
    const input = this.stripeZipInput();
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    await input.fill(value);
    await input.press('Tab');
  }

  // Stripe sets aria-invalid="true" on a field after it detects invalid input.
  async expectStripeFieldInvalid(field: 'expiry' | 'cvc' | 'zip') {
    const input = field === 'expiry'
      ? this.stripeExpiryInput()
      : field === 'cvc'
      ? this.stripeCvcInput()
      : this.stripeZipInput();
    await expect(input).toHaveAttribute('aria-invalid', 'true', { timeout: 10_000 });
  }

  // ── BDD step decorators ──────────────────────────────────────────────────

  @Then('I land on the payment page')
  async checkLanded() {
    await this.expectLoaded();
  }

  @Then('the PAY button is disabled')
  async checkPayDisabled() {
    await this.expectPayButtonDisabled();
  }

  @When('I enter an invalid email {string}')
  async enterInvalidEmail(value: string) {
    await this.fillEmail(value);
    await this.blurEmail();
  }

  @Then('an email validation error is shown')
  async checkEmailError() {
    await this.expectEmailError();
  }

  @When('I fill the Stripe expiry with a past date {string}')
  async fillBadExpiry(value: string) {
    await this.fillStripeExpiry(value);
  }

  @Then('the expiry field shows as invalid')
  async checkExpiryInvalid() {
    await this.expectStripeFieldInvalid('expiry');
  }

  @When('I fill the Stripe CVC with incomplete digits {string}')
  async fillBadCvc(value: string) {
    await this.fillStripeCvc(value);
  }

  @Then('the CVC field shows as invalid')
  async checkCvcInvalid() {
    await this.expectStripeFieldInvalid('cvc');
  }
}
