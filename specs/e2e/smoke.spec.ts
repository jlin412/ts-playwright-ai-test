import { test } from '../fixtures';

test.describe('UI smoke', () => {
  test('home page loads', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();
  });

  test('now playing page loads', async ({ nowPlayingPage }) => {
    await nowPlayingPage.goto();
    await nowPlayingPage.expectLoaded();
  });
});
