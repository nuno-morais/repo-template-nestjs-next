# E2E tests

Requires dedicated Clerk **development/test instance per generated project**, seeded test user, reachable PostgreSQL, browser binaries. No shared project credentials, fake tokens, skipped sign-in, or production keys.

## Setup

1. Create Clerk development instance for this project. Enable email sign-in. Set `CLERK_PUBLISHABLE_KEY=pk_test_...`, `CLERK_SECRET_KEY=sk_test_...` as exported shell variables or CI secrets. Never expose secret key through `NEXT_PUBLIC_` variables. Use matching keys from same instance.
2. Create test user in that instance with email containing `+clerk_test@`, such as `e2e+clerk_test@example.com`. Export `E2E_CLERK_USER_EMAIL` exactly matching seeded email. Clerk `@clerk/testing` signs in user with backend sign-in token; no manually entered password needed. See [Clerk Playwright setup](https://clerk.com/docs/guides/development/testing/playwright/overview) and [sign-in helper](https://clerk.com/docs/guides/development/testing/playwright/test-helpers).
3. Start test database: `docker compose -f docker-compose.test.yml up -d`. Export `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:{{ postgres_port + 1 }}/{{ project_name | replace("-", "_") }}_test` (replace credentials if compose settings differ). Run `yarn migration:run` against this test database. Keep database running during test; test writes uniquely named widgets.
4. Install dependencies using `yarn install`. Install Chromium once with `yarn playwright install chromium` (CI runner needs OS browser dependencies too).
5. Run `yarn test:e2e`. Playwright starts API and builds/starts web with test Clerk keys, runs Clerk setup, signs in seeded user, creates widget through authenticated API, reloads page, checks persisted list. Export variables in CI environment rather than relying on `.env` auto-loading by Playwright. `npx playwright test --list` only discovers tests; it **does not** verify sign-in or persistence.

Use isolated Clerk instance and database for parallel CI projects. Do not print keys in logs.
