import { Injectable, PipeTransform } from '@nestjs/common';
@Injectable()
export class PaginationValidationPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (!value || typeof value !== 'object') return { page: 1, limit: 20 };
    const input = value as Record<string, unknown>;
    const page = Number(input.page ?? 1);
    const limit = Number(input.limit ?? 20);
    return {
      ...input,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20,
    };
  }
}
