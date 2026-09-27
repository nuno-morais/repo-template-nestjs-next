export class OriginMatcher {
  private readonly rules: URL[];
  constructor(origins: string) {
    this.rules = origins.split(',').map((origin) => new URL(origin));
  }

  matches(origin: string | undefined | null): boolean {
    if (!origin) return false;
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }
    return this.rules.some((rule) => {
      if (
        url.protocol !== rule.protocol ||
        url.port !== rule.port ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      )
        return false;
      if (rule.hostname.startsWith('*.')) {
        const suffix = rule.hostname.slice(1);
        return (
          url.hostname.endsWith(suffix) && url.hostname.length > suffix.length
        );
      }
      return url.origin === rule.origin;
    });
  }
}
