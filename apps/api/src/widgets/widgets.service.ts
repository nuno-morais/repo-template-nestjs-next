import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Widget } from '../entities/widget.entity';
import { CreateWidgetDto } from './create-widget.dto';
@Injectable()
export class WidgetsService {
  constructor(
    @InjectRepository(Widget) private readonly widgets: Repository<Widget>,
  ) {}
  async create(
    organizationId: string,
    input: CreateWidgetDto,
  ): Promise<Widget> {
    return this.widgets.save(
      this.widgets.create({
        organizationId,
        name: input.name,
        description: input.description ?? null,
      }),
    );
  }
  async findAll(organizationId: string): Promise<Widget[]> {
    return this.widgets.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }
  async findOne(organizationId: string, id: string): Promise<Widget> {
    const widget = await this.widgets.findOne({
      where: { organizationId, id },
    });
    if (!widget) throw new NotFoundException(`Widget ${id} not found`);
    return widget;
  }
}
