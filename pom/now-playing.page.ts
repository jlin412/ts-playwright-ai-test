import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';
import { MoviePage } from './movie.page';

@Fixture<typeof test>('nowPlayingPage')
export class NowPlayingPage {
  readonly heading: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /now playing/i }).first();
  }

  async goto(baseURL?: string) {
    if (baseURL) {
      await this.page.goto(new URL('/now-playing', baseURL).toString());
      return;
    }

    await this.page.goto('/now-playing');
  }

  movieLinks(): Locator {
    return this.page.locator('a[href*="/movie/"]');
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async expectAtLeastOneMovieListed() {
    await expect
      .poll(async () => await this.movieLinks().count(), {
        timeout: 15_000,
        intervals: [500, 1000, 2000],
        message: 'Waiting for at least one /movie/* link to appear on /now-playing',
      })
      .toBeGreaterThan(0);
  }

  // ── BDD step decorators ─────────────────────────────────────────────────

  @Given('I am on the now playing page')
  async open() {
    await this.goto();
  }

  @Then('the now playing page is loaded')
  async checkLoaded() {
    await this.expectLoaded();
  }

  @Then('I see at least one movie listed')
  async checkAtLeastOneMovie() {
    await this.expectAtLeastOneMovieListed();
  }

  // ── Bookmark / watchlist helpers (require member login) ─────────────────

  // Movie cards show `bookmark_outline` (unfilled) and `bookmark` (filled) Material icon text.
  outlineBookmarks(): Locator {
    return this.page.locator('button').filter({ hasText: 'bookmark_outline' });
  }

  filledBookmarks(): Locator {
    // "bookmark" is a substring of "bookmark_outline", so scope to buttons whose
    // exact inner text is "bookmark" (not "bookmark_outline").
    return this.page.locator('button').filter({
      has: this.page.locator(':scope > *:only-child, :scope').filter({ hasNotText: 'outline' }).filter({ hasText: 'bookmark' }),
    });
  }

  async clickFirstOutlineBookmark() {
    const btn = this.outlineBookmarks().first();
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
    await btn.click();
    await this.page.waitForTimeout(1500);
  }

  filledBookmarkButton(): Locator {
    // "bookmark" (filled) buttons — exclude those whose text contains "outline"
    return this.page
      .locator('button')
      .filter({ hasText: 'bookmark' })
      .filter({ hasNotText: 'outline' })
      .first();
  }

  async clickFirstFilledBookmark() {
    const btn = this.filledBookmarkButton();
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
    await btn.click();
    await this.page.waitForTimeout(1500);
  }

  async expectAtLeastOneOutlineBookmark() {
    await expect(this.outlineBookmarks().first()).toBeVisible({ timeout: 10_000 });
  }

  async expectFirstBookmarkFilled() {
    // After clicking, the text should change from "bookmark_outline" to "bookmark"
    await expect
      .poll(async () => {
        const count = await this.page.evaluate(() =>
          Array.from(document.querySelectorAll('button')).filter(
            (b) => (b.innerText || '').trim() === 'bookmark',
          ).length,
        );
        return count;
      }, { timeout: 10_000 })
      .toBeGreaterThan(0);
  }

  async expectFirstBookmarkUnfilled() {
    // After un-bookmarking, count of filled bookmarks should return to previous level
    await expect
      .poll(async () => {
        const count = await this.page.evaluate(() =>
          Array.from(document.querySelectorAll('button')).filter(
            (b) => (b.innerText || '').trim() === 'bookmark',
          ).length,
        );
        return count;
      }, { timeout: 10_000 })
      .toBe(0);
  }

  async movieHrefs(limit = 10): Promise<string[]> {
    await expect.poll(async () => await this.movieLinks().count(), { timeout: 15_000 }).toBeGreaterThan(0);
    const all = await this.movieLinks().evaluateAll((els) =>
      els.map((e) => e.getAttribute('href')).filter((h): h is string => !!h),
    );
    return Array.from(new Set(all)).slice(0, limit);
  }

  async findAndOpenMovieWithShowtimes(moviePage: MoviePage, maxCandidates = 8): Promise<string> {
    await this.goto();
    await this.expectLoaded();

    const hrefs = await this.movieHrefs(maxCandidates);
    for (const href of hrefs) {
      const url = href.startsWith('http') ? href : new URL(href, this.page.url()).toString();
      await moviePage.goto(url);
      if (await moviePage.hasShowtimes()) {
        return url;
      }
    }
    throw new Error(
      `No movie with scheduled showtimes found among ${hrefs.length} candidates: ${hrefs.join(', ')}`,
    );
  }

}
