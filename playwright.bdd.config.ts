import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import { defineBddConfig } from 'playwright-bdd';

const baseURL = process.env.BASE_URL ?? 'https://www.yosemitecinema.com';
const smokeOnly = process.env.SMOKE_ONLY === '1';

const testDir = defineBddConfig({
  features: 'bdd/features/*.feature',
  steps: ['bdd/steps/**/*.ts', 'pom/**/*.ts', 'som/**/*.ts'],
});

export default defineConfig({
  testDir,
  grepInvert: smokeOnly ? /@trace-viewer-test/ : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000, // K entry flow + assertions can take up to 60s on a live external site
  workers: 2, // cap at 2 — running against a live external site
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./bdd/cucumber-reporter.cjs', {
      outputFile: 'cucumber-report/index.html',
      externalAttachments: true,
    }],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'bdd-ui-chromium',
      testMatch: /.features-gen\/bdd\/features\/.*\.feature\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL,
      },
    },
  ],
});
