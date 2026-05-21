import { expect, type Locator, type Page } from '@playwright/test';
import { Fixture, Given, Then } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('vrExperiencePage')
export class VrExperiencePage {
  readonly experienceYosemite: Locator;
  readonly bryanCranston: Locator;
  readonly positron: Locator;

  constructor(readonly page: Page) {
    this.experienceYosemite = page.getByText('Experience Yosemite', { exact: false }).first();
    this.bryanCranston = page.getByText('Bryan Cranston', { exact: false }).first();
    this.positron = page.getByText('Positron', { exact: false }).first();
  }

  async goto() { await this.page.goto('/yosemite-vr'); }

  async expectLoaded() {
    await expect(this.experienceYosemite).toBeVisible({ timeout: 15_000 });
  }

  async expectKeyContent() {
    await expect(this.bryanCranston).toBeVisible({ timeout: 10_000 });
    await expect(this.positron).toBeVisible({ timeout: 10_000 });
  }

  @Given('I am on the VR experience page')
  async open() { await this.goto(); }

  @Then('the VR page shows the flagship experience')
  async checkExperience() { await this.expectLoaded(); }

  @Then('the VR page credits Bryan Cranston and mentions Positron technology')
  async checkKeyContent() { await this.expectKeyContent(); }
}
