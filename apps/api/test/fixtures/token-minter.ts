import { createSign, generateKeyPairSync } from 'node:crypto';
export interface SyntheticTokenClaims {
  sub?: string;
  org_id?: string;
  org_role?: string;
  o?: { id: string; rol?: string };
  email?: string;
  azp?: string;
  iss?: string;
  [key: string]: unknown;
}
export interface MintTokenOptions {
  expiresInSeconds?: number;
  header?: Record<string, unknown>;
}
export class SyntheticTokenMinter {
  readonly publicKey: string;
  private readonly privateKey: string;
  constructor() {
    const keys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    this.publicKey = keys.publicKey;
    this.privateKey = keys.privateKey;
  }
  mintToken(
    claims: SyntheticTokenClaims = {},
    options: MintTokenOptions = {},
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({
        alg: 'RS256',
        typ: 'JWT',
        kid: 'local',
        ...options.header,
      }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user_synthetic',
        sid: 'sess_synthetic',
        iss: 'https://local.clerk.accounts.dev',
        iat: now,
        nbf: now - 10,
        exp: now + (options.expiresInSeconds ?? 3600),
        v: 2,
        ...claims,
      }),
    ).toString('base64url');
    const input = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(input);
    return `${input}.${signer.sign(this.privateKey, 'base64url')}`;
  }
  mintUserToken(sub: string, email?: string): string {
    return this.mintToken({ sub, email });
  }
  mintOrgToken(sub: string, orgId: string, orgRole = 'org:admin'): string {
    return this.mintToken({ sub, o: { id: orgId, rol: orgRole.slice(4) } });
  }
}
export const defaultTokenMinter = new SyntheticTokenMinter();
