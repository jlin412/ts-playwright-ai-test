import { test as base, expect } from '@playwright/test';

import { HomePage } from '../pom/home.page';
import { NowPlayingPage } from '../pom/now-playing.page';
import { MoviePage } from '../pom/movie.page';
import { CheckoutShowingPage } from '../pom/checkout-showing.page';
import { CheckoutItemsPage } from '../pom/checkout-items.page';
import { CheckoutCartPage } from '../pom/checkout-cart.page';
import { CheckoutPaymentPage } from '../pom/checkout-payment.page';
import { ComingSoonPage } from '../pom/coming-soon.page';
import { CalendarPage } from '../pom/calendar.page';
import { MembershipPage } from '../pom/membership.page';
import { VrExperiencePage } from '../pom/vr-experience.page';
import { OurStoryPage } from '../pom/our-story.page';
import { ContactPage } from '../pom/contact.page';
import { AuthPage } from '../pom/auth.page';
import { AccountPage } from '../pom/account.page';
import { SiteHealth } from '../som/site-health.api';

type Fixtures = {
  homePage: HomePage;
  nowPlayingPage: NowPlayingPage;
  moviePage: MoviePage;
  checkoutShowingPage: CheckoutShowingPage;
  checkoutItemsPage: CheckoutItemsPage;
  checkoutCartPage: CheckoutCartPage;
  checkoutPaymentPage: CheckoutPaymentPage;
  comingSoonPage: ComingSoonPage;
  calendarPage: CalendarPage;
  membershipPage: MembershipPage;
  vrExperiencePage: VrExperiencePage;
  ourStoryPage: OurStoryPage;
  contactPage: ContactPage;
  authPage: AuthPage;
  accountPage: AccountPage;
  siteHealth: SiteHealth;
};

export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  nowPlayingPage: async ({ page }, use) => {
    await use(new NowPlayingPage(page));
  },
  moviePage: async ({ page }, use) => {
    await use(new MoviePage(page));
  },
  checkoutShowingPage: async ({ page }, use) => {
    await use(new CheckoutShowingPage(page));
  },
  checkoutItemsPage: async ({ page }, use) => {
    await use(new CheckoutItemsPage(page));
  },
  checkoutCartPage: async ({ page }, use) => {
    await use(new CheckoutCartPage(page));
  },
  checkoutPaymentPage: async ({ page }, use) => {
    await use(new CheckoutPaymentPage(page));
  },
  comingSoonPage: async ({ page }, use) => { await use(new ComingSoonPage(page)); },
  calendarPage: async ({ page }, use) => { await use(new CalendarPage(page)); },
  membershipPage: async ({ page }, use) => { await use(new MembershipPage(page)); },
  vrExperiencePage: async ({ page }, use) => { await use(new VrExperiencePage(page)); },
  ourStoryPage: async ({ page }, use) => { await use(new OurStoryPage(page)); },
  contactPage: async ({ page }, use) => { await use(new ContactPage(page)); },
  authPage: async ({ page }, use) => { await use(new AuthPage(page)); },
  accountPage: async ({ page }, use) => { await use(new AccountPage(page)); },
  siteHealth: async ({ request }, use) => {
    await use(new SiteHealth(request));
  },
});

export { expect };
