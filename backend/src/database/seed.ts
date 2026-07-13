import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';
import * as bcrypt from 'bcryptjs';
import { UserEntity, UserRole, AuthStatus } from './entities/user.entity';

async function seed() {
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(UserEntity);
  const existing = await userRepo.findOne({ where: { username: 'admin' } });
  if (existing) {
    console.log('Admin user already exists, skipping seed.');
    await AppDataSource.destroy();
    return;
  }

  const passwordHash = bcrypt.hashSync('123456', 12);
  const admin = userRepo.create({
    username: 'admin',
    passwordHash,
    phone: '0000000000',
    role: UserRole.ADMIN,
    authStatus: AuthStatus.VERIFIED,
    firstLogin: 1,
    loginAttempts: 0,
  });
  await userRepo.save(admin);
  console.log('Admin user seeded: admin / 123456 (first login will require password change)');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});