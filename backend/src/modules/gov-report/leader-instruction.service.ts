import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { LeaderInstructionEntity } from '../../database/entities/leader-instruction.entity';
import type { InstructionStatus } from '../../database/entities/leader-instruction.entity';

@Injectable()
export class LeaderInstructionService {
  constructor(
    @InjectRepository(LeaderInstructionEntity)
    private readonly instructionRepo: Repository<LeaderInstructionEntity>,
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async create(data: {
    eventId: number;
    leaderName: string;
    instruction: string;
    deadline?: Date;
    createdBy: number;
  }): Promise<LeaderInstructionEntity> {
    const eventExists = await this.eventRepo.exist({ where: { id: data.eventId } });
    if (!eventExists) {
      throw new BadRequestException('关联舆情事件不存在');
    }

    const instruction = this.instructionRepo.create({
      eventId: data.eventId,
      leaderName: data.leaderName,
      instruction: data.instruction,
      status: 'pending',
      handlerName: null,
      feedback: null,
      deadline: data.deadline || null,
      completedAt: null,
      createdBy: data.createdBy,
    });
    return this.instructionRepo.save(instruction);
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    status?: InstructionStatus;
  }): Promise<{ data: LeaderInstructionEntity[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const query = this.instructionRepo
      .createQueryBuilder('instruction')
      .leftJoinAndSelect('instruction.event', 'event');

    if (params.status) {
      query.andWhere('instruction.status = :status', { status: params.status });
    }

    query
      .orderBy('instruction.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async getById(id: number): Promise<LeaderInstructionEntity> {
    const instruction = await this.instructionRepo.findOne({
      where: { id },
      relations: ['event'],
    });
    if (!instruction) {
      throw new NotFoundException('领导批示不存在');
    }
    return instruction;
  }

  async update(
    id: number,
    data: {
      status?: InstructionStatus;
      handlerName?: string;
      feedback?: string;
      deadline?: Date;
    },
  ): Promise<LeaderInstructionEntity> {
    const instruction = await this.getById(id);
    const nextStatus = data.status || instruction.status;

    if (
      instruction.status === 'completed' &&
      nextStatus !== 'completed'
    ) {
      throw new BadRequestException('已完成的批示不能回退状态');
    }
    if (nextStatus === 'completed' && !data.feedback && !instruction.feedback) {
      throw new BadRequestException('完成批示前必须填写处理反馈');
    }

    Object.assign(instruction, {
      ...data,
      completedAt:
        nextStatus === 'completed'
          ? instruction.completedAt || new Date()
          : null,
    });
    return this.instructionRepo.save(instruction);
  }
}
