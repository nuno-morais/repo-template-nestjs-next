import { randomUUID } from 'node:crypto';
import { clerk } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

const apiUrl = 'http://localhost:{{ api_port }}/v1/widgets';

test('signed-in user creates and reloads persisted widget', async ({ page }) => {
  const emailAddress = process.env.E2E_CLERK_USER_EMAIL;
  if (!emailAddress) throw new Error('E2E_CLERK_USER_EMAIL must identify seeded Clerk test user');

  await page.goto('/widgets');
  await expect(page).toHaveURL(/\/sign-in(?:[/?]|$)/);

  await page.goto('/');
  await clerk.signIn({ page, emailAddress });
  await page.goto('/widgets');

  const name = `Playwright widget ${randomUUID()}`;
  await page.getByRole('textbox', { name: 'Widget name' }).fill(name);
  const created = page.waitForResponse((response) => response.url() === apiUrl && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  expect(response.request().headers().authorization).toMatch(/^Bearer \S+$/);
  expect((await response.json()).name).toBe(name);

  await page.reload();
  await expect(page.getByTestId('widget-list').getByText(name)).toBeVisible();
});
