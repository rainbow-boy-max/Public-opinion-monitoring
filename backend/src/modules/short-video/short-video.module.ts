import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ShortVideoController } from './short-video.controller';
import { ShortVideoService } from './short-video.service';
import { ShortVideoEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShortVideoEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [ShortVideoController],
  providers: [ShortVideoService],
  exports: [ShortVideoService],
})
export class ShortVideoModule {}
