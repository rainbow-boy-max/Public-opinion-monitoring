import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WorkOrderService } from './work-order.service';
import {
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
} from '../../database/entities';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

class CreateWorkOrderDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(WorkOrderType)
  type?: WorkOrderType;

  @IsOptional()
  @IsNumber()
  eventId?: number;

  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  @IsOptional()
  @IsNumber()
  assignedTo?: number;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  attachments?: string;
}

class UpdateWorkOrderDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  @IsOptional()
  @IsNumber()
  assignedTo?: number;

  @IsOptional()
  @IsString()
  dueAt?: string;
}

class AssignDto {
  @IsNumber()
  @Min(1)
  assigneeId: number;
}

class AddCommentDto {
  @IsString()
  content: string;
}

class ChangeStatusDto {
  @IsEnum(WorkOrderStatus)
  status: WorkOrderStatus;

  @IsOptional()
  @IsString()
  analysis?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  resolutionType?: string;
}

class RateWorkOrderDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}

@Controller('work-orders')
@UseGuards(JwtAuthGuard)
export class WorkOrderController {
  constructor(private workOrderService: WorkOrderService) {}

  @Get('stats')
  async getStats() {
    const stats = await this.workOrderService.getStats();
    return { success: true, data: stats };
  }

  @Get()
  async list(
    @CurrentUser('id') userId: number,
    @Query('status') status?: WorkOrderStatus,
    @Query('priority') priority?: WorkOrderPriority,
    @Query('type') type?: WorkOrderType,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.workOrderService.list(userId, {
      status,
      priority,
      type,
      search,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    return { success: true, ...result };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser('id') userId: number, @Body() dto: CreateWorkOrderDto) {
    const order = await this.workOrderService.create(userId, {
      title: dto.title,
      description: dto.description,
      type: dto.type || WorkOrderType.MANUAL,
      eventId: dto.eventId,
      priority: dto.priority,
      assignedTo: dto.assignedTo,
      dueAt: dto.dueAt,
      attachments: dto.attachments,
    });
    return { success: true, data: order };
  }

  @Get(':id')
  async getById(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    const order = await this.workOrderService.getById(userId, id);
    return { success: true, data: order };
  }

  @Put(':id')
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderDto,
  ) {
    const order = await this.workOrderService.update(userId, id, dto);
    return { success: true, data: order };
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  async assign(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignDto,
  ) {
    const order = await this.workOrderService.assign(id, userId, dto.assigneeId);
    return { success: true, data: order };
  }

  @Post(':id/comment')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddCommentDto,
  ) {
    const comment = await this.workOrderService.addComment(id, userId, dto.content);
    return { success: true, data: comment };
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  async changeStatus(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStatusDto,
  ) {
    const order = await this.workOrderService.changeStatus(
      id,
      userId,
      dto.status,
      dto.analysis,
      dto.resolution,
      dto.resolutionType,
    );
    return { success: true, data: order };
  }

  @Post(':id/rate')
  @HttpCode(HttpStatus.OK)
  async rate(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RateWorkOrderDto,
  ) {
    const order = await this.workOrderService.rate(id, userId, dto.rating, dto.feedback);
    return { success: true, data: order };
  }
}
