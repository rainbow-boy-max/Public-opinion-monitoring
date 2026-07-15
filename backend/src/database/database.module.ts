import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const dbType = (configService.get<string>('DB_TYPE') || process.env.DB_TYPE || 'mysql').toLowerCase();
        const common = {
          autoLoadEntities: true,
          logging: false,
          timezone: '+08:00',
          charset: 'utf8mb4',
        };
        if (dbType === 'sqlite') {
          return {
            type: 'better-sqlite3',
            database:
              configService.get<string>('DB_DATABASE_FILE') ||
              process.env.DB_DATABASE_FILE ||
              '/data/app.db',
            synchronize: process.env.DB_SYNC === 'true',
            ...common,
          } as TypeOrmModuleOptions;
        }
        return {
          type: 'mysql',
          host: configService.get<string>('DB_HOST') || process.env.DB_HOST,
          port: parseInt(
            (configService.get<string>('DB_PORT') || process.env.DB_PORT) || '3306',
            10,
          ),
          username: configService.get<string>('DB_USERNAME') || process.env.DB_USERNAME,
          password: configService.get<string>('DB_PASSWORD') || process.env.DB_PASSWORD,
          database: configService.get<string>('DB_DATABASE') || process.env.DB_DATABASE,
          ...common,
          synchronize: process.env.DB_SYNC === 'true' || process.env.DB_SYNCHRONIZE === 'true',
        } as TypeOrmModuleOptions;
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
