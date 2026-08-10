import { CollectorService } from './collector.service';
import { TaskFrequency } from '../../database/entities';

function createTask() {
  return {
    id: 1,
    userId: 1,
    keywords: JSON.stringify(['房产', '房价']),
    excludeKeywords: JSON.stringify([]),
    platforms: ['weibo'],
    matchMode: 'fuzzy',
    frequency: TaskFrequency.FIFTEEN_MIN,
    status: 'enabled',
  };
}

function createMockAdapter() {
  return {
    fetchByKeywords: jest.fn(async () => [
      {
        platform: 'weibo',
        title: '房产市场分析',
        content: '房价走势平稳',
        author: 'user1',
        publishTime: new Date(),
        url: 'https://weibo.com/123',
        readCount: 100,
        likeCount: 10,
        commentCount: 5,
        shareCount: 2,
        rawData: {},
      },
    ]),
    healthCheck: jest.fn(async () => ({ healthy: true })),
    platform: 'weibo',
  };
}

function buildService(overrides: {
  setIfAbsent?: jest.Mock;
  eventSave?: jest.Mock;
  adapterHealthy?: boolean;
  adapterData?: any[];
  redisScanDelete?: jest.Mock;
}) {
  const adapter = createMockAdapter();
  if (overrides.adapterData !== undefined) {
    adapter.fetchByKeywords.mockResolvedValue(overrides.adapterData);
  }
  const adapterRegistry = {
    get: jest.fn(() => adapter),
    isHealthy: jest.fn(() => overrides.adapterHealthy ?? true),
    list: jest.fn(() => []),
    markSuccess: jest.fn(),
    markFailure: jest.fn(),
  };

  const eventSave = overrides.eventSave ?? jest.fn(async (e: any) => ({ ...e, id: 1 }));
  const setIfAbsent = overrides.setIfAbsent ?? jest.fn(async () => true);
  const redisScanDelete = overrides.redisScanDelete ?? jest.fn(async () => 0);

  const taskQueue = { add: jest.fn(), close: jest.fn() };
  const taskRepo = {
    findOne: jest.fn(async () => createTask()),
    find: jest.fn(async () => []),
    update: jest.fn(async () => ({})),
  };
  const keywordMatcher = {
    match: jest.fn(() => ({ matched: true, matchedKeywords: ['房产'] })),
  };
  const normalizer = {
    normalize: jest.fn((raw: any) => ({ ...raw, platform: raw.platform, matchedKeywords: ['房产'] })),
  };
  const redisService = {
    exists: jest.fn(async () => false),
    setIfAbsent,
    scanDelete: redisScanDelete,
    set: jest.fn(async () => {}),
    publish: jest.fn(async () => {}),
  };

  const service = new CollectorService(
    taskQueue as any,
    taskRepo as any,
    { save: eventSave } as any,
    adapterRegistry as any,
    keywordMatcher as any,
    normalizer as any,
    redisService as any,
  );

  return {
    service,
    adapterRegistry,
    eventRepo: { save: eventSave },
    redisService,
    setIfAbsent,
    eventSave,
    redisScanDelete,
    adapter,
  };
}

describe('CollectorService (Phase 12 queue optimization)', () => {
  it('uses setIfAbsent for atomic dedup instead of exists+set', async () => {
    const { service, setIfAbsent } = buildService({});

    await service.processJob({
      id: 1,
      data: {
        taskId: 1,
        userId: 1,
        keywords: ['房产'],
        excludeKeywords: [],
        platforms: ['weibo'],
        matchMode: 'fuzzy',
      },
    } as any);

    expect(setIfAbsent).toHaveBeenCalled();
  });

  it('skips event when setIfAbsent returns false (duplicate)', async () => {
    const { service, setIfAbsent, eventSave } = buildService({
      setIfAbsent: jest.fn(async () => false),
    });

    await service.processJob({
      id: 2,
      data: {
        taskId: 1,
        userId: 1,
        keywords: ['房产'],
        excludeKeywords: [],
        platforms: ['weibo'],
        matchMode: 'fuzzy',
      },
    } as any);

    expect(eventSave).not.toHaveBeenCalled();
  });

  it('skips event when keyword does not match', async () => {
    const { service, eventSave } = buildService({});
    (service as any).keywordMatcher = {
      match: jest.fn(() => ({ matched: false, matchedKeywords: [] })),
    };

    await service.processJob({
      id: 3,
      data: {
        taskId: 1,
        userId: 1,
        keywords: ['科技'],
        excludeKeywords: [],
        platforms: ['weibo'],
        matchMode: 'fuzzy',
      },
    } as any);

    expect(eventSave).not.toHaveBeenCalled();
  });

  it('invalidates dashboard cache after saving events', async () => {
    const { service, redisScanDelete } = buildService({});

    await service.processJob({
      id: 4,
      data: {
        taskId: 1,
        userId: 1,
        keywords: ['房产'],
        excludeKeywords: [],
        platforms: ['weibo'],
        matchMode: 'fuzzy',
      },
    } as any);

    expect(redisScanDelete).toHaveBeenCalledWith('dashboard:widget:1:');
  });
});
