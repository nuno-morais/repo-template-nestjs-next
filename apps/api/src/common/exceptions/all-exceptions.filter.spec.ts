import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './all-exceptions.filter';

function host() {
  const payload: {
    status?: number;
    body?: Record<string, unknown>;
    headers: Record<string, string>;
  } = { headers: {} };
  const response = {
    setHeader: (key: string, value: string) => {
      payload.headers[key] = value;
    },
    status: (code: number) => {
      payload.status = code;
      return response;
    },
    json: (body: Record<string, unknown>) => {
      payload.body = body;
    },
  };
  return {
    payload,
    context: {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-request-id': 'request_1' },
          correlationId: 'request_1',
          url: '/v1/widgets',
        }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost,
  };
}

describe('exception response', () => {
  const filter = new AllExceptionsFilter({
    getOrThrow: () => 'production',
  } as unknown as ConfigService);
  it('preserves validation details and request ID', () => {
    const output = host();
    filter.catch(
      new BadRequestException({
        message: 'Validation failed.',
        errors: [{ field: 'name', message: 'must not be empty' }],
      }),
      output.context,
    );
    expect(output.payload.status).toBe(HttpStatus.BAD_REQUEST);
    expect(output.payload.body).toMatchObject({
      errors: [{ field: 'name', message: 'must not be empty' }],
      requestId: 'request_1',
    });
  });
  it('does not leak internal errors in production', () => {
    const output = host();
    filter.catch(new Error('secret password'), output.context);
    expect(output.payload.status).toBe(500);
    expect(JSON.stringify(output.payload.body)).not.toContain(
      'secret password',
    );
  });
});
