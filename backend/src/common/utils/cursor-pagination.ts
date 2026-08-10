import { Repository, FindOptionsWhere, FindOptionsOrder, MoreThan, LessThan } from 'typeorm';

export interface CursorPaginationOptions<T> {
  repo: Repository<T>;
  where: FindOptionsWhere<T>;
  order: FindOptionsOrder<T>;
  cursorField: keyof T;
  cursorValue?: string | number | Date;
  limit: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
}

export async function cursorPaginate<T>(
  options: CursorPaginationOptions<T>,
): Promise<CursorPaginationResult<T>> {
  const {
    repo,
    where,
    order,
    cursorField,
    cursorValue,
    limit,
    direction = 'forward',
  } = options;

  const take = limit + 1;
  const orderDir = (order as any)[cursorField as string] === 'DESC' ? 'DESC' : 'ASC';

  const cursorWhere: any = { ...where };

  if (cursorValue !== undefined && cursorValue !== null) {
    if (direction === 'forward') {
      cursorWhere[cursorField as string] =
        orderDir === 'DESC' ? LessThan(cursorValue as any) : MoreThan(cursorValue as any);
    } else {
      cursorWhere[cursorField as string] =
        orderDir === 'DESC' ? MoreThan(cursorValue as any) : LessThan(cursorValue as any);
    }
  }

  const items = await repo.find({
    where: cursorWhere,
    order,
    take,
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  let nextCursor: string | null = null;
  let previousCursor: string | null = null;

  if (items.length > 0) {
    const last = items[items.length - 1];
    nextCursor = String((last as any)[cursorField as string]);

    const first = items[0];
    previousCursor = String((first as any)[cursorField as string]);
  }

  return { items, nextCursor, previousCursor, hasMore };
}