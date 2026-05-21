import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('contactPage')
export class ContactPage {
  readonly email: Locator;
  readonly phone: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByText('support@yosemitecinema.com', { exact: false }).first();
    this.phone = page.getByText('559', { exact: false }).first();
  }

  async goto() { await this.page.goto('/contact-us'); }

  async expectLoaded() {
    // The contact page may be SPA — wait for contact info to render
    await expect(this.email).toBeVisible({ timeout: 15_000 });
  }

  async expectContactInfo() {
    await expect(this.email).toBeVisible();
    await expect(this.phone).toBeVisible();
  }

  @Given('I am on the contact page')
  async open() { await this.goto(); }

  @Then('the contact page shows the support email and phone number')
  async checkContactInfo() { await this.expectContactInfo(); }
}
