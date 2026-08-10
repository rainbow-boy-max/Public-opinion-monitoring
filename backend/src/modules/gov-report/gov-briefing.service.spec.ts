import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GovBriefingService } from './gov-briefing.service';

jest.mock('puppeteer', () => ({ launch: jest.fn() }));
jest.mock('marked', () => ({ marked: { parse: jest.fn((s: string) => s) } }));
jest.mock('./gov-briefing-export.service', () => ({
  GovBriefingExportService: jest.fn().mockImplementation(() => ({
    exportWord: jest.fn().mockResolvedValue(Buffer.from('word')),
    exportPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  })),
}));
jest.mock('./gov-submit.service', () => ({
  GovSubmitService: jest.fn().mockImplementation(() => ({
    pushToWebhook: jest.fn().mockResolvedValue(true),
  })),
}));

function createRepo() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 1, createdAt: new Date(), ...value })),
    remove: jest.fn(),
    find: jest.fn(async () => []),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: {
      getRepository: jest.fn(() => ({ findOne: jest.fn(async () => null) })),
    },
  };
}

function createService(overrides: Partial<{ briefingRepo: any; eventRepo: any; llmRouter: any; exportService: any; submitService: any }> = {}) {
  const briefingRepo = overrides.briefingRepo || createRepo();
  const eventRepo = overrides.eventRepo || createRepo();
  const llmRouter = overrides.llmRouter || { chat: jest.fn() };
  const exportService = overrides.exportService || { exportWord: jest.fn().mockResolvedValue(Buffer.from('word')), exportPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
  const submitService = overrides.submitService || { pushToWebhook: jest.fn().mockResolvedValue(true) };
  return new GovBriefingService(briefingRepo, eventRepo, llmRouter, exportService, submitService);
}

describe('GovBriefingService', () => {
  it('rejects a reversed date range', async () => {
    const service = createService();

    await expect(
      service.generate({
        briefingType: 'daily',
        startDate: new Date('2026-07-25'),
        endDate: new Date('2026-07-24'),
        createdBy: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds a generated briefing from collected events (template mode)', async () => {
    const briefingRepo = createRepo();
    const eventRepo = createRepo();
    eventRepo.find.mockResolvedValue([
      {
        title: '政策动态',
        platform: 'gov',
        sentiment: 'negative',
        readCount: 100,
        likeCount: 10,
        commentCount: 5,
        shareCount: 2,
        author: 'test',
        createdAt: new Date('2026-07-24T10:00:00Z'),
      },
    ]);
    const service = createService({ briefingRepo, eventRepo });

    const result = await service.generate({
      briefingType: 'daily',
      startDate: new Date('2026-07-24'),
      endDate: new Date('2026-07-24'),
      useLlm: false,
      createdBy: 1,
    });

    expect(result.status).toBe('generated');
    expect(result.content).toContain('政策动态');
    expect(briefingRepo.save).toHaveBeenCalledTimes(1);
  });

  it('falls back to template when LLM fails', async () => {
    const eventRepo = createRepo();
    eventRepo.find.mockResolvedValue([
      {
        title: '测试事件',
        platform: 'weibo',
        sentiment: 'neutral',
        readCount: 50,
        likeCount: 5,
        commentCount: 1,
        shareCount: 0,
        author: 'user',
        createdAt: new Date(),
      },
    ]);
    const llmRouter = { chat: jest.fn().mockRejectedValue(new Error('LLM unavailable')) };
    const service = createService({ eventRepo, llmRouter });

    const result = await service.generate({
      briefingType: 'weekly',
      startDate: new Date('2026-07-20'),
      endDate: new Date('2026-07-26'),
      useLlm: true,
      createdBy: 1,
    });

    expect(result.status).toBe('generated');
    expect(result.content).toContain('测试事件');
  });

  it('rejects submitting a missing briefing', async () => {
    const briefingRepo = createRepo();
    briefingRepo.findOne.mockResolvedValue(null);
    const service = createService({ briefingRepo });

    await expect(service.submit(1, 'dingtalk')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('submits a generated briefing with webhook', async () => {
    const briefingRepo = createRepo();
    briefingRepo.findOne.mockResolvedValue({
      id: 1,
      status: 'generated',
      content: '内容',
      title: '标题',
    });
    const submitService = { pushToWebhook: jest.fn().mockResolvedValue(true) };
    const service = createService({ briefingRepo, submitService });

    const result = await service.submit(1, 'dingtalk', 'https://oapi.dingtalk.com/robot/send?access_token=xxx');

    expect(result.status).toBe('submitted');
    expect(submitService.pushToWebhook).toHaveBeenCalled();
  });

  it('exports briefing as word', async () => {
    const briefingRepo = createRepo();
    briefingRepo.findOne.mockResolvedValue({
      id: 1,
      content: '# 简报',
      title: '测试简报',
    });
    const exportService = {
      exportWord: jest.fn().mockResolvedValue(Buffer.from('word')),
      exportPdf: jest.fn(),
    };
    const service = createService({ briefingRepo, exportService });

    const result = await service.export(1, 'word');
    expect(result.filename).toContain('.docx');
    expect(result.mimeType).toContain('wordprocessingml');
  });

  it('deletes a briefing', async () => {
    const briefingRepo = createRepo();
    briefingRepo.findOne.mockResolvedValue({ id: 1, content: 'x' });
    const service = createService({ briefingRepo });

    await service.delete(1);
    expect(briefingRepo.remove).toHaveBeenCalled();
  });
});
