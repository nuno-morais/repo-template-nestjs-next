import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { OriginMatcher } from './security/origin-matcher';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const secure = helmet({
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'sameorigin' },
  });
  const docs = helmet({
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'sameorigin' },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path === '/docs' || req.path.startsWith('/docs/') ? docs : secure)(
      req,
      res,
      next,
    ),
  );
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[] = []) =>
        new BadRequestException({
          statusCode: 400,
          message: 'Validation failed.',
          error: 'Bad Request',
          errors: errors.map((item) => ({
            field: item.property,
            message: Object.values(item.constraints || {}).join(', '),
          })),
        }),
    }),
  );
  const matcher = new OriginMatcher(
    config.getOrThrow<string>('CLIENT_ORIGINS'),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, matcher.matches(origin)),
    credentials: true,
  });
}
