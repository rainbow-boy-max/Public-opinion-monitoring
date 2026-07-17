import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { EcommerceService } from './ecommerce.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

class CreateConfigDto {
  @IsString()
  platform: string;

  @IsString()
  keywords: string;

  @IsOptional()
  @IsString()
  productIds?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateConfigDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsString()
  productIds?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('ecommerce')
@UseGuards(JwtAuthGuard)
export class EcommerceController {
  constructor(private service: EcommerceService) {}

  @Get('configs')
  listConfigs(@CurrentUser('id') userId: number) {
    return this.service.getConfigs(userId);
  }

  @Post('configs')
  @HttpCode(HttpStatus.CREATED)
  createConfig(@CurrentUser('id') userId: number, @Body() dto: CreateConfigDto) {
    return this.service.createConfig(userId, dto);
  }

  @Put('configs/:id')
  updateConfig(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConfigDto,
  ) {
    return this.service.updateConfig(userId, id, dto);
  }

  @Delete('configs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConfig(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteConfig(userId, id);
  }

  @Get('reviews')
  getReviews(
    @CurrentUser('id') userId: number,
    @Query('platform') platform?: string,
    @Query('sentiment') sentiment?: string,
  ) {
    return this.service.getProductReviews(userId, { platform, sentiment });
  }

  @Get('brand-mentions')
  getBrandMentions(@CurrentUser('id') userId: number) {
    return this.service.getBrandMentions(userId);
  }

  @Get('stats')
  getStats(@CurrentUser('id') userId: number) {
    return this.service.getStats(userId);
  }
}
