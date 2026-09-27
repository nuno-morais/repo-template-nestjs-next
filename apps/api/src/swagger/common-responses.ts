import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  GenericErrorDto,
  ValidationErrorDto,
} from '../common/dto/validation-error.dto';
import { PaginationMetaDto } from '../common/dto/paginated-response.dto';
export function UnauthorizedResponse(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiResponse({ status: 401, type: GenericErrorDto }));
}
export function ForbiddenResponse(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiResponse({ status: 403, type: GenericErrorDto }));
}
export function NotFoundResponse(
  message = 'Resource not found',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({ status: 404, description: message, type: GenericErrorDto }),
  );
}
export function ConflictResponse(
  message = 'Resource conflict',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({ status: 409, description: message, type: GenericErrorDto }),
  );
}
export function BadRequestResponse(
  message = 'Bad request',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({ status: 400, description: message, type: GenericErrorDto }),
  );
}
export function ValidationResponse(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: 'Validation failed',
      type: ValidationErrorDto,
    }),
  );
}
export function PaginatedResponse(
  model: Type<unknown>,
  description = 'Paginated list',
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(model, PaginationMetaDto),
    ApiResponse({
      status: 200,
      description,
      schema: {
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
}
