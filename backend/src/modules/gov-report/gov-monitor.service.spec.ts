import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GovMonitorService } from './gov-monitor.service';

function createRepo() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 1, ...value })),
    remove: jest.fn(),
    find: jest.fn(async () => []),
    findOne: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(async () => ({ affected: 0 })),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => []),
      getManyAndCount: jest.fn(async () => [[], 0]),
    })),
  };
}

describe('GovMonitorService', () => {
  it('rejects an invalid URL', async () => {
    const service = new GovMonitorService(createRepo() as any, createRepo() as any);

    await expect(
      service.createSite({
        siteName: 'test',
        url: 'not-a-url',
        createdBy: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a monitor site with valid URL', async () => {
    const siteRepo = createRepo();
    const service = new GovMonitorService(siteRepo as any, createRepo() as any);

    const result = await service.createSite({
      siteName: '市政府',
      url: 'https://www.gov.cn',
      createdBy: 1,
    });

    expect(result.siteName).toBe('市政府');
    expect(siteRepo.save).toHaveBeenCalled();
  });

  it('throws NotFound for missing site', async () => {
    const siteRepo = createRepo();
    siteRepo.findOne.mockResolvedValue(null);
    const service = new GovMonitorService(siteRepo as any, createRepo() as any);

    await expect(service.getSiteById(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks change as read', async () => {
    const changeRepo = createRepo();
    changeRepo.findOne.mockResolvedValue({ id: 1, isRead: false });
    const service = new GovMonitorService(createRepo() as any, changeRepo as any);

    const result = await service.markChangeRead(1);
    expect(result.isRead).toBe(true);
  });

  it('marks all changes as read', async () => {
    const changeRepo = createRepo();
    changeRepo.update.mockResolvedValue({ affected: 5 });
    const service = new GovMonitorService(createRepo() as any, changeRepo as any);

    const result = await service.markAllRead(1);
    expect(result.updated).toBe(5);
  });

  it('rejects checking a paused site', async () => {
    const siteRepo = createRepo();
    siteRepo.findOne.mockResolvedValue({ id: 1, status: 'paused' });
    const service = new GovMonitorService(siteRepo as any, createRepo() as any);

    await expect(service.checkSite(1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getDueSites returns active sites with due check time', async () => {
    const siteRepo = createRepo();
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => [{ id: 1, siteName: 'due-site' }]),
      getManyAndCount: jest.fn(async () => [[], 0]),
    };
    siteRepo.createQueryBuilder.mockReturnValue(qb);
    const service = new GovMonitorService(siteRepo as any, createRepo() as any);

    const result = await service.getDueSites();
    expect(result).toHaveLength(1);
    expect(result[0].siteName).toBe('due-site');
    expect(qb.where).toHaveBeenCalledWith('site.status = :status', { status: 'active' });
  });

  it('scheduledCheck swallows errors and logs nothing when no due sites', async () => {
    const service = new GovMonitorService(createRepo() as any, createRepo() as any);
    await expect(service.scheduledCheck()).resolves.toBeUndefined();
  });

  it('scheduledCheck processes due sites returned by getDueSites', async () => {
    const siteRepo = createRepo();
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => [{ id: 1, siteName: 'due-site', status: 'active', url: 'https://www.gov.cn' }]),
      getManyAndCount: jest.fn(async () => [[], 0]),
    };
    siteRepo.createQueryBuilder.mockReturnValue(qb);
    siteRepo.findOne.mockResolvedValue({ id: 1, status: 'active', url: 'https://www.gov.cn', cssSelector: null, lastContentHash: null });

    const service = new GovMonitorService(siteRepo as any, createRepo() as any);
    await expect(service.scheduledCheck()).resolves.toBeUndefined();
    expect(siteRepo.save).toHaveBeenCalled();
  });
});
