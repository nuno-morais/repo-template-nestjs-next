import { validateApiEnvironment } from './api-config';

const base = {
  NODE_ENV: 'test',
  CLERK_SECRET_KEY: 'sk_test_placeholder',
  CLIENT_ORIGINS: 'http://localhost:3002',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5434/widgets_test',
};

describe('API environment', () => {
  it('rejects placeholder and test keys in production even when JWT key exists', () => {
    for (const key of ['sk_test_placeholder', 'sk_test_real']) {
      expect(() =>
        validateApiEnvironment({
          ...base,
          NODE_ENV: 'production',
          CLERK_SECRET_KEY: key,
          CLERK_JWT_KEY: 'public',
          CLIENT_ORIGINS: 'https://app.example.com',
        }),
      ).toThrow(/CLERK_SECRET_KEY/);
    }
  });
  it('accepts test configuration and normalizes database URL', () => {
    expect(validateApiEnvironment(base).DATABASE_URL).toBe(base.DATABASE_URL);
  });
  it('rejects malformed database URL', () => {
    expect(() =>
      validateApiEnvironment({ ...base, DATABASE_URL: 'file:///widgets_test' }),
    ).toThrow(/DATABASE_URL/);
  });
  it('rejects wildcard origins with a path', () => {
    expect(() =>
      validateApiEnvironment({
        ...base,
        CLIENT_ORIGINS: 'https://*.example.com/private',
      }),
    ).toThrow(/CLIENT_ORIGINS/);
  });
});
