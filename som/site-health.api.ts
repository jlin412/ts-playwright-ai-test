import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { Fixture, Given, When, Then } from 'playwright-bdd/decorators';
import type { test } from '../bdd/steps/fixtures';

@Fixture<typeof test>('siteHealth')
export class SiteHealth {
  private lastResponse?: APIResponse;

  constructor(readonly request: APIRequestContext) {}

  async waitUntilReady() {
    await expect
      .poll(
        async () => {
          try {
            const r = await this.request.get('/');
            return r.status();
          } catch {
            return 0;
          }
        },
        {
          timeout: 20_000,
          intervals: [500, 1000, 2000],
          message: 'Waiting for site root to return 200',
        },
      )
      .toBe(200);
  }

  async fetch(path: string): Promise<APIResponse> {
    this.lastResponse = await this.request.get(path);
    return this.lastResponse;
  }

  lastStatus(): number | undefined {
    return this.lastResponse?.status();
  }

  @Given('the site is reachable')
  async siteReachable() {
    await this.waitUntilReady();
  }

  @When('I request the {string} page')
  async requestPage(path: string) {
    await this.fetch(path);
  }

  @Then('the response status is OK')
  async checkStatusOk() {
    expect(this.lastResponse, 'a request must be made before asserting status').toBeTruthy();
    expect(this.lastResponse!.ok()).toBeTruthy();
  }
}
