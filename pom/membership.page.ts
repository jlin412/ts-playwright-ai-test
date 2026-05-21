import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('membershipPage')
export class MembershipPage {
  readonly heading: Locator;

  constructor(readonly page: Page) {
    // Page H1 is stable regardless of emoji changes in tier headings
    this.heading = page.getByRole('heading', { name: /membership/i }).first();
  }

  async goto() { await this.page.goto('/membership--guest-pricing'); }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async expectTiersVisible() {
    // Use substring matching — headings include emoji + tier name + " Membership"
    await expect(this.page.getByText('Diamond Elite', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('Platinum', { exact: false }).first()).toBeVisible();
    await expect(this.page.getByText('Unlimited Movie', { exact: false }).first()).toBeVisible();
  }

  async expectPricesVisible() {
    // Prices appear inline in the membership section
    await expect(this.page.getByText('$250', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('$49.95', { exact: false }).first()).toBeVisible();
    await expect(this.page.getByText('$24.95', { exact: false }).first()).toBeVisible();
  }

  async expectDayPassVisible() {
    await expect(this.page.getByText('Day Pass', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  }

  @Given('I am on the membership page')
  async open() { await this.goto(); }

  @Then('the membership tiers are visible')
  async checkTiers() { await this.expectTiersVisible(); }

  @Then('the membership prices are displayed')
  async checkPrices() { await this.expectPricesVisible(); }

  async expectFeatureItemsVisible() {
    // At least one membership perk should be named on the page (stable benefit copy)
    await expect(
      this.page.getByText('Priority Line Access', { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  async expectDayPassDescriptionVisible() {
    // The bottom "NOT A MEMBER YET?" section describes the Day Pass
    await expect(this.page.getByText('NOT A MEMBER YET', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('$18.00', { exact: false }).first()).toBeVisible();
  }

  @Then('the day pass option is visible')
  async checkDayPass() { await this.expectDayPassVisible(); }

  @Then('the membership page shows at least one perk description')
  async checkFeatureItems() { await this.expectFeatureItemsVisible(); }

  @Then('the membership page shows the day pass description')
  async checkDayPassDescription() { await this.expectDayPassDescriptionVisible(); }
}
