import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const baseURL = process.env.BASE_URL ?? 'https://www.yosemitecinema.com';
const smokeOnly = process.env.SMOKE_ONLY === '1';

export default defineConfig({
  testDir: '.',
  testIgnore: smokeOnly
    ? [/specs\/e2e\/trace-fail\.spec\.ts/, /specs\/e2e\/workflows\/.*\.spec\.ts/]
    : undefined,
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: /specs\/api\/.*\.spec\.ts/,
      use: { baseURL },
    },
    {
      name: 'ui-chromium',
      testMatch: /specs\/e2e\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL,
      },
    },
  ],
});
