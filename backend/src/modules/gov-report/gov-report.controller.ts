import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateInstructionDto,
  GenerateBriefingDto,
  QueryBriefingDto,
  QueryInstructionDto,
  SubmitBriefingDto,
  UpdateInstructionDto,
} from './dto/gov-report.dto';
import { GovBriefingService } from './gov-briefing.service';
import { LeaderInstructionService } from './leader-instruction.service';

@Controller('gov')
@UseGuards(JwtAuthGuard)
export class GovReportController {
  constructor(
    private readonly briefingService: GovBriefingService,
    private readonly instructionService: LeaderInstructionService,
  ) {}

  @Post('briefing/generate')
  async generateBriefing(
    @Body() dto: GenerateBriefingDto,
    @CurrentUser('id') userId: number,
  ) {
    const data = await this.briefingService.generate({
      briefingType: dto.briefingType,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      title: dto.title,
      createdBy: userId,
    });
    return { message: '简报生成成功', data };
  }

  @Get('briefing')
  async listBriefings(@Query() query: QueryBriefingDto) {
    return this.briefingService.list(query);
  }

  @Get('briefing/:id')
  async getBriefing(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.briefingService.getById(id) };
  }

  @Post('briefing/:id/submit')
  async submitBriefing(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitBriefingDto,
  ) {
    return {
      message: '简报上报状态已更新',
      data: await this.briefingService.submit(id, dto.submittedTo),
    };
  }

  @Post('instruction')
  async createInstruction(
    @Body() dto: CreateInstructionDto,
    @CurrentUser('id') userId: number,
  ) {
    const data = await this.instructionService.create({
      eventId: dto.eventId,
      leaderName: dto.leaderName,
      instruction: dto.instruction,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      createdBy: userId,
    });
    return { message: '领导批示已创建', data };
  }

  @Get('instruction')
  async listInstructions(@Query() query: QueryInstructionDto) {
    return this.instructionService.list(query);
  }

  @Get('instruction/:id')
  async getInstruction(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.instructionService.getById(id) };
  }

  @Put('instruction/:id')
  async updateInstruction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstructionDto,
  ) {
    const data = await this.instructionService.update(id, {
      status: dto.status,
      handlerName: dto.handlerName,
      feedback: dto.feedback,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
    });
    return { message: '领导批示已更新', data };
  }
}
