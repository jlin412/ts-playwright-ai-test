import { createBdd } from 'playwright-bdd';
import { test } from './fixtures';

const { When } = createBdd(test);

// Orchestration step — needs BOTH nowPlayingPage and moviePage,
// so it lives here instead of on a single POM via decorators.
When('I select a movie that has scheduled showtimes', async ({ nowPlayingPage, moviePage }) => {
  await nowPlayingPage.findAndOpenMovieWithShowtimes(moviePage);
});
