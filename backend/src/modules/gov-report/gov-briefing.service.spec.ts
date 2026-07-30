import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GovBriefingService } from './gov-briefing.service';
function createRepo() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 1, createdAt: new Date(), ...value })),
    find: jest.fn(async () => []),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('GovBriefingService', () => {
  it('rejects a reversed date range', async () => {
    const service = new GovBriefingService(createRepo() as any, createRepo() as any);

    await expect(
      service.generate({
        briefingType: 'daily',
        startDate: new Date('2026-07-25'),
        endDate: new Date('2026-07-24'),
        createdBy: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds a generated briefing from collected events', async () => {
    const briefingRepo = createRepo();
    const eventRepo = createRepo();
    eventRepo.find.mockResolvedValue([
      {
        title: '政策动态',
        platform: 'gov',
        sentiment: 'negative',
        createdAt: new Date('2026-07-24T10:00:00Z'),
      },
    ]);
    const service = new GovBriefingService(briefingRepo as any, eventRepo as any);

    const result = await service.generate({
      briefingType: 'daily',
      startDate: new Date('2026-07-24'),
      endDate: new Date('2026-07-24'),
      createdBy: 1,
    });

    expect(result.status).toBe('generated');
    expect(result.content).toContain('政策动态');
    expect(briefingRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects submitting a missing briefing', async () => {
    const briefingRepo = createRepo();
    briefingRepo.findOne.mockResolvedValue(null);
    const service = new GovBriefingService(briefingRepo as any, createRepo() as any);

    await expect(service.submit(1, 'dingtalk')).rejects.toBeInstanceOf(NotFoundException);
  });
});
