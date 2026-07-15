import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../audit/audit-log.decorator';
import { AliyunConfigService, UserManagementService } from './services';
import { TtsService } from '../tts/tts.service';
import { VerifyRealnameService } from '../verify/verify-realname.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { IsString, IsOptional, MinLength, MaxLength, IsIn, Matches } from 'class-validator';
import { AuthStatus } from '../../database/entities';

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

  @IsOptional()
  @IsIn(['common', 'beijing', 'shanghai'])
  endpointType?: 'common' | 'beijing' | 'shanghai';

  @IsOptional()
  @IsIn(['normal', 'md5', 'sm2'])
  paramType?: 'normal' | 'md5' | 'sm2';

  @IsOptional()
  @IsString()
  region?: string;
}

class BanActionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password: string;

  @IsOptional()
  @IsIn(['admin', 'user', 'operator'])
  role?: string;

  @IsOptional()
  authStatus?: AuthStatus;
}

class ResetPasswordDto {
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
    private ttsService: TtsService,
    private verifyRealnameService: VerifyRealnameService,
    private systemLogsService: SystemLogsService,
  ) {}

  @Get('config/aliyun-sms')
  async getSmsConfig() {
    return this.aliyunConfigService.getSmsConfig();
  }

  @Put('config/aliyun-sms')
  @HttpCode(HttpStatus.OK)
  @AuditLog({ module: 'config', action: 'update', resourceType: 'aliyun_sms', titleExpr: '更新短信配置' })
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
  @AuditLog({ module: 'config', action: 'update', resourceType: 'aliyun_verify', titleExpr: '更新三要素认证配置' })
  async updateVerifyConfig(@Body() dto: VerifyConfigDto) {
    await this.aliyunConfigService.saveVerifyConfig(dto);
    return { message: 'Verify config updated successfully' };
  }

  @Get('config/tts')
  async getTtsConfig(@Query('provider') provider?: string) {
    if (provider) {
      const p = this.ttsService.getProviders().find(p => p.name === provider);
      return { provider, configured: p?.active ?? false, providers: this.ttsService.getProviders() };
    }
    return { providers: this.ttsService.getProviders() };
  }

  @Post('config/tts')
  @HttpCode(HttpStatus.OK)
  @AuditLog({ module: 'config', action: 'update', resourceType: 'tts', titleExpr: '保存 TTS 配置' })
  async saveTtsConfig(@Body() dto: { provider: string; apiKey: string; groupId?: string; endpoint?: string }) {
    this.ttsService.updateProviderConfig(dto.provider, {
      apiKey: dto.apiKey,
      groupId: dto.groupId || '',
      endpoint: dto.endpoint || '',
    });
    this.ttsService.setActiveProvider(dto.provider);
    return { message: `TTS ${dto.provider} 配置已保存` };
  }

  @Get('users')
  async listUsers(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.userManagementService.listUsers({
      page,
      pageSize,
      search,
      status,
      role,
      startDate,
      endDate,
    });
  }

  @Put('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  @AuditLog({ module: 'users', action: 'ban', resourceType: 'user', resourceIdParam: 'id', titleExpr: '封禁用户' })
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
  @AuditLog({ module: 'users', action: 'unban', resourceType: 'user', resourceIdParam: 'id', titleExpr: '解封用户' })
  async unbanUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
  ) {
    await this.userManagementService.unbanUser(id, operatorId);
    return { message: 'User unbanned successfully' };
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @AuditLog({ module: 'users', action: 'create', resourceType: 'user', titleExpr: '创建用户 {username}' })
  async createUser(
    @CurrentUser('id') operatorId: number,
    @Body() dto: CreateUserDto,
  ) {
    void operatorId;
    const r = await this.userManagementService.createUser({
      username: dto.username,
      phone: dto.phone,
      password: dto.password,
      role: (dto.role as any) || 'user',
      authStatus: (dto.authStatus as any) || AuthStatus.UNVERIFIED,
    });
    return r;
  }

  @Get('users/:id/detail')
  async getUserDetail(@Param('id', ParseIntPipe) id: number) {
    return this.userManagementService.getUserDetail(id);
  }

  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  @AuditLog({ module: 'users', action: 'reset_password', resourceType: 'user', resourceIdParam: 'id', titleExpr: '重置用户密码' })
  async resetPassword(
    @CurrentUser('id') operatorId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() _dto: ResetPasswordDto,
  ) {
    return this.userManagementService.resetPassword(id, operatorId);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog({ module: 'users', action: 'delete', resourceType: 'user', resourceIdParam: 'id', titleExpr: '删除用户' })
  async deleteUser(
    @CurrentUser('id') operatorId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.userManagementService.deleteUser(id, operatorId);
  }

  @Post('aliyun-verify/test')
  @HttpCode(HttpStatus.OK)
  async testAliyunVerify() {
    return this.verifyRealnameService.testConnection();
  }

  @Post('front-metrics')
  @HttpCode(HttpStatus.NO_CONTENT)
  async frontMetrics(
    @Body() body: { name?: string; durationMs?: number; page?: string; extra?: any; ts?: number },
    @CurrentUser('id') operatorId: number,
    @Req() req: any,
  ): Promise<void> {
    const safeName = (body?.name || 'unknown').toString().slice(0, 64);
    const detail = JSON.stringify({
      durationMs: typeof body?.durationMs === 'number' ? body.durationMs : null,
      page: body?.page || null,
      extra: body?.extra || null,
      ts: body?.ts || Date.now(),
    });
    const xff = req?.headers?.['x-forwarded-for'];
    const ip =
      typeof xff === 'string'
        ? xff.split(',')[0].trim()
        : req?.ip || req?.socket?.remoteAddress || null;
    await this.systemLogsService.log(
      'info',
      'frontend',
      `metric:${safeName}`,
      detail,
      operatorId,
      ip || undefined,
    );
    return;
  }
}
