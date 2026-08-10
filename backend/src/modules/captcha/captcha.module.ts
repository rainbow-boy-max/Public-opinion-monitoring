import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaptchaService } from './captcha.service';
import { CaptchaController } from './captcha.controller';
import { CaptchaConfigEntity } from '../../database/entities/captcha-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CaptchaConfigEntity])],
  controllers: [CaptchaController],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}