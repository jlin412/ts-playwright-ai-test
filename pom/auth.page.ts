import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then, When } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';
import { acceptCookieBanner } from './utils';

// The login / sign-up form lives on the checkout Tickets tab
// (/checkout/showing/{slug}/{showtime-id}). There is no standalone login page.
//
// Credential environment variables:
//   TEST_MEMBER_EMAIL    – registered member email
//   TEST_MEMBER_PASSWORD – member account password

@Fixture<typeof test>('authPage')
export class AuthPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpButton: Locator;
  readonly continueAsGuestButton: Locator;
  // Error modal that appears on bad credentials: title "Message", body "Incorrect email or password"
  readonly errorModal: Locator;
  readonly errorOkButton: Locator;

  constructor(readonly page: Page) {
    this.emailInput = page.getByLabel('Email').first();
    this.passwordInput = page.getByLabel('Password').first();
    this.loginButton = page.getByRole('button', { name: /^log in$/i });
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
    this.signUpButton = page.getByRole('button', { name: /^sign up$/i });
    this.continueAsGuestButton = page.getByRole('button', { name: /continue as guest/i });
    this.errorModal = page.getByText('Incorrect email or password', { exact: false });
    this.errorOkButton = page.getByRole('button', { name: /^ok$/i });
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  async expectAuthFormVisible() {
    await expect(this.emailInput).toBeVisible({ timeout: 15_000 });
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
    await expect(this.forgotPasswordLink).toBeVisible();
    await expect(this.signUpButton).toBeVisible();
    await expect(this.continueAsGuestButton).toBeVisible();
  }

  async expectInvalidCredentialsError() {
    await expect(this.errorModal).toBeVisible({ timeout: 10_000 });
  }

  async dismissErrorModal() {
    if (await this.errorOkButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.errorOkButton.click();
    }
  }

  async expectLoginFormStillVisible() {
    // Form should remain after a failed login attempt
    await expect(this.loginButton).toBeVisible({ timeout: 5_000 });
  }

  // Post-login success assertions (requires a registered account)
  async expectLoggedIn() {
    // After successful login, the auth form panels disappear and member context is active
    await expect(this.loginButton).not.toBeVisible({ timeout: 15_000 });
    await expect(this.continueAsGuestButton).not.toBeVisible();
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  async fillAndSubmitLogin(email: string, password: string) {
    await acceptCookieBanner(this.page);
    await this.emailInput.waitFor({ state: 'visible', timeout: 15_000 });
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForTimeout(4000);
  }

  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL(/\/password\/forgot/, { timeout: 15_000 });
  }

  async clickSignUp() {
    await acceptCookieBanner(this.page);
    await this.signUpButton.click();
    await this.page.waitForTimeout(3000);
  }

  // ── BDD step decorators ─────────────────────────────────────────────────

  @Then('the login form is visible with all required fields')
  async checkFormVisible() { await this.expectAuthFormVisible(); }

  @When('I log in with email {string} and password {string}')
  async loginWithCredentials(email: string, password: string) {
    await this.fillAndSubmitLogin(email, password);
  }

  @Then('an invalid credentials error is shown')
  async checkInvalidError() { await this.expectInvalidCredentialsError(); }

  @Then('the login form is still visible')
  async checkFormStillVisible() { await this.expectLoginFormStillVisible(); }

  @When('I click the Forgot Password link')
  async clickForgotStep() { await this.clickForgotPassword(); }

  @Then('I am on the password reset page')
  async checkForgotPage() {
    await expect(this.page).toHaveURL(/\/password\/forgot/, { timeout: 15_000 });
  }

  @When('I log in as a member')
  async loginAsMember() {
    const email = process.env.TEST_MEMBER_EMAIL ?? '';
    const password = process.env.TEST_MEMBER_PASSWORD ?? '';
    await this.fillAndSubmitLogin(email, password);
  }

  @Then('I am logged in as a member')
  async checkLoggedIn() { await this.expectLoggedIn(); }
}
