import { type Locator, type Page } from '@playwright/test';
import { Fixture, Given, When } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('moviePage')
export class MoviePage {
  readonly h1: Locator;
  readonly nothingScheduled: Locator;

  constructor(readonly page: Page) {
    this.h1 = page.locator('h1').first();
    this.nothingScheduled = page.getByText(/nothing scheduled/i);
  }

  async goto(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.h1.waitFor({ state: 'visible', timeout: 20_000 });
    // Showtime grid mounts after the H1
    await this.page.waitForTimeout(2500);
  }

  showtimeButtons(): Locator {
    // Recon: button accessible name is just the time, even though textContent
    // also picks up the adjacent material-icons glyph ("people").
    return this.page.getByRole('button', { name: /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i });
  }

  async hasShowtimes(): Promise<boolean> {
    // Poll briefly — SPA may still be mounting
    let count = 0;
    for (let i = 0; i < 6; i++) {
      count = await this.showtimeButtons().count();
      if (count > 0) return true;
      if (await this.nothingScheduled.count() > 0) return false;
      await this.page.waitForTimeout(1000);
    }
    return false;
  }

  async clickFirstShowtime() {
    const btn = this.showtimeButtons().first();
    await btn.waitFor({ state: 'visible', timeout: 20_000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }

  @Given('I am on a movie detail page with scheduled showtimes')
  async openFirstMovieWithShowtimes() {
    // BDD entry: assumes we came via the NowPlayingPage step that already picked one.
    // The actual URL navigation happens in NowPlayingPage.openFirstMovieWithShowtimes().
  }

  @When('I pick the first available showtime')
  async clickShowtimeStep() {
    await this.clickFirstShowtime();
  }
}
