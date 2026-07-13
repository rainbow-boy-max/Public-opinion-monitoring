import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VerifyController } from './verify.controller';
import { VerifyRealnameService } from './verify-realname.service';
import { VerifyService } from './verify.service';
import { UserEntity, AliyunConfigEntity, SystemLogEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AliyunConfigEntity, SystemLogEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [VerifyController],
  providers: [VerifyService, VerifyRealnameService],
  exports: [VerifyService, VerifyRealnameService],
})
export class VerifyModule {}
