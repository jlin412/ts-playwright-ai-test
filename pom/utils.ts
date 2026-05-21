import type { Page } from '@playwright/test';

// The Quasar cookie consent banner ("Accept & Dismiss") renders as a fixed
// alert that intercepts pointer events on elements behind it. Dismiss it
// before any test that interacts with the bottom of the viewport.
export async function acceptCookieBanner(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /accept\s*&\s*dismiss/i });
  if (await btn.first().isVisible().catch(() => false)) {
    await btn.first().click({ timeout: 3000 }).catch(() => {});
  }
}
