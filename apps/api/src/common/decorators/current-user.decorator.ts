import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export interface AuthenticatedUser {
  sub: string;
  email?: string;
  orgId: string;
  orgRole?: string;
}
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest().user,
);
