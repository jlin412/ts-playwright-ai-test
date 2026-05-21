import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('comingSoonPage')
export class ComingSoonPage {
  readonly heading: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /coming soon/i }).first();
  }

  async goto() { await this.page.goto('/coming-soon'); }

  // Coming-soon cards are Vue-router-driven `cursor-pointer` divs, NOT <a> tags.
  // We use the general clickable card selector as a proxy for "has movies".
  movieCards(): Locator {
    return this.page.locator('[cursor="pointer"], [style*="cursor: pointer"], [class*="cursor-pointer"]').first();
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  noMoviesText(): Locator {
    return this.page.getByText(/no movies here/i);
  }

  // Coming-soon content rotates — accept either movie cards or the empty state.
  async expectPageFunctional() {
    await expect(this.heading).toBeVisible();
    await expect(this.page.locator('main')).toBeVisible();
    await expect
      .poll(
        async () => {
          const cards = await this.movieCards().count();
          const empty = await this.noMoviesText().count();
          return cards > 0 || empty > 0;
        },
        {
          timeout: 15_000,
          message: 'Waiting for coming soon movie cards or "No movies here" empty state',
        },
      )
      .toBe(true);
  }

  @Given('I am on the coming soon page')
  async open() { await this.goto(); }

  @Then('the coming soon page is loaded')
  async checkLoaded() { await this.expectLoaded(); }

  @Then('the coming soon page displays its content')
  async checkContent() { await this.expectPageFunctional(); }
}
