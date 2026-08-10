import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MfaService } from './mfa.service';
import { MfaController } from './mfa.controller';
import { UserMfaEntity } from '../../database/entities/user-mfa.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserMfaEntity])],
  controllers: [MfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
