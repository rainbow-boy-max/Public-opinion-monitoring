import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum AuthStatus {
  UNVERIFIED = 'unverified',
  VERIFIED = 'verified',
  BANNED = 'banned',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index({ unique: true })
  @Column({ length: 64 })
  username: string;

  @Column({ name: 'password_hash', length: 128 })
  passwordHash: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  phone: string;

  @Column({ name: 'real_name', length: 64, nullable: true })
  realName: string | null;

  @Column({ name: 'id_card_hash', length: 128, nullable: true })
  idCardHash: string | null;

  @Column({
    name: 'auth_status',
    type: 'varchar', length: 32,
    enum: AuthStatus,
    default: AuthStatus.UNVERIFIED,
  })
  authStatus: AuthStatus;

  @Column({
    type: 'varchar', length: 32,
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ name: 'first_login', type: 'tinyint', default: 1 })
  firstLogin: number;

  @Column({ name: 'login_attempts', type: 'int', default: 0 })
  loginAttempts: number;

  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
