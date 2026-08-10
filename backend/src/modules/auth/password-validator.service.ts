import { Injectable } from '@nestjs/common';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
  maxLength: number;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class PasswordValidatorService {
  private readonly policy: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSpecialChar: true,
    maxLength: 64,
  };

  getPolicy(): PasswordPolicy {
    return { ...this.policy };
  }

  validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password || password.length < this.policy.minLength) {
      errors.push(`密码长度至少 ${this.policy.minLength} 位`);
    }
    if (password && password.length > this.policy.maxLength) {
      errors.push(`密码长度不能超过 ${this.policy.maxLength} 位`);
    }
    if (this.policy.requireUppercase && password && !/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }
    if (this.policy.requireLowercase && password && !/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }
    if (this.policy.requireDigit && password && !/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }
    if (this.policy.requireSpecialChar && password && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(password)) {
      errors.push('密码必须包含特殊字符');
    }

    return { valid: errors.length === 0, errors };
  }
}