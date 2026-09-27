import { ApiProperty } from '@nestjs/swagger';
import { HateoasLinkDto } from '../common/dto/hateoas-link.dto';
import { Widget } from '../entities/widget.entity';
class WidgetLinksDto {
  @ApiProperty({ type: HateoasLinkDto }) self: HateoasLinkDto;
  @ApiProperty({ type: HateoasLinkDto }) collection: HateoasLinkDto;
}
export class WidgetResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' }) id: string;
  @ApiProperty({ example: 'My first widget' }) name: string;
  @ApiProperty({ example: 'Optional description', nullable: true })
  description: string | null;
  @ApiProperty({ example: '2026-09-27T12:00:00.000Z' }) createdAt: string;
  @ApiProperty({ example: '2026-09-27T12:00:00.000Z' }) updatedAt: string;
  @ApiProperty({ type: WidgetLinksDto }) _links: WidgetLinksDto;
  static fromEntity(widget: Widget): WidgetResponseDto {
    const dto = new WidgetResponseDto();
    dto.id = widget.id;
    dto.name = widget.name;
    dto.description = widget.description;
    dto.createdAt = widget.createdAt.toISOString();
    dto.updatedAt = widget.updatedAt.toISOString();
    dto._links = {
      self: { href: `/v1/widgets/${widget.id}` },
      collection: { href: '/v1/widgets' },
    };
    return dto;
  }
}
