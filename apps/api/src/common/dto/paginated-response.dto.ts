import { ApiProperty } from '@nestjs/swagger';
export class PaginationMetaDto {
  @ApiProperty({ example: 42 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ example: 3 }) totalPages: number;
}
export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true }) data: T[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
