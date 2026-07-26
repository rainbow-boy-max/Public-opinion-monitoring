import { Controller, Get, Put, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ShortVideoConfigService } from './short-video-config.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { UpdatePlatformConfigDto, UpdateAliyunConfigDto } from './dto/config.dto';
import { PlatformType } from '../../database/entities/short-video-config.entity';

@Controller('admin/short-video-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ShortVideoConfigController {
  constructor(private readonly configService: ShortVideoConfigService) {}

  @Get('platforms')
  async getAllPlatforms() {
    const configs = await this.configService.getAllPlatformConfigs();
    return { data: configs };
  }

  @Get('platforms/:platform')
  async getPlatform(@Param('platform') platform: PlatformType) {
    const config = await this.configService.getPlatformConfig(platform);
    return { data: config };
  }

  @Put('platforms/:platform')
  async updatePlatform(
    @Param('platform') platform: PlatformType,
    @Body() dto: UpdatePlatformConfigDto,
  ) {
    const config = await this.configService.upsertPlatformConfig({
      platform,
      ...dto,
    });
    return { message: '平台配置已更新', data: config };
  }

  @Post('platforms/:platform/test')
  async testPlatformConnection(@Param('platform') platform: PlatformType) {
    const result = await this.configService.testPlatformConnection(platform);
    return result;
  }

  @Get('aliyun')
  async getAliyunConfig() {
    const config = await this.configService.getAliyunConfig();
    return { data: config };
  }

  @Put('aliyun')
  async updateAliyunConfig(@Body() dto: UpdateAliyunConfigDto) {
    const config = await this.configService.upsertAliyunConfig(dto);
    return { message: '阿里云配置已更新', data: config };
  }

  @Post('aliyun/test')
  async testAliyunConnection() {
    const result = await this.configService.testAliyunConnection();
    return result;
  }
}
