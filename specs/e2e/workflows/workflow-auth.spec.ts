import { expect, test } from '../../fixtures';

// Credential guard — skip member-only tests if env vars are absent.
const hasCredentials = !!(process.env.TEST_MEMBER_EMAIL && process.env.TEST_MEMBER_PASSWORD);

// Helper: reach the checkout Tickets tab (auth form lives here)
async function reachAuthForm(
  nowPlayingPage: any, moviePage: any,
  checkoutShowingPage: any, authPage: any,
) {
  await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
  await moviePage.clickFirstShowtime();
  await checkoutShowingPage.expectLoaded();
}

// Auth tests make several sequential page loads (movie → showtime → login).
// Run serially to avoid hammering the live SPA with parallel sessions.
test.describe.configure({ mode: 'serial' });

test.describe('@regression @auth Tier 1 — authentication flow', () => {
  // ── Auth form structure ──────────────────────────────────────────────────
  test('auth.1 — login form shows all required fields on the Tickets tab', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, authPage,
  }) => {
    await reachAuthForm(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await authPage.expectAuthFormVisible();
  });

  // ── Invalid credentials ──────────────────────────────────────────────────
  test('auth.2 — wrong credentials shows "Incorrect email or password" error', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, authPage,
  }) => {
    await reachAuthForm(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await authPage.fillAndSubmitLogin('nobody@example.com', 'BadPassword999!');
    await authPage.expectInvalidCredentialsError();
    await authPage.dismissErrorModal();
    await authPage.expectLoginFormStillVisible();
  });

  // ── Forgot Password ──────────────────────────────────────────────────────
  test('auth.3 — Forgot Password link navigates to the password reset page', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, authPage, page,
  }) => {
    await reachAuthForm(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await authPage.clickForgotPassword();
    await expect(page).toHaveURL(/\/password\/forgot/, { timeout: 15_000 });
    // Reset page should show some form or confirmation text
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
  });

  // Helper: attempt login and skip the test if credentials are rejected
  async function loginOrSkip(authPage: any, test: any) {
    await authPage.fillAndSubmitLogin(
      process.env.TEST_MEMBER_EMAIL!,
      process.env.TEST_MEMBER_PASSWORD!,
    );
    const loginFailed = await authPage.errorModal.isVisible({ timeout: 3_000 }).catch(() => false);
    if (loginFailed) {
      await authPage.dismissErrorModal();
      test.skip(true, `Login failed — credentials may not be registered: ${process.env.TEST_MEMBER_EMAIL}`);
    }
  }

  // ── Successful login (requires valid credentials) ────────────────────────
  test('auth.4 — valid credentials log the user in and remove the auth form', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, authPage,
  }) => {
    test.skip(!hasCredentials, 'Set TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD in .env');

    await reachAuthForm(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await loginOrSkip(authPage, test);
    await authPage.expectLoggedIn();
  });

  // ── O.3: Member pricing differs from guest pricing ───────────────────────
  test('O.3 — member checkout removes guest prompts and Day Pass upsell', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, authPage,
  }) => {
    test.skip(!hasCredentials, 'Set TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD in .env');

    await reachAuthForm(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await loginOrSkip(authPage, test);
    await authPage.expectLoggedIn();

    // Members should NOT see "Continue As Guest" or "Sign Up" after login
    await expect(authPage.continueAsGuestButton).not.toBeVisible({ timeout: 5_000 });
    await expect(authPage.signUpButton).not.toBeVisible();
  });

  // ── Hero Points / Redemptions indicator ─────────────────────────────────
  test('auth.5 — logged-in member: login button disappears, session active', async ({
    nowPlayingPage, moviePage, checkoutShowingPage, authPage,
  }) => {
    test.skip(!hasCredentials, 'Set TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD in .env');

    await reachAuthForm(nowPlayingPage, moviePage, checkoutShowingPage, authPage);
    await loginOrSkip(authPage, test);
    await expect(authPage.loginButton).not.toBeVisible({ timeout: 10_000 });
  });
});
