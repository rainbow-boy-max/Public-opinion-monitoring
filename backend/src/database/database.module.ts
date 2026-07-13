import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST') || process.env.DB_HOST,
        port: parseInt(configService.get<string>('DB_PORT') || process.env.DB_PORT || '3306', 10),
        username: configService.get<string>('DB_USERNAME') || process.env.DB_USERNAME,
        password: configService.get<string>('DB_PASSWORD') || process.env.DB_PASSWORD,
        database: configService.get<string>('DB_DATABASE') || process.env.DB_DATABASE,
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
        timezone: '+08:00',
        charset: 'utf8mb4',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}