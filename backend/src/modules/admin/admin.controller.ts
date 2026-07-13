import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AliyunConfigService, UserManagementService } from './services';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

class SmsConfigDto {
  @IsString()
  accessKey: string;

  @IsString()
  secretKey: string;

  @IsString()
  signName: string;

  @IsString()
  templateCode: string;
}

class VerifyConfigDto {
  @IsString()
  accessKey: string;

  @IsString()
  secretKey: string;

  @IsString()
  productCode: string;
}

class BanActionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private aliyunConfigService: AliyunConfigService,
    private userManagementService: UserManagementService,
  ) {}

  @Get('config/aliyun-sms')
  async getSmsConfig() {
    return this.aliyunConfigService.getSmsConfig();
  }

  @Put('config/aliyun-sms')
  @HttpCode(HttpStatus.OK)
  async updateSmsConfig(@Body() dto: SmsConfigDto) {
    await this.aliyunConfigService.saveSmsConfig(dto);
    return { message: 'SMS config updated successfully' };
  }

  @Get('config/aliyun-verify')
  async getVerifyConfig() {
    return this.aliyunConfigService.getVerifyConfig();
  }

  @Put('config/aliyun-verify')
  @HttpCode(HttpStatus.OK)
  async updateVerifyConfig(@Body() dto: VerifyConfigDto) {
    await this.aliyunConfigService.saveVerifyConfig(dto);
    return { message: 'Verify config updated successfully' };
  }

  @Get('users')
  async listUsers(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.userManagementService.listUsers({
      page,
      pageSize,
      search,
      status,
      startDate,
      endDate,
    });
  }

  @Put('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  async banUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
    @Body() _dto: BanActionDto,
  ) {
    await this.userManagementService.banUser(id, operatorId);
    return { message: 'User banned successfully' };
  }

  @Put('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  async unbanUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
  ) {
    await this.userManagementService.unbanUser(id, operatorId);
    return { message: 'User unbanned successfully' };
  }
}
