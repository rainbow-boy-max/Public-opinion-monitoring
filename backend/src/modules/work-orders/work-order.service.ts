import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WorkOrderEntity,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  WorkOrderCommentEntity,
} from '../../database/entities';

@Injectable()
export class WorkOrderService {
  private readonly logger = new Logger(WorkOrderService.name);

  constructor(
    @InjectRepository(WorkOrderEntity)
    private orderRepo: Repository<WorkOrderEntity>,
    @InjectRepository(WorkOrderCommentEntity)
    private commentRepo: Repository<WorkOrderCommentEntity>,
  ) {}

  async create(
    userId: number,
    dto: {
      title: string;
      description: string;
      type: WorkOrderType;
      eventId?: number;
      priority?: WorkOrderPriority;
      assignedTo?: number;
      dueAt?: string;
    },
  ): Promise<WorkOrderEntity> {
    const order = this.orderRepo.create({
      userId,
      title: dto.title,
      description: dto.description,
      type: dto.type || WorkOrderType.MANUAL,
      eventId: dto.eventId || null,
      priority: dto.priority || WorkOrderPriority.MEDIUM,
      assignedTo: dto.assignedTo || null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      status: WorkOrderStatus.PENDING,
    });
    return this.orderRepo.save(order);
  }

  async list(
    userId: number,
    filters?: {
      status?: WorkOrderStatus;
      priority?: WorkOrderPriority;
      type?: WorkOrderType;
      assignedTo?: number;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: WorkOrderEntity[]; total: number; page: number; pageSize: number }> {
    const query = this.orderRepo.createQueryBuilder('wo');

    if (filters?.status) {
      query.andWhere('wo.status = :status', { status: filters.status });
    }
    if (filters?.priority) {
      query.andWhere('wo.priority = :priority', { priority: filters.priority });
    }
    if (filters?.type) {
      query.andWhere('wo.type = :type', { type: filters.type });
    }
    if (filters?.assignedTo) {
      query.andWhere('wo.assignedTo = :assignedTo', { assignedTo: filters.assignedTo });
    }
    if (filters?.search) {
      query.andWhere(
        '(wo.title LIKE :search OR wo.description LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await query
      .orderBy('wo.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  async getById(userId: number, id: number): Promise<WorkOrderEntity & { comments: WorkOrderCommentEntity[] }> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Work order not found');
    }
    const comments = await this.commentRepo.find({
      where: { orderId: id },
      order: { createdAt: 'ASC' },
    });
    return { ...order, comments } as any;
  }

  async update(
    userId: number,
    id: number,
    dto: {
      title?: string;
      description?: string;
      priority?: WorkOrderPriority;
      assignedTo?: number;
      dueAt?: string;
    },
  ): Promise<WorkOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Work order not found');
    }
    if (dto.title !== undefined) order.title = dto.title;
    if (dto.description !== undefined) order.description = dto.description;
    if (dto.priority !== undefined) order.priority = dto.priority;
    if (dto.assignedTo !== undefined) order.assignedTo = dto.assignedTo;
    if (dto.dueAt !== undefined) order.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    return this.orderRepo.save(order);
  }

  async assign(id: number, userId: number, assigneeId: number): Promise<WorkOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Work order not found');
    }
    order.assignedTo = assigneeId;
    if (order.status === WorkOrderStatus.PENDING) {
      order.status = WorkOrderStatus.IN_PROGRESS;
    }
    return this.orderRepo.save(order);
  }

  async addComment(
    orderId: number,
    userId: number,
    content: string,
  ): Promise<WorkOrderCommentEntity> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Work order not found');
    }
    const comment = this.commentRepo.create({
      orderId,
      userId,
      content,
    });
    return this.commentRepo.save(comment);
  }

  async changeStatus(
    id: number,
    userId: number,
    status: WorkOrderStatus,
    analysis?: string,
    resolution?: string,
    resolutionType?: string,
  ): Promise<WorkOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Work order not found');
    }
    order.status = status;
    if (analysis !== undefined) order.analysis = analysis;
    if (resolution !== undefined) order.resolution = resolution;
    if (resolutionType !== undefined) order.resolutionType = resolutionType;
    if (status === WorkOrderStatus.RESOLVED) {
      order.resolvedAt = new Date();
    }
    return this.orderRepo.save(order);
  }

  async rate(
    id: number,
    userId: number,
    rating: number,
    feedback?: string,
  ): Promise<WorkOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Work order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Only the creator can rate this work order');
    }
    order.rating = rating;
    if (feedback !== undefined) order.feedback = feedback;
    return this.orderRepo.save(order);
  }

  async getStats(): Promise<{
    pending: number;
    inProgress: number;
    resolved: number;
    closed: number;
    total: number;
  }> {
    const counts = await this.orderRepo
      .createQueryBuilder('wo')
      .select('wo.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('wo.status')
      .getRawMany();

    const stats = {
      pending: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
      total: 0,
    };

    for (const row of counts) {
      const key = row.status as string;
      const count = parseInt(row.count, 10);
      if (key === 'pending') stats.pending = count;
      else if (key === 'in_progress') stats.inProgress = count;
      else if (key === 'resolved') stats.resolved = count;
      else if (key === 'closed') stats.closed = count;
      stats.total += count;
    }

    return stats;
  }
}
