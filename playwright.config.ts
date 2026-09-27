import { defineConfig, devices } from '@playwright/test';

const webOrigin = 'http://localhost:{{ web_port }}';
const apiOrigin = 'http://localhost:{{ api_port }}';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: { baseURL: webOrigin, trace: 'retain-on-failure' },
  projects: [
    { name: 'clerk-setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['clerk-setup'],
    },
  ],
  webServer: [
    {
      command: 'yarn start:dev',
      url: `${apiOrigin}/v1/health`,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        PORT: '{{ api_port }}',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:{{ postgres_port + 1 }}/{{ project_name | replace("-", "_") }}_test',
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
        CLIENT_ORIGINS: webOrigin,
      },
    },
    {
      command: 'yarn --cwd apps/web build && yarn --cwd apps/web start',
      url: webOrigin,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_URL: apiOrigin,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || '',
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
      },
    },
  ],
});
