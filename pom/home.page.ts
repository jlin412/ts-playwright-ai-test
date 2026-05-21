import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('homePage')
export class HomePage {
  readonly showtimesLink: Locator;
  readonly comingSoonLink: Locator;
  readonly logoLink: Locator;

  constructor(readonly page: Page) {
    this.logoLink = page.getByRole('link', { name: /logo/i }).first();
    this.showtimesLink = page.getByRole('link', { name: /^showtimes$/i }).first();
    this.comingSoonLink = page.getByRole('link', { name: /^coming soon$/i }).first();
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  async expectLoaded() {
    await expect(this.showtimesLink).toBeVisible({ timeout: 15_000 });
    await expect(this.comingSoonLink).toBeVisible();
  }

  async expectOnCalendarPage() {
    await expect(this.page).toHaveURL(/\/calendar/, { timeout: 15_000 });
    await expect(this.page.getByRole('heading', { name: /calendar/i }).first()).toBeVisible({ timeout: 15_000 });
  }

  async expectOnComingSoonPage() {
    await expect(this.page).toHaveURL(/\/coming-soon/, { timeout: 15_000 });
    await expect(this.page.getByRole('heading', { name: /coming soon/i }).first()).toBeVisible({ timeout: 15_000 });
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  async goto(baseURL?: string) {
    if (baseURL) {
      await this.page.goto(new URL('/', baseURL).toString());
      return;
    }

    await this.page.goto('/');
  }

  async clickShowtimesLink() {
    await this.showtimesLink.click();
    await this.expectOnCalendarPage();
  }

  async clickComingSoonLink() {
    await this.comingSoonLink.click();
    await this.expectOnComingSoonPage();
  }

  // ── BDD step decorators ─────────────────────────────────────────────────

  @Given('I am on the home page')
  async open() {
    await this.goto();
  }

  @Then('the home page is loaded')
  async checkLoaded() {
    await this.expectLoaded();
  }

  @Then('clicking the SHOWTIMES nav link opens the calendar page')
  async clickShowtimesNav() {
    await this.clickShowtimesLink();
  }

  @Then('clicking the COMING SOON nav link opens the coming soon page')
  async clickComingSoonNav() {
    await this.clickComingSoonLink();
  }
}
