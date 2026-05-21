# ts-playwright-ai-test

![Framework Architecture](docs/architecture.png)

Playwright + [`playwright-bdd`](https://github.com/vitalets/playwright-bdd) end-to-end tests targeting the live site **https://www.yosemitecinema.com**.

Pattern mirrors `ts-playwright-agentic-test-gen`: the same Page Object / Service Object class powers both spec-style tests and BDD step definitions via `@Fixture`/`@Given`/`@When`/`@Then` decorators.

## Layout

```
pom/    Page Object Models (UI)
som/    Service Object Models (HTTP / health checks)
specs/  Classic *.spec.ts tests
  api/  uses SOM, checks site reachability
  e2e/  uses POM, checks UI rendering
bdd/    BDD .feature files + step bindings
  features/    Gherkin scenarios
  steps/       fixtures + Before/After hooks
```

## Run locally

```bash
npm install
npx playwright install chromium

# Spec smoke (UI + API in default config)
npm test

# Spec smoke (UI only)
npm run test:ui

# SOM site-health
npm run test:api

# BDD smoke (both bdd-api + bdd-ui-chromium)
npm run test:bdd

# Reports
npm run report           # Playwright HTML
npm run report:bdd:html  # Cucumber HTML
```

## Configuration

Override the target site with `BASE_URL`:

```bash
BASE_URL=https://staging.yosemitecinema.com npm run test:ui
```

`SMOKE_ONLY=1` (default in `npm test`) excludes the intentional-failure trace demo when present.
