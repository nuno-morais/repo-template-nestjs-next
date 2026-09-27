import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
export const CurrentOrg = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    if (typeof request.orgId !== 'string' || !request.orgId)
      throw new UnauthorizedException(
        'No organization context found in session',
      );
    return request.orgId;
  },
);
