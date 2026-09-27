import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WidgetResponseDto } from './widget-response.dto';
import {
  NotFoundResponse,
  UnauthorizedResponse,
  ValidationResponse,
} from '../swagger/common-responses';
export function WidgetsControllerSwagger() {
  return applyDecorators(
    ApiTags('widgets'),
    ApiBearerAuth('bearer'),
    UnauthorizedResponse(),
  );
}
export function CreateWidgetSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a widget' }),
    ApiCreatedResponse({ type: WidgetResponseDto }),
    ValidationResponse(),
  );
}
export function ListWidgetsSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'List widgets for current organization' }),
    ApiOkResponse({ type: [WidgetResponseDto] }),
  );
}
export function GetWidgetSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a widget by id' }),
    ApiOkResponse({ type: WidgetResponseDto }),
    NotFoundResponse('Widget not found'),
  );
}
