import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { MonitorTasksService } from './monitor-tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsArray, IsOptional, IsEnum, IsNumber, Min, ArrayMinSize } from 'class-validator';
import { MatchMode, SentimentFilter, TaskFrequency, TaskStatus } from '../../database/entities';
import { Transform } from 'class-transformer';

class CreateTaskDto {
  @IsString()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  keywords: string[];

  @IsOptional()
  @IsArray()
  excludeKeywords?: string[];

  @IsArray()
  @ArrayMinSize(1)
  platforms: string[];

  @IsOptional()
  @IsEnum(MatchMode)
  matchMode?: MatchMode;

  @IsOptional()
  @IsEnum(SentimentFilter)
  sentimentFilter?: SentimentFilter;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minReadThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minLikeThreshold?: number;

  @IsEnum(TaskFrequency)
  frequency: TaskFrequency;
}

class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  keywords?: string[];

  @IsOptional()
  @IsArray()
  excludeKeywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  platforms?: string[];

  @IsOptional()
  @IsEnum(MatchMode)
  matchMode?: MatchMode;

  @IsOptional()
  @IsEnum(SentimentFilter)
  sentimentFilter?: SentimentFilter;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minReadThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minLikeThreshold?: number;

  @IsOptional()
  @IsEnum(TaskFrequency)
  frequency?: TaskFrequency;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}

@Controller('monitor-tasks')
@UseGuards(JwtAuthGuard)
export class MonitorTasksController {
  constructor(private tasksService: MonitorTasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser('id') userId: number, @Body() dto: CreateTaskDto) {
    return this.tasksService.createTask(userId, dto);
  }

  @Get()
  async list(@CurrentUser('id') userId: number) {
    return this.tasksService.listTasks(userId);
  }

  @Get(':id')
  async get(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tasksService.getTask(userId, id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.tasksService.deleteTask(userId, id);
  }

  @Put(':id/toggle')
  @HttpCode(HttpStatus.OK)
  async toggle(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tasksService.toggleTask(userId, id);
  }

  @Post(':id/run-now')
  @HttpCode(HttpStatus.ACCEPTED)
  async runNow(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.tasksService.ensureTaskOwnedByUser(userId, id);
    await this.tasksService.runNow(id);
    return { message: '已加入采集队列，几秒后查看最新舆情', taskId: id };
  }

  @Get(':id/events')
  async listEvents(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.tasksService.listEvents(userId, id, page, pageSize);
  }
}