import { expect, test } from '../fixtures';

test.describe('Site health smoke', () => {
  test('site is reachable and /now-playing returns OK', async ({ siteHealth, baseURL }) => {
    expect(baseURL, 'baseURL must be configured for api project').toBeTruthy();

    await siteHealth.waitUntilReady();

    const res = await siteHealth.fetch('/now-playing');
    expect(res.ok(), `expected 2xx from /now-playing, got ${res.status()}`).toBeTruthy();
  });
});
