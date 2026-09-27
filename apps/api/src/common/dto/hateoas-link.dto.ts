import { ApiProperty } from '@nestjs/swagger';
export class HateoasLinkDto {
  @ApiProperty({ example: '/v1/widgets/123e4567-e89b-12d3-a456-426614174000' })
  href: string;
  @ApiProperty({ example: 'PUT', required: false }) method?: string;
}
