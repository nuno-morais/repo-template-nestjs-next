import { clerkSetup } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';

setup.describe.configure({ mode: 'serial' });

setup('global Clerk setup', async () => {
  if (!process.env.CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') ||
      !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) {
    throw new Error('E2E requires matching Clerk development pk_test_ and sk_test_ keys');
  }
  await clerkSetup();
});
