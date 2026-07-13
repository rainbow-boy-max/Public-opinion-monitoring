import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { VerifyService } from './verify.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

class RealNameVerifyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  realName: string;

  @IsString()
  @Matches(/^[0-9]{17}[0-9X]$/, { message: 'Invalid ID card number' })
  idCard: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone: string;
}

@Controller('verify')
@UseGuards(JwtAuthGuard)
export class VerifyController {
  constructor(private verifyService: VerifyService) {}

  @Post('real-name')
  async submitRealName(
    @CurrentUser('id') userId: number,
    @Body() dto: RealNameVerifyDto,
  ) {
    return this.verifyService.submitRealNameVerification(
      userId,
      dto.realName,
      dto.idCard,
      dto.phone,
    );
  }

  @Get('status')
  async getStatus(@CurrentUser('id') userId: number) {
    return this.verifyService.getVerifyStatus(userId);
  }
}
