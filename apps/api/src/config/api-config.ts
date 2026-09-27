export type ApiEnvironment = Record<string, unknown> & {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: string;
  CLERK_SECRET_KEY: string;
  CLIENT_ORIGINS: string;
};

export function validateApiEnvironment(
  source: Record<string, unknown>,
): ApiEnvironment {
  const required = (key: string): string => {
    const value = source[key];
    if (typeof value !== 'string' || !value.trim())
      throw new Error(`API configuration error: ${key} is required.`);
    return value.trim();
  };
  const nodeEnvironment = required('NODE_ENV');
  if (!['development', 'test', 'production'].includes(nodeEnvironment))
    throw new Error(
      'API configuration error: NODE_ENV must be development, test, or production.',
    );
  const production = nodeEnvironment === 'production';
  const secret = required('CLERK_SECRET_KEY');
  if (
    production &&
    (!secret.startsWith('sk_live_') || secret.includes('placeholder'))
  )
    throw new Error(
      'API configuration error: CLERK_SECRET_KEY must be a real live key in production.',
    );
  const origins = required('CLIENT_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin.replace('://*.', '://wildcard.'));
    } catch {
      throw new Error(
        'API configuration error: CLIENT_ORIGINS must contain valid origins.',
      );
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== '/' ||
      (production && parsed.hostname.includes('localhost'))
    ) {
      throw new Error(
        'API configuration error: CLIENT_ORIGINS must contain valid origins.',
      );
    }
  }
  const port = (value: unknown, key: string): string => {
    if (
      typeof value !== 'string' ||
      !/^\d+$/.test(value) ||
      +value < 1 ||
      +value > 65535
    )
      throw new Error(
        `API configuration error: ${key} must be a positive TCP port.`,
      );
    return String(+value);
  };
  let database: Record<string, string>;
  if (typeof source.DATABASE_URL === 'string' && source.DATABASE_URL.trim()) {
    try {
      const url = new URL(source.DATABASE_URL);
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !url.hostname ||
        !url.pathname.slice(1)
      )
        throw new Error('invalid');
    } catch {
      throw new Error(
        'API configuration error: DATABASE_URL must be a PostgreSQL URL.',
      );
    }
    database = { DATABASE_URL: source.DATABASE_URL.trim() };
  } else {
    const value = (key: string, fallback: string): string =>
      production ? required(key) : String(source[key] || fallback);
    database = {
      DB_HOST: value('DB_HOST', 'localhost'),
      DB_PORT: port(value('DB_PORT', '5432'), 'DB_PORT'),
      DB_USERNAME: value('DB_USERNAME', 'postgres'),
      DB_PASSWORD: value('DB_PASSWORD', 'postgres'),
      DB_NAME: value('DB_NAME', 'sample_project'),
    };
  }
  return {
    ...source,
    NODE_ENV: nodeEnvironment as ApiEnvironment['NODE_ENV'],
    PORT: port(String(source.PORT || '3000'), 'PORT'),
    CLERK_SECRET_KEY: secret,
    CLIENT_ORIGINS: origins.join(','),
    ...database,
  };
}
