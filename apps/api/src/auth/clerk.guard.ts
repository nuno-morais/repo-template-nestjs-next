import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '@clerk/backend';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { OriginMatcher } from '../security/origin-matcher';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    const header: unknown = request.headers.authorization;
    if (
      isPublic &&
      (typeof header !== 'string' || !header.startsWith('Bearer '))
    )
      return true;
    if (typeof header !== 'string' || !/^Bearer [^ ]+$/.test(header))
      throw new UnauthorizedException(
        'Missing or malformed Authorization header',
      );
    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    const jwtKey = this.config.get<string>('CLERK_JWT_KEY');
    if (
      this.config.getOrThrow('NODE_ENV') === 'production' &&
      (!secretKey.startsWith('sk_live_') || secretKey.includes('placeholder'))
    )
      throw new UnauthorizedException(
        'CLERK_SECRET_KEY is not configured for production',
      );
    const origins = this.config.get<string>('CLIENT_ORIGINS') || '*';
    try {
      // authorizedParties is intentionally NOT passed to verifyToken: Clerk's
      // own check requires azp to be present when set, but this guard allows
      // an absent azp (see the OriginMatcher check below) and enforces the
      // match itself only when the caller's token actually carries one.
      const verification = (await verifyToken(header.slice(7), {
        ...(jwtKey ? { jwtKey } : { secretKey }),
      })) as unknown as Record<string, unknown>;
      const rawClaims = (verification?.data ?? verification) as
        Record<string, unknown> | undefined;
      const claims =
        rawClaims && typeof rawClaims === 'object'
          ? (rawClaims as Record<string, unknown>)
          : undefined;
      const errors = verification?.errors;
      if (
        errors ||
        !claims ||
        typeof claims.sub !== 'string' ||
        !claims.sub.trim()
      )
        throw new Error('Token verification failed');
      if (
        typeof claims.azp === 'string' &&
        !new OriginMatcher(origins).matches(claims.azp)
      )
        throw new Error('Unauthorized party');
      const orgObj =
        typeof claims.o === 'object' && claims.o !== null
          ? (claims.o as { id?: unknown; rol?: unknown })
          : undefined;
      const organization = claims.v === 2 ? orgObj?.id : claims.org_id;
      const orgId =
        typeof organization === 'string' && organization.trim()
          ? organization
          : `user_${claims.sub}`;
      const orgRole = claims.v === 2 ? orgObj?.rol : claims.org_role;
      request.user = {
        sub: claims.sub,
        email: typeof claims.email === 'string' ? claims.email : undefined,
        orgId,
        orgRole: typeof orgRole === 'string' ? orgRole : undefined,
      };
      request.orgId = orgId;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
