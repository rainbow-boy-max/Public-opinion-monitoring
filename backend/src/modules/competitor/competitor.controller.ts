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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CompetitorService } from './competitor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class CompetitorConfigDto {
  @IsString()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  keywords: string[];

  @IsArray()
  platforms: string[];
}

class CreateGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetitorConfigDto)
  @ArrayMinSize(1)
  competitors: CompetitorConfigDto[];
}

class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetitorConfigDto)
  competitors?: CompetitorConfigDto[];

  @IsOptional()
  @IsNumber()
  isActive?: number;
}

@Controller('competitor/groups')
@UseGuards(JwtAuthGuard)
export class CompetitorController {
  constructor(private service: CompetitorService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser('id') userId: number, @Body() dto: CreateGroupDto) {
    return this.service.createGroup(userId, dto);
  }

  @Get()
  async list(@CurrentUser('id') userId: number) {
    return this.service.listGroups(userId);
  }

  @Get(':id')
  async get(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getGroup(userId, id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.service.updateGroup(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.deleteGroup(userId, id);
  }

  @Get(':id/comparison')
  async getComparison(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('hours') hours?: number,
  ) {
    return this.service.getComparison(userId, id, { hours });
  }

  @Get(':id/comparison/export')
  async exportComparison(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const data = await this.service.getComparison(userId, id, { hours: 24 });
    const json = JSON.stringify(data, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="competitor-comparison-${id}.json"`,
    );
    res.send(json);
  }
}
