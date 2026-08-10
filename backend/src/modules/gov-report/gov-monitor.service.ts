import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { createHash } from 'crypto';
import {
  GovMonitorSiteEntity,
  GovMonitorChangeEntity,
  MonitorSiteStatus,
  MonitorSiteType,
} from '../../database/entities/gov-monitor-site.entity';

interface CrawledItem {
  title: string;
  linkUrl: string | null;
  snippet: string | null;
}

interface CrawlResult {
  items: CrawledItem[];
  contentHash: string;
  rawText: string;
}

@Injectable()
export class GovMonitorService {
  private readonly logger = new Logger(GovMonitorService.name);

  constructor(
    @InjectRepository(GovMonitorSiteEntity)
    private readonly siteRepo: Repository<GovMonitorSiteEntity>,
    @InjectRepository(GovMonitorChangeEntity)
    private readonly changeRepo: Repository<GovMonitorChangeEntity>,
  ) {}

  async createSite(data: {
    siteName: string;
    url: string;
    siteType?: MonitorSiteType;
    cssSelector?: string;
    checkFrequency?: number;
    createdBy: number;
  }): Promise<GovMonitorSiteEntity> {
    this.assertUrl(data.url);
    const site = this.siteRepo.create({
      siteName: data.siteName,
      url: data.url,
      siteType: data.siteType || 'self',
      cssSelector: data.cssSelector || null,
      checkFrequency: data.checkFrequency || 60,
      status: 'active',
      lastCheckedAt: null,
      lastContentHash: null,
      createdBy: data.createdBy,
    });
    return this.siteRepo.save(site);
  }

  async listSites(params: {
    page?: number;
    pageSize?: number;
    status?: MonitorSiteStatus;
    siteType?: MonitorSiteType;
  }): Promise<{
    data: GovMonitorSiteEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const query = this.siteRepo.createQueryBuilder('site');

    if (params.status) {
      query.andWhere('site.status = :status', { status: params.status });
    }
    if (params.siteType) {
      query.andWhere('site.siteType = :siteType', { siteType: params.siteType });
    }

    query
      .orderBy('site.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async getSiteById(id: number): Promise<GovMonitorSiteEntity> {
    const site = await this.siteRepo.findOne({ where: { id } });
    if (!site) {
      throw new NotFoundException('监测站点不存在');
    }
    return site;
  }

  async updateSite(
    id: number,
    data: {
      siteName?: string;
      url?: string;
      siteType?: MonitorSiteType;
      cssSelector?: string;
      checkFrequency?: number;
      status?: MonitorSiteStatus;
    },
  ): Promise<GovMonitorSiteEntity> {
    const site = await this.getSiteById(id);
    if (data.url) this.assertUrl(data.url);
    Object.assign(site, data);
    return this.siteRepo.save(site);
  }

  async deleteSite(id: number): Promise<void> {
    const site = await this.getSiteById(id);
    await this.siteRepo.remove(site);
    await this.changeRepo.delete({ siteId: id });
  }

  async checkSite(id: number): Promise<{
    newChanges: number;
    contentHash: string;
  }> {
    const site = await this.getSiteById(id);
    if (site.status !== 'active') {
      throw new BadRequestException('站点已暂停，无法执行检查');
    }

    const crawlResult = await this.crawlSite(site.url, site.cssSelector);
    const newChanges = await this.detectChanges(
      site.id,
      crawlResult.items,
      crawlResult.contentHash,
      site.lastContentHash,
    );

    site.lastCheckedAt = new Date();
    site.lastContentHash = crawlResult.contentHash;
    await this.siteRepo.save(site);

    this.logger.log(
      `站点 ${site.siteName} 检查完成，发现 ${newChanges} 条变更`,
    );

    return { newChanges, contentHash: crawlResult.contentHash };
  }

  async listChanges(params: {
    siteId?: number;
    isRead?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    data: GovMonitorChangeEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const query = this.changeRepo.createQueryBuilder('change');

    if (params.siteId) {
      query.andWhere('change.siteId = :siteId', { siteId: params.siteId });
    }
    if (typeof params.isRead === 'boolean') {
      query.andWhere('change.isRead = :isRead', { isRead: params.isRead });
    }

    query
      .orderBy('change.detectedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async markChangeRead(id: number): Promise<GovMonitorChangeEntity> {
    const change = await this.changeRepo.findOne({ where: { id } });
    if (!change) {
      throw new NotFoundException('变更记录不存在');
    }
    change.isRead = true;
    return this.changeRepo.save(change);
  }

  async markAllRead(siteId?: number): Promise<{ updated: number }> {
    const condition: Record<string, unknown> = { isRead: false };
    if (siteId) condition.siteId = siteId;
    const result = await this.changeRepo.update(condition, { isRead: true });
    return { updated: result.affected || 0 };
  }

  async getDueSites(): Promise<GovMonitorSiteEntity[]> {
    const now = new Date();
    const qb = this.siteRepo
      .createQueryBuilder('site')
      .where('site.status = :status', { status: 'active' })
      .andWhere(
        '(site.lastCheckedAt IS NULL OR TIMESTAMPDIFF(SECOND, site.lastCheckedAt, :now) >= site.checkFrequency * 60)',
        { now },
      );
    return qb.getMany();
  }

  async checkAllDueSites(): Promise<{ checked: number; totalChanges: number }> {
    const sites = await this.getDueSites();
    let totalChanges = 0;
    let checked = 0;

    for (const site of sites) {
      try {
        const result = await this.checkSite(site.id);
        checked++;
        totalChanges += result.newChanges;
      } catch (err) {
        this.logger.error(`检查站点 ${site.siteName} 失败: ${(err as Error).message}`);
      }
    }

    return { checked, totalChanges };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledCheck(): Promise<void> {
    try {
      const result = await this.checkAllDueSites();
      if (result.checked > 0) {
        this.logger.log(
          `定时检查完成: 检查 ${result.checked} 个站点，发现 ${result.totalChanges} 条变更`,
        );
      }
    } catch (err) {
      this.logger.error(`定时检查官网监测站点失败: ${(err as Error).message}`);
    }
  }

  private async crawlSite(url: string, cssSelector: string | null): Promise<CrawlResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GovMonitorBot/1.0)',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const items = this.parseHtml(html, url, cssSelector);
      const rawText = items.map((i) => i.title).join('\n');
      const contentHash = createHash('sha256').update(rawText).digest('hex');

      return { items, contentHash, rawText };
    } finally {
      clearTimeout(timer);
    }
  }

  private parseHtml(html: string, baseUrl: string, cssSelector: string | null): CrawledItem[] {
    const items: CrawledItem[] = [];

    const titleRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = titleRegex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').trim();
      if (!text || text.length < 4) continue;

      const linkUrl = this.resolveUrl(href, baseUrl);
      items.push({
        title: text.substring(0, 500),
        linkUrl,
        snippet: null,
      });
    }

    if (cssSelector) {
      const selectorPattern = cssSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blockRegexStr =
        '<[^>]*class=["\'][^"\']*' + selectorPattern + '[^"\']*["\'][^>]*>([\\s\\S]*?)<\\/';
      const blockRegex = new RegExp(blockRegexStr, 'gi');
      let blockMatch: RegExpExecArray | null;
      const filteredItems: CrawledItem[] = [];

      while ((blockMatch = blockRegex.exec(html)) !== null) {
        const blockHtml = blockMatch[1];
        const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let linkMatch: RegExpExecArray | null;
        while ((linkMatch = linkRegex.exec(blockHtml)) !== null) {
          const text = linkMatch[2].replace(/<[^>]+>/g, '').trim();
          if (text && text.length >= 4) {
            filteredItems.push({
              title: text.substring(0, 500),
              linkUrl: this.resolveUrl(linkMatch[1], baseUrl),
              snippet: null,
            });
          }
        }
      }

      if (filteredItems.length > 0) return filteredItems.slice(0, 50);
    }

    return items.slice(0, 50);
  }

  private resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return href;
    }
  }

  private async detectChanges(
    siteId: number,
    currentItems: CrawledItem[],
    currentHash: string,
    lastHash: string | null,
  ): Promise<number> {
    if (!lastHash || lastHash === currentHash) return 0;

    const existingChanges = await this.changeRepo.find({
      where: { siteId },
      order: { detectedAt: 'DESC' },
      take: 200,
    });
    const existingHashes = new Set(existingChanges.map((c) => c.contentHash));

    let newCount = 0;
    const now = new Date();

    for (const item of currentItems) {
      const hashInput = item.title + '|' + (item.linkUrl || '');
      const itemHash = createHash('md5').update(hashInput).digest('hex');

      if (!existingHashes.has(itemHash)) {
        const change = this.changeRepo.create({
          siteId,
          changeType: 'new',
          title: item.title,
          linkUrl: item.linkUrl,
          snippet: item.snippet,
          contentHash: itemHash,
          detectedAt: now,
          isRead: false,
        });
        await this.changeRepo.save(change);
        existingHashes.add(itemHash);
        newCount++;
      }
    }

    return newCount;
  }

  private assertUrl(url: string): void {
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('URL 格式不合法');
    }
  }
}
