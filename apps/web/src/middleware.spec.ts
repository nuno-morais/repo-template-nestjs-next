import { describe, expect, it, vi } from 'vitest';
import type * as ClerkServer from '@clerk/nextjs/server';

vi.mock('@clerk/nextjs/server', async (importOriginal) => {
  const actual = await importOriginal<typeof ClerkServer>();
  return {
    ...actual,
    clerkMiddleware: (handler: unknown) => handler,
  };
});

import middleware from './middleware';

const redirect = new Error('Redirect to sign-in');
const guard = {
  protect: vi.fn(async () => {
    throw redirect;
  }),
};

async function visit(pathname: string) {
  await (
    middleware as unknown as (
      auth: typeof guard,
      req: { nextUrl: { pathname: string } },
    ) => Promise<void>
  )(guard, { nextUrl: { pathname } });
}

describe('Clerk route protection', () => {
  it.each(['/', '/sign-in', '/sign-in/factor-one', '/sign-up'])(
    'keeps %s public',
    async (route) => {
      guard.protect.mockClear();
      await expect(visit(route)).resolves.toBeUndefined();
      expect(guard.protect).not.toHaveBeenCalled();
    },
  );

  it.each(['/widgets', '/widgets/123', '/admin'])(
    'protects %s',
    async (route) => {
      guard.protect.mockClear();
      await expect(visit(route)).rejects.toBe(redirect);
      expect(guard.protect).toHaveBeenCalledOnce();
    },
  );
});
