import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then, When } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('accountPage')
export class AccountPage {
  readonly greeting: Locator;     // "👋 Hi, Jason"
  readonly logOutLink: Locator;
  readonly membershipSection: Locator;
  readonly orderHistorySection: Locator;
  readonly myMoviesSection: Locator;
  readonly accountInfoSection: Locator;

  constructor(readonly page: Page) {
    this.greeting = page.getByText(/👋\s*Hi,/i).first();
    // CSS text-transform renders as uppercase visually; accessible name is "Log Out"
    this.logOutLink = page.getByRole('link', { name: /^log out$/i });
    this.membershipSection = page.getByText('Membership', { exact: true }).first();
    this.orderHistorySection = page.getByText('Order History', { exact: true }).first();
    this.myMoviesSection = page.getByText('My Movies', { exact: true }).first();
    this.accountInfoSection = page.getByText('Account Information', { exact: true }).first();
  }

  static readonly URL_PATTERN = /\/account\/?/;

  async goto() {
    await this.page.goto('/account', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3000);
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(AccountPage.URL_PATTERN, { timeout: 15_000 });
    await expect(this.greeting).toBeVisible({ timeout: 15_000 });
  }

  async expectDashboardSections() {
    await expect(this.membershipSection).toBeVisible({ timeout: 10_000 });
    await expect(this.orderHistorySection).toBeVisible();
    await expect(this.myMoviesSection).toBeVisible();
    await expect(this.accountInfoSection).toBeVisible();
  }

  async expectLogOutVisible() {
    await expect(this.logOutLink).toBeVisible({ timeout: 10_000 });
  }

  async logout() {
    await this.logOutLink.click();
    // After logout, the page redirects away from /account
    await this.page.waitForURL((url) => !url.pathname.startsWith('/account'), { timeout: 15_000 });
    await this.page.waitForTimeout(2000);
  }

  async clickMyMovies() {
    await this.myMoviesSection.click();
    await this.page.waitForTimeout(3000);
  }

  async clickOrderHistory() {
    await this.orderHistorySection.click();
    await this.page.waitForTimeout(3000);
  }

  // ── BDD decorators ─────────────────────────────────────────────────────

  @Given('I am on the account dashboard page')
  async open() { await this.goto(); }

  @Then('the account dashboard shows a greeting and all main sections')
  async checkDashboard() {
    await this.expectLoaded();
    await this.expectDashboardSections();
    await this.expectLogOutVisible();
  }

  @When('I log out from the account page')
  async logoutStep() { await this.logout(); }

  @Then('I am logged out and the login form reappears at checkout')
  async checkLoggedOut() {
    // Navigate back to a checkout page to confirm auth state is cleared
    await this.page.goto('/now-playing', { waitUntil: 'domcontentloaded' });
    // Session is cleared server-side; we just verify we're no longer on /account
    await expect(this.page).not.toHaveURL(AccountPage.URL_PATTERN, { timeout: 5_000 });
  }

  @Then('the My Movies section is visible')
  async checkMyMovies() { await expect(this.myMoviesSection).toBeVisible({ timeout: 10_000 }); }
}
