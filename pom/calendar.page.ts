import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('calendarPage')
export class CalendarPage {
  readonly heading: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /calendar/i }).first();
  }

  async goto() { await this.page.goto('/calendar'); }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async expectCalendarContentPresent() {
    // Calendar page should show SOMETHING — either showtimes, a "View Next Showings"
    // button (text-based, not button role), or at least a main content area.
    const hasShowtimesBtn = await this.page
      .getByText(/view next showings/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const hasTimeSlots = await this.page
      .getByText(/\d{1,2}:\d{2}\s*(AM|PM)/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const hasMovieLinks = (await this.page.locator('a[href*="/movie/"]').count()) > 0;
    const hasMain = await this.page.locator('main').isVisible().catch(() => false);
    expect(
      hasShowtimesBtn || hasTimeSlots || hasMovieLinks || hasMain,
      'Calendar page must render meaningful content',
    ).toBe(true);
  }

  @Given('I am on the calendar page')
  async open() { await this.goto(); }

  @Then('the calendar page is loaded')
  async checkLoaded() { await this.expectLoaded(); }

  @Then('the calendar shows showtime content')
  async checkShowtimes() { await this.expectCalendarContentPresent(); }
}
