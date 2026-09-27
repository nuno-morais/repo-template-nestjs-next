import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export type CorrelatedRequest = Request & {
  correlationId: string;
  requestId: string;
};
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const supplied =
      request.headers['x-request-id'] || request.headers['x-correlation-id'];
    const id =
      typeof supplied === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(supplied)
        ? supplied
        : randomUUID();
    const correlated = request as CorrelatedRequest;
    correlated.correlationId = id;
    correlated.requestId = id;
    response.setHeader('X-Request-Id', id);
    response.setHeader('X-Correlation-Id', id);
    next();
  }
}
