import { cursorPaginate } from './cursor-pagination';

interface TestEntity {
  id: number;
  name: string;
  createdAt: Date;
}

function createRepo(items: TestEntity[]) {
  return {
    find: jest.fn(async (opts: any) => {
      const { where, take, order } = opts;
      let filtered = [...items];

      const cursorField = order ? Object.keys(order)[0] : null;
      if (cursorField && where[cursorField] && typeof where[cursorField] === 'object') {
        const op = where[cursorField];
        const val = op._value;
        if (op._type === 'lessThan') {
          filtered = filtered.filter((e) => (e as any)[cursorField] < val);
        } else if (op._type === 'moreThan') {
          filtered = filtered.filter((e) => (e as any)[cursorField] > val);
        }
      }

      Object.keys(where).forEach((key) => {
        if (key === cursorField) return;
        const val = where[key];
        if (typeof val !== 'object' || val === null) {
          filtered = filtered.filter((e) => (e as any)[key] === val);
        }
      });

      filtered.sort((a, b) => {
        const aVal = (a as any)[cursorField || 'createdAt'].getTime();
        const bVal = (b as any)[cursorField || 'createdAt'].getTime();
        const isDesc = order?.[cursorField || 'createdAt'] === 'DESC';
        return isDesc ? bVal - aVal : aVal - bVal;
      });

      return filtered.slice(0, take);
    }),
  };
}

function makeItem(id: number, minutesAgo: number): TestEntity {
  return {
    id,
    name: `item-${id}`,
    createdAt: new Date(Date.now() - minutesAgo * 60 * 1000),
  };
}

describe('cursorPaginate', () => {
  const items = [
    makeItem(1, 10),
    makeItem(2, 20),
    makeItem(3, 30),
    makeItem(4, 40),
    makeItem(5, 50),
    makeItem(6, 60),
  ];

  it('returns first page without cursor', async () => {
    const repo = createRepo(items);
    const result = await cursorPaginate<TestEntity>({
      repo: repo as any,
      where: {} as any,
      order: { createdAt: 'DESC' },
      cursorField: 'createdAt',
      limit: 3,
    });

    expect(result.items).toHaveLength(3);
    expect(result.items[0].id).toBe(1);
    expect(result.nextCursor).toBeTruthy();
    expect(result.hasMore).toBe(true);
  });

  it('returns next page with cursor', async () => {
    const repo = createRepo(items);
    const first = await cursorPaginate<TestEntity>({
      repo: repo as any,
      where: {} as any,
      order: { createdAt: 'DESC' },
      cursorField: 'createdAt',
      limit: 2,
    });

    const second = await cursorPaginate<TestEntity>({
      repo: repo as any,
      where: {} as any,
      order: { createdAt: 'DESC' },
      cursorField: 'createdAt',
      cursorValue: new Date(first.nextCursor!),
      limit: 2,
    });

    expect(second.items).toHaveLength(2);
    expect(second.items[0].id).toBe(3);
  });

  it('returns empty when cursor beyond last item', async () => {
    const repo = createRepo(items);
    const lastItem = items[items.length - 1];
    const result = await cursorPaginate<TestEntity>({
      repo: repo as any,
      where: {} as any,
      order: { createdAt: 'DESC' },
      cursorField: 'createdAt',
      cursorValue: new Date(lastItem.createdAt.getTime() - 1),
      limit: 10,
    });

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});