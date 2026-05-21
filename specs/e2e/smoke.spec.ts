import { expect, test } from '../fixtures';

test.describe('UI smoke', () => {
  test('home page loads', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();
  });

  test('now playing page loads and lists movies', async ({ nowPlayingPage }) => {
    await nowPlayingPage.goto();
    await nowPlayingPage.expectLoaded();

    await expect
      .poll(async () => await nowPlayingPage.movieLinks().count(), {
        timeout: 30_000,
        intervals: [500, 1000, 2000],
        message: 'Waiting for at least one /movie/* link on /now-playing',
      })
      .toBeGreaterThan(0);
  });
});
