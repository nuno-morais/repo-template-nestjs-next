import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentOrg } from '../common/decorators/current-org.decorator';
import { CreateWidgetDto } from './create-widget.dto';
import { WidgetResponseDto } from './widget-response.dto';
import { WidgetsService } from './widgets.service';
import {
  CreateWidgetSwagger,
  GetWidgetSwagger,
  ListWidgetsSwagger,
  WidgetsControllerSwagger,
} from './widgets.swagger';
@Controller('widgets')
@WidgetsControllerSwagger()
export class WidgetsController {
  constructor(private readonly widgets: WidgetsService) {}
  @Post()
  @CreateWidgetSwagger()
  async create(
    @CurrentOrg() organizationId: string,
    @Body() input: CreateWidgetDto,
  ): Promise<WidgetResponseDto> {
    return WidgetResponseDto.fromEntity(
      await this.widgets.create(organizationId, input),
    );
  }
  @Get()
  @ListWidgetsSwagger()
  async findAll(
    @CurrentOrg() organizationId: string,
  ): Promise<WidgetResponseDto[]> {
    return (await this.widgets.findAll(organizationId)).map(
      WidgetResponseDto.fromEntity,
    );
  }
  @Get(':id')
  @GetWidgetSwagger()
  async findOne(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WidgetResponseDto> {
    return WidgetResponseDto.fromEntity(
      await this.widgets.findOne(organizationId, id),
    );
  }
}
