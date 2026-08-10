import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordValidatorService } from './password-validator.service';
import { MfaService } from './mfa.service';
import { MfaController } from './mfa.controller';
import { UserEntity, PasswordHistoryEntity, UserMfaEntity } from '../../database/entities';
import { SmsModule } from '../sms/sms.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, PasswordHistoryEntity, UserMfaEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || process.env.JWT_EXPIRES_IN || '7d' },
      }),
    }),
    SmsModule,
    forwardRef(() => AdminModule),
  ],
  controllers: [AuthController, MfaController],
  providers: [AuthService, PasswordValidatorService, MfaService],
  exports: [AuthService, JwtModule, PasswordValidatorService, MfaService],
})
export class AuthModule {}
