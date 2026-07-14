import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebSearchConfigEntity } from '../../database/entities';
import { WebSearchService } from './web-search.service';
import { AdminWebSearchController } from './web-search.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebSearchConfigEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [AdminWebSearchController],
  providers: [WebSearchService],
  exports: [WebSearchService],
})
export class WebSearchModule {}