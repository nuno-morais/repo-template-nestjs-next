import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ClerkAuthGuard } from './clerk.guard';
import { SyntheticTokenMinter } from '../../test/fixtures/token-minter';

const minter = new SyntheticTokenMinter();
function context(authorization?: string, isPublic = false) {
  const request: {
    headers: { authorization?: string };
    user?: { sub: string };
    orgId?: string;
  } = { headers: { authorization } };
  const handler = () => undefined;
  if (isPublic) Reflect.defineMetadata('isPublic', true, handler);
  return {
    request,
    execution: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => ClerkAuthGuard,
    } as unknown as ExecutionContext,
  };
}

describe('Clerk guard', () => {
  let guard: ClerkAuthGuard;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ClerkAuthGuard,
        Reflector,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => process.env[key],
            get: (key: string) => process.env[key],
          },
        },
      ],
    }).compile();
    guard = module.get(ClerkAuthGuard);
  });
  const original = { ...process.env };
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    process.env.CLERK_JWT_KEY = minter.publicKey;
    process.env.CLIENT_ORIGINS = 'http://localhost:3000,http://localhost:3002';
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it('accepts unsigned health requests, rejects unsigned protected requests', async () => {
    await expect(
      guard.canActivate(context(undefined, true).execution),
    ).resolves.toBe(true);
    await expect(guard.canActivate(context().execution)).rejects.toThrow(
      UnauthorizedException,
    );
  });
  it('uses signed organization claim for tenant scope', async () => {
    const input = context(`Bearer ${minter.mintOrgToken('user_a', 'org_a')}`);
    await expect(guard.canActivate(input.execution)).resolves.toBe(true);
    expect(input.request.orgId).toBe('org_a');
  });
  it('uses signed legacy org_id claim for tenant scope', async () => {
    const input = context(
      `Bearer ${minter.mintToken({ sub: 'user_a', v: undefined, org_id: 'org_legacy' })}`,
    );
    await expect(guard.canActivate(input.execution)).resolves.toBe(true);
    expect(input.request.orgId).toBe('org_legacy');
  });
  it('isolates personal scope when organization claim absent', async () => {
    const input = context(`Bearer ${minter.mintUserToken('user_a')}`);
    await guard.canActivate(input.execution);
    expect(input.request.orgId).toBe('user_user_a');
  });
  it('rejects tampered and expired signed tokens', async () => {
    const good = minter.mintOrgToken('user_a', 'org_a');
    const tampered = good.slice(0, -5) + 'abcde';
    await expect(
      guard.canActivate(context(`Bearer ${tampered}`).execution),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      guard.canActivate(
        context(`Bearer ${minter.mintToken({}, { expiresInSeconds: -60 })}`)
          .execution,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
  it('rejects signed tokens issued for another frontend', async () => {
    const input = context(
      `Bearer ${minter.mintToken({ azp: 'https://malicious.example' })}`,
    );
    await expect(guard.canActivate(input.execution)).rejects.toThrow(
      UnauthorizedException,
    );
  });
  it('rejects a signed token missing subject', async () => {
    await expect(
      guard.canActivate(
        context(`Bearer ${minter.mintToken({ sub: '' })}`).execution,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
