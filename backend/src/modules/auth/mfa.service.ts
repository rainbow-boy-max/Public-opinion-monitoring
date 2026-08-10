import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as OTPAuth from 'otpauth';
import { UserMfaEntity } from '../../database/entities/user-mfa.entity';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly issuer = 'OpinionMonitor';

  constructor(
    @InjectRepository(UserMfaEntity)
    private readonly mfaRepo: Repository<UserMfaEntity>,
  ) {}

  async setupMfa(userId: number, username: string): Promise<{ secret: string; qrUrl: string; backupCodes: string[] }> {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: this.issuer,
      label: username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const backupCodes = this.generateBackupCodes(10);
    const backupCodesJson = JSON.stringify(backupCodes);

    let mfa = await this.mfaRepo.findOne({ where: { userId } });
    if (!mfa) {
      mfa = this.mfaRepo.create({
        userId,
        secretKey: secret.base32,
        isEnabled: false,
        backupCodes: backupCodesJson,
      });
    } else {
      mfa.secretKey = secret.base32;
      mfa.backupCodes = backupCodesJson;
      mfa.isEnabled = false;
    }
    await this.mfaRepo.save(mfa);

    return {
      secret: secret.base32,
      qrUrl: totp.toString(),
      backupCodes,
    };
  }

  async enableMfa(userId: number, token: string): Promise<boolean> {
    const mfa = await this.mfaRepo.findOne({ where: { userId } });
    if (!mfa) return false;

    const totp = new OTPAuth.TOTP({
      issuer: this.issuer,
      label: '',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(mfa.secretKey),
    });

    const delta = totp.validate({ token, window: 1 });
    if (delta !== null) {
      mfa.isEnabled = true;
      await this.mfaRepo.save(mfa);
      return true;
    }
    return false;
  }

  async verifyMfa(userId: number, token: string): Promise<boolean> {
    const mfa = await this.mfaRepo.findOne({ where: { userId } });
    if (!mfa || !mfa.isEnabled) return true;

    const totp = new OTPAuth.TOTP({
      issuer: this.issuer,
      label: '',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(mfa.secretKey),
    });

    const delta = totp.validate({ token, window: 1 });
    if (delta !== null) return true;

    if (mfa.backupCodes) {
      const codes = JSON.parse(mfa.backupCodes) as string[];
      const idx = codes.indexOf(token);
      if (idx >= 0) {
        codes.splice(idx, 1);
        mfa.backupCodes = JSON.stringify(codes);
        await this.mfaRepo.save(mfa);
        return true;
      }
    }
    return false;
  }

  async disableMfa(userId: number): Promise<void> {
    await this.mfaRepo.update({ userId }, { isEnabled: false, secretKey: '', backupCodes: null });
  }

  async isMfaEnabled(userId: number): Promise<boolean> {
    const mfa = await this.mfaRepo.findOne({ where: { userId } });
    return mfa?.isEnabled ?? false;
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }
}
