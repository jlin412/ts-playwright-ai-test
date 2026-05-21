import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Then, When } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';
import { acceptCookieBanner } from './utils';

@Fixture<typeof test>('checkoutShowingPage')
export class CheckoutShowingPage {
  readonly ticketsTab: Locator;
  readonly foodTab: Locator;
  readonly cartTab: Locator;
  readonly paymentTab: Locator;
  readonly continueAsGuestButton: Locator;
  readonly logInButton: Locator;
  readonly signUpButton: Locator;
  readonly promoCodeInput: Locator;
  readonly applyButton: Locator;
  readonly nextFoodAndDrinkButton: Locator;

  constructor(readonly page: Page) {
    this.ticketsTab = page.getByText('Tickets', { exact: true }).first();
    this.foodTab = page.getByText('Food & Drink', { exact: true }).first();
    this.cartTab = page.getByText('Cart', { exact: true }).first();
    this.paymentTab = page.getByText('Payment', { exact: true }).first();

    this.continueAsGuestButton = page.getByRole('button', { name: /continue as guest/i });
    this.logInButton = page.getByRole('button', { name: /^log in$/i });
    this.signUpButton = page.getByRole('button', { name: /^sign up$/i });

    this.promoCodeInput = page.getByLabel(/add gift card, voucher, promo code/i);
    this.applyButton = page.getByRole('button', { name: /^apply$/i });

    this.nextFoodAndDrinkButton = page.getByRole('button', { name: /^next:\s*food\s*&\s*drink$/i });
  }

  static readonly URL_PATTERN = /\/checkout\/showing\/[^/]+\/\d+/;

  async expectLoaded() {
    await expect(this.page).toHaveURL(CheckoutShowingPage.URL_PATTERN, { timeout: 20_000 });
    await expect(this.ticketsTab).toBeVisible({ timeout: 15_000 });
  }

  async expectAllTabsRendered() {
    await expect(this.ticketsTab).toBeVisible();
    await expect(this.foodTab).toBeVisible();
    await expect(this.cartTab).toBeVisible();
    await expect(this.paymentTab).toBeVisible();
  }

  async expectGuestEntryAvailable() {
    await expect(this.continueAsGuestButton).toBeVisible();
    await expect(this.logInButton).toBeVisible();
    await expect(this.signUpButton).toBeVisible();
  }

  async continueAsGuest() {
    await this.continueAsGuestButton.waitFor({ state: 'visible', timeout: 15_000 });
    // The cookie banner overlays the bottom of the page and intercepts clicks
    await acceptCookieBanner(this.page);
    await this.continueAsGuestButton.click();
    // wait for guest UI (Day Pass / ticket types) to mount
    await this.page.getByText('Guest Checkout', { exact: false }).first().waitFor({ timeout: 15_000 });
  }

  // The Tickets tab shows DAY PASS (upsell) ABOVE the ticket-types section.
  // In DOM order the FIRST ADD button is Day Pass; the SECOND ADD is the first
  // ticket type (e.g., VR Adult). If only one ADD exists, Day Pass is hidden
  // and we can safely click it.
  async clickFirstTicketTypeAdd() {
    const clicked = await this.page.evaluate(() => {
      const addButtons = Array.from(document.querySelectorAll('button')).filter(
        (b) =>
          (b.innerText || '').trim().toUpperCase() === 'ADD' && !(b as HTMLButtonElement).disabled,
      );
      // Prefer the 2nd (skip Day Pass), fall back to 1st if only one exists
      const target = addButtons.length >= 2 ? addButtons[1] : addButtons[0];
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    if (!clicked) {
      throw new Error('No ADD button found on the Tickets tab');
    }
  }

  // Cart summary line — e.g. "1 ticket · $34.95" or "2 tickets · $69.90"
  cartSummary(): Locator {
    return this.page.getByText(/^\s*\d+\s+tickets?\s*·\s*\$\d+\.\d{2}\s*$/);
  }

  async readCartSummaryDollars(): Promise<number> {
    const text = (await this.cartSummary().first().innerText().catch(() => '')) ?? '';
    const m = text.match(/\$\s*([\d,]+\.\d{2})/);
    return m ? Number(m[1].replace(/,/g, '')) : NaN;
  }

  async expectCartTicketCount(n: number) {
    const word = n === 1 ? 'ticket' : 'tickets';
    await expect
      .poll(
        async () => {
          const txt = (await this.cartSummary().first().innerText().catch(() => '')) ?? '';
          const m = txt.match(/^\s*(\d+)\s+(ticket|tickets)/);
          return m ? Number(m[1]) : 0;
        },
        {
          timeout: 15_000,
          intervals: [400, 800, 1500],
          message: `Waiting for cart summary to show ${n} ${word}`,
        },
      )
      .toBe(n);
  }

  async clickNextFoodAndDrink() {
    await expect(this.nextFoodAndDrinkButton).toBeEnabled({ timeout: 15_000 });
    await this.nextFoodAndDrinkButton.click();
    await this.page.waitForURL(/\/checkout\/items/, { timeout: 15_000 });
    // Action confirmation: F&D page is fully rendered (Popcorn category visible)
    await this.page.getByText('Popcorn', { exact: true }).first().waitFor({ state: 'visible', timeout: 15_000 });
  }

  @Then('I land on the checkout showing page')
  async checkLanded() {
    await this.expectLoaded();
  }

  @Then('the checkout page shows the four tabs Tickets, Food & Drink, Cart, and Payment')
  async checkAllTabs() {
    await this.expectAllTabsRendered();
  }

  @Then('the member greeting is visible on the tickets tab')
  async checkMemberGreeting() { await this.expectMemberGreeting(); }

  @Then('the continue as guest option is not shown')
  async checkNoGuestOption() {
    await expect(this.continueAsGuestButton).not.toBeVisible({ timeout: 5_000 });
    await expect(this.signUpButton).not.toBeVisible();
  }

  @Then('the checkout showing page is loaded with all tabs')
  async checkLoadedWithTabs() {
    await this.expectLoaded();
    await this.expectAllTabsRendered();
  }

  @Then('the checkout page offers a guest checkout option')
  async checkGuestEntry() {
    await this.expectGuestEntryAvailable();
  }

  // Day Pass upsell appears just above the ticket types section after guest entry
  // After login, the Tickets tab shows a personalized "Hi {name}, Choose Your Member Tickets" header.
  memberGreeting(): Locator {
    return this.page.getByText(/Hi\s+\w+,\s+Choose Your Member Tickets/i).first();
  }

  async expectMemberGreeting() {
    await expect(this.memberGreeting()).toBeVisible({ timeout: 15_000 });
  }

  async expectDayPassUpsell() {
    await expect(this.page.getByText('DAY PASS', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('$18.00', { exact: false }).first()).toBeVisible();
  }

  @When('I continue as guest')
  async continueAsGuestStep() {
    await this.continueAsGuest();
  }

  @Then('the day pass upsell is visible with the correct price')
  async checkDayPassUpsell() {
    await this.expectDayPassUpsell();
  }

  @When('I add the first ticket type to my cart')
  async addFirstTicketTypeStep() {
    await this.clickFirstTicketTypeAdd();
  }

  @When('I advance to Food & Drink')
  async advanceToFoodStep() {
    await this.clickNextFoodAndDrink();
  }

  @Then('the cart summary shows {int} ticket(s)')
  async checkCartCount(n: number) {
    await this.expectCartTicketCount(n);
  }
}
