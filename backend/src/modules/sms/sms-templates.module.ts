import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SmsTemplatesController } from './sms-templates.controller';
import { SmsTemplatesService } from './sms-templates.service';
import { SmsLogEntity, AliyunConfigEntity, SmsTemplateEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsTemplateEntity, SmsLogEntity, AliyunConfigEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [SmsTemplatesController],
  providers: [SmsTemplatesService],
  exports: [SmsTemplatesService],
})
export class SmsTemplatesModule {}
