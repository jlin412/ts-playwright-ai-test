import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('ourStoryPage')
export class OurStoryPage {
  readonly keithWalker: Locator;
  readonly mediaOutlets: Locator;

  constructor(readonly page: Page) {
    this.keithWalker = page.getByText('Keith Walker', { exact: false }).first();
    // At least one of the known media mentions
    this.mediaOutlets = page.getByText('NPR', { exact: false }).first();
  }

  async goto() { await this.page.goto('/our-story'); }

  async expectLoaded() {
    await expect(this.keithWalker).toBeVisible({ timeout: 15_000 });
  }

  async expectTeamVisible() {
    await expect(this.keithWalker).toBeVisible();
    await expect(this.page.getByText('Matt Sconce', { exact: false }).first()).toBeVisible();
  }

  async expectMediaMentions() {
    await expect(this.mediaOutlets).toBeVisible({ timeout: 10_000 });
  }

  @Given('I am on the our story page')
  async open() { await this.goto(); }

  @Then('the our story page shows team members')
  async checkTeam() { await this.expectTeamVisible(); }

  @Then('the our story page mentions media outlets')
  async checkMedia() { await this.expectMediaMentions(); }
}
