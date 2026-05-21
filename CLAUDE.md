# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npx playwright install chromium

# Smoke tests (UI + API)
npm test

# Specific project runs
npm run test:api               # SOM / HTTP health checks only
npm run test:ui                # UI smoke (Chromium)
npm run test:regression        # Full UI regression (no SMOKE_ONLY filter)
npm run test:regression:k      # Single workflow file (workflow-k)

# BDD runs (generates .features-gen/ first, then runs Playwright)
npm run test:bdd               # BDD smoke (bdd-api + bdd-ui-chromium)
npm run test:bdd:api
npm run test:bdd:ui
npm run test:bdd:regression    # Includes @regression-tagged scenarios

# Interactive / debug
npm run debug:ui               # Playwright UI mode (spec tests)
npm run debug:bdd:ui           # Playwright UI mode (BDD tests)

# Reports
npm run report                 # Open Playwright HTML report
npm run report:bdd:html        # Serve Cucumber HTML report

# Override target site
BASE_URL=https://staging.yosemitecinema.com npm run test:ui
```

## Architecture

Tests target **https://www.yosemitecinema.com** — a live external site. All assertions must tolerate network latency (use `expect.poll`, generous timeouts).

### Two parallel test styles, one shared class layer

Every POM and SOM class is annotated with both Playwright fixture types and `playwright-bdd` decorators, so the same class drives both test styles:

- **Spec tests** (`specs/`) — import from `specs/fixtures.ts`, which extends `@playwright/test`'s `base`.
- **BDD tests** (`bdd/`) — import from `bdd/steps/fixtures.ts`, which extends `playwright-bdd`'s `base`. Step definitions come from `@Given`/`@When`/`@Then` decorators on the POM/SOM class methods.

Both fixtures files instantiate the same POM/SOM classes; adding a new page class requires updating both.

### Layer roles

| Layer | Location | Purpose |
|---|---|---|
| POM | `pom/*.page.ts` | UI page interactions; expose `goto()`, `expectLoaded()`, named locators |
| SOM | `som/*.api.ts` | HTTP-level checks via `APIRequestContext` |
| BDD features | `bdd/features/*.feature` | Gherkin scenarios tagged `@smoke`, `@regression`, `@ui`, `@api`, `@fail` |
| BDD steps | `bdd/steps/fixtures.ts`, `hooks.ts` | Fixture wiring + Before/After hooks; step implementations live on POM/SOM classes |
| Workflow specs | `specs/e2e/workflows/` | Multi-step checkout/auth flows, excluded from smoke runs via `SMOKE_ONLY=1` |

### BDD code generation

`bddgen` (from `playwright-bdd`) compiles `.feature` files into runnable Playwright specs under `.features-gen/`. This directory is generated — never edit it directly. The `bddgen` step must run before any BDD test run; the `test:bdd*` npm scripts do this automatically.

### Env / config

- `BASE_URL` — overrides the default target (`https://www.yosemitecinema.com`)
- `SMOKE_ONLY=1` — excludes `trace-fail.spec.ts` and all `specs/e2e/workflows/` from spec runs; excludes `@fail`-tagged scenarios from BDD runs
- `.env` is loaded via `dotenv/config` in both Playwright config files
- CI sets `forbidOnly: true`, `retries: 1`, `workers: 2`; BDD config caps workers at 2 regardless (live external site)

## Conventions

### BDD file naming

Files in `bdd/features/` and `bdd/steps/` are **named by behavior/functionality**, never by workflow letter. The legacy `workflow-a-j.feature` / `workflow-k.feature` / `workflow-k.steps.ts` naming was retired — do NOT recreate it. Current canonical names:

| `bdd/features/` | Tests |
|---|---|
| `page-browsing.feature` | informational pages + nav |
| `authentication.feature` | login form + invalid credentials |
| `ticket-selection.feature` | showtime → ticket add flow |
| `food-and-drink.feature` | concessions / modifier dialog |
| `cart.feature` | cart totals + reactivity |
| `payment.feature` | payment form validation |
| `membership.feature` | membership tiers + promo codes |
| `member-account.feature` | authenticated member flows |

`bdd/steps/` only holds: `fixtures.ts`, `hooks.ts`, and cross-fixture orchestration step files (e.g. `movie-selection.steps.ts`, `checkout-setup.steps.ts`). Single-fixture steps live as `@Given`/`@When`/`@Then` decorators on the corresponding POM class, not as standalone step files.

### POM structure (Pattern A — two-tier within merged POMs)

Each POM in `pom/*.page.ts` is organized into three sections (see [pom/auth.page.ts](pom/auth.page.ts) as the reference):

```
// ── Assertions ──────────────────  → non-decorated expectXxx() helpers
// ── Actions ─────────────────────  → non-decorated action helpers (goto, click, fill…)
// ── BDD step decorators ─────────  → @Given/@When/@Then methods that are *thin* wrappers
```

- Action helpers **may include action-confirmation assertions** about the element being acted on (e.g. `clickNextFoodAndDrink()` waits for the Popcorn category to render — confirming the navigation completed). This is by design.
- Test-case-logic assertions (the thing the scenario is actually verifying) belong in a separate `@Then` step that calls an `expectXxx()` helper.
- Specs in `specs/` consume the non-decorated helpers directly — keep that API surface stable.

### BDD step text style

Step text is **behavior/intention-driven**, not click-by-click. Prefer:
- `When I log in as a member` over `When I enter email / When I enter password / When I click submit`
- `When I select a movie that has scheduled showtimes` over `When I click the first movie card`

For multi-step setup that isn't itself the test (e.g. reaching the payment page to test payment validation), use a composite `@Given` in a `bdd/steps/*.steps.ts` orchestration file rather than a long `Background` of granular steps.

### Pre-merge checklist

Always run both suites locally and confirm they pass before merging or pushing:

```bash
# 1. Spec smoke (API + UI)
npm test

# 2. BDD smoke (9 @smoke scenarios)
npm run bddgen && npx playwright test -c playwright.bdd.config.ts

# 3. BDD full regression (32 scenarios)
npm run test:bdd:regression
```

All three must be green. Do not commit a fix for one suite without re-verifying the other.

### Feature file structure rules

- **Single-scenario feature**: if a feature has only one scenario, do not use a `Background` — inline the setup steps directly into the scenario.
- **Given vs When in scenarios**: if a scenario has no `When` step of its own, any `Given` in that scenario body should be written as `When`. Exception: if the `Background` already contains a `When`, leave the scenario's `Given` as-is (the background provides the action context).
