import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MonitorTaskEntity,
  OpinionEventEntity,
  MatchMode,
  SentimentFilter,
  TaskFrequency,
  TaskStatus,
} from '../../database/entities';

export interface CreateMonitorTaskDto {
  name: string;
  keywords: string[];
  excludeKeywords?: string[];
  platforms: string[];
  matchMode?: MatchMode;
  sentimentFilter?: SentimentFilter;
  minReadThreshold?: number;
  minLikeThreshold?: number;
  frequency: TaskFrequency;
}

export interface UpdateMonitorTaskDto extends Partial<CreateMonitorTaskDto> {
  status?: TaskStatus;
}

@Injectable()
export class MonitorTasksService {
  private readonly logger = new Logger(MonitorTasksService.name);

  constructor(
    @InjectRepository(MonitorTaskEntity)
    private taskRepo: Repository<MonitorTaskEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async createTask(userId: number, dto: CreateMonitorTaskDto): Promise<MonitorTaskEntity> {
    if (!dto.keywords || dto.keywords.length === 0) {
      throw new BadRequestException('Keywords cannot be empty');
    }
    if (!dto.platforms || dto.platforms.length === 0) {
      throw new BadRequestException('Platforms cannot be empty');
    }

    const task = this.taskRepo.create({
      userId,
      name: dto.name,
      keywords: JSON.stringify(dto.keywords),
      excludeKeywords: dto.excludeKeywords ? JSON.stringify(dto.excludeKeywords) : null,
      platforms: dto.platforms,
      matchMode: dto.matchMode || MatchMode.BOTH,
      sentimentFilter: dto.sentimentFilter || SentimentFilter.ALL,
      minReadThreshold: dto.minReadThreshold || 0,
      minLikeThreshold: dto.minLikeThreshold || 0,
      frequency: dto.frequency,
      status: TaskStatus.ENABLED,
      lastRunAt: new Date(),
    });
    await this.taskRepo.save(task);
    this.logger.log(`Monitor task created: id=${task.id} userId=${userId}`);
    return task;
  }

  async listTasks(userId: number): Promise<MonitorTaskEntity[]> {
    return this.taskRepo.find({
      where: { userId },
      order: { lastRunAt: 'DESC', id: 'DESC' },
    });
  }

  async getTask(userId: number, taskId: number): Promise<MonitorTaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');
    return task;
  }

  async updateTask(userId: number, taskId: number, dto: UpdateMonitorTaskDto): Promise<MonitorTaskEntity> {
    const task = await this.getTask(userId, taskId);
    if (dto.name !== undefined) task.name = dto.name;
    if (dto.keywords !== undefined) task.keywords = JSON.stringify(dto.keywords);
    if (dto.excludeKeywords !== undefined) {
      task.excludeKeywords = JSON.stringify(dto.excludeKeywords);
    }
    if (dto.platforms !== undefined) task.platforms = dto.platforms;
    if (dto.matchMode !== undefined) task.matchMode = dto.matchMode;
    if (dto.sentimentFilter !== undefined) task.sentimentFilter = dto.sentimentFilter;
    if (dto.minReadThreshold !== undefined) task.minReadThreshold = dto.minReadThreshold;
    if (dto.minLikeThreshold !== undefined) task.minLikeThreshold = dto.minLikeThreshold;
    if (dto.frequency !== undefined) task.frequency = dto.frequency;
    if (dto.status !== undefined) task.status = dto.status;
    await this.taskRepo.save(task);
    this.logger.log(`Monitor task updated: id=${taskId}`);
    return task;
  }

  async deleteTask(userId: number, taskId: number): Promise<void> {
    const task = await this.getTask(userId, taskId);
    await this.taskRepo.remove(task);
    this.logger.log(`Monitor task deleted: id=${taskId}`);
  }

  async toggleTask(userId: number, taskId: number): Promise<MonitorTaskEntity> {
    const task = await this.getTask(userId, taskId);
    task.status = task.status === TaskStatus.ENABLED ? TaskStatus.PAUSED : TaskStatus.ENABLED;
    await this.taskRepo.save(task);
    return task;
  }

  async listEvents(
    userId: number,
    taskId: number,
    page: number,
    pageSize: number,
  ): Promise<{ items: OpinionEventEntity[]; total: number }> {
    const task = await this.getTask(userId, taskId);
    const [items, total] = await this.eventRepo.findAndCount({
      where: { taskId: task.id, status: 0 },
      order: { matchedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total };
  }

  async updateLastRun(taskId: number): Promise<void> {
    await this.taskRepo.update(taskId, { lastRunAt: new Date() });
  }

  async markTaskError(taskId: number): Promise<void> {
    await this.taskRepo.update(taskId, { status: TaskStatus.ERROR });
  }

  parseKeywords(task: MonitorTaskEntity): {
    keywords: string[];
    excludeKeywords: string[];
  } {
    const keywords = JSON.parse(task.keywords) as string[];
    const excludeKeywords = task.excludeKeywords
      ? (JSON.parse(task.excludeKeywords) as string[])
      : [];
    return { keywords, excludeKeywords };
  }
}
