import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Widget } from '../entities/widget.entity';
import { WidgetsService } from './widgets.service';

describe('widget tenant query', () => {
  it('returns not found rather than leaking widget in another tenant', async () => {
    const records = [
      { id: 'one', organizationId: 'org_other', name: 'private' },
    ];
    const repository = {
      findOne: async ({
        where,
      }: {
        where: { id: string; organizationId: string };
      }) =>
        records.find(
          (widget) =>
            widget.id === where.id &&
            widget.organizationId === where.organizationId,
        ) ?? null,
    };
    const module = await Test.createTestingModule({
      providers: [
        WidgetsService,
        { provide: getRepositoryToken(Widget), useValue: repository },
      ],
    }).compile();
    await expect(
      module.get(WidgetsService).findOne('org_caller', 'one'),
    ).rejects.toThrow(NotFoundException);
    await module.close();
  });
});
