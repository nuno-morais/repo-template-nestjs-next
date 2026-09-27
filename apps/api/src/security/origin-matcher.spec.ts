import { OriginMatcher } from './origin-matcher';

describe('configured browser origin', () => {
  const matcher = new OriginMatcher(
    'https://*.example.com,http://localhost:3002',
  );
  it('allows configured subdomains and exact origins', () => {
    expect(matcher.matches('https://team.example.com')).toBe(true);
    expect(matcher.matches('http://localhost:3002')).toBe(true);
  });
  it('rejects sibling domains, apex, wrong schemes, ports and paths', () => {
    for (const origin of [
      'https://example.com',
      'https://team.example.com.attacker',
      'http://team.example.com',
      'https://team.example.com:8000',
      'https://team.example.com/private',
    ])
      expect(matcher.matches(origin)).toBe(false);
  });
});
