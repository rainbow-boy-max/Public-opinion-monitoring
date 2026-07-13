import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SmsService } from './sms.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IsString, Matches } from 'class-validator';

class TestSmsDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone: string;
}

@Controller('admin/sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SmsController {
  constructor(private smsService: SmsService) {}

  @Post('test')
  async testSms(@Body() dto: TestSmsDto) {
    return this.smsService.sendTestSms(dto.phone);
  }
}
