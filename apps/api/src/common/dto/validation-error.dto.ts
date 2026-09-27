import { ApiProperty } from '@nestjs/swagger';
export class FieldValidationErrorDto {
  @ApiProperty({ example: 'name' }) field: string;
  @ApiProperty({ example: 'name should not be empty' }) message: string;
}
export class ValidationErrorDto {
  @ApiProperty({ example: 400 }) statusCode: number;
  @ApiProperty({ example: 'Validation failed.' }) message: string;
  @ApiProperty({ example: 'Bad Request' }) error: string;
  @ApiProperty({ type: [FieldValidationErrorDto] })
  errors: FieldValidationErrorDto[];
}
export class GenericErrorDto {
  @ApiProperty({ example: 404 }) statusCode: number;
  @ApiProperty({ example: 'Resource not found' }) message: string;
  @ApiProperty({ example: 'Not Found' }) error: string;
}
