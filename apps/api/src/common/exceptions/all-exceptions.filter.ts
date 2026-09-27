import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { CorrelatedRequest } from '../correlation/correlation-id.middleware';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host
      .switchToHttp()
      .getRequest<Request>() as CorrelatedRequest;
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let errors: Array<{ field: string; message: string }> | undefined;
    let code: string | undefined;
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else {
        const detail = body as Record<string, unknown>;
        message =
          typeof detail.message === 'string'
            ? detail.message
            : exception.message;
        error =
          typeof detail.error === 'string' ? detail.error : exception.name;
        if (Array.isArray(detail.errors))
          errors = detail.errors.filter(
            (item): item is { field: string; message: string } =>
              typeof item?.field === 'string' &&
              typeof item?.message === 'string',
          );
      }
    } else if (exception instanceof QueryFailedError) {
      const sqlState = (exception.driverError as { code?: string }).code;
      if (['23505', '23503', '55P03'].includes(sqlState ?? '')) {
        statusCode = HttpStatus.CONFLICT;
        error = 'Conflict';
        message =
          sqlState === '23505'
            ? 'Resource already exists.'
            : sqlState === '23503'
              ? 'Resource is referenced by other records.'
              : 'Concurrent update conflict. Please retry.';
        if (sqlState === '55P03') code = 'CONCURRENCY_CONFLICT';
      } else {
        error = 'Database Error';
        message =
          this.config.getOrThrow('NODE_ENV') === 'production'
            ? 'A database error occurred.'
            : exception.message;
      }
    } else if (
      exception instanceof Error &&
      this.config.getOrThrow('NODE_ENV') !== 'production'
    ) {
      message = exception.message;
      error = exception.name;
    }
    const requestId =
      request.correlationId || request.requestId || randomUUID();
    this.logger.error({
      statusCode,
      error,
      message,
      requestId,
      path: request.url,
    });
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Correlation-Id', requestId);
    response.status(statusCode).json({
      statusCode,
      message,
      error,
      ...(errors ? { errors } : {}),
      ...(code ? { code } : {}),
      ...(request.headers['x-request-id'] || code ? { requestId } : {}),
    });
  }
}
