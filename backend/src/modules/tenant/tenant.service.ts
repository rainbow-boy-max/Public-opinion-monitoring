import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity, UserEntity } from '../../database/entities';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(TenantEntity) private tenantRepo: Repository<TenantEntity>,
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
  ) {}

  isTenantEnabled(): boolean {
    return process.env.TENANT_ENABLED === 'true';
  }

  async create(data: { name: string; slug: string; settings?: string; maxUsers?: number }): Promise<TenantEntity> {
    const existing = await this.tenantRepo.findOne({ where: { slug: data.slug } });
    if (existing) {
      throw new ConflictException('Tenant slug already exists');
    }
    const tenant = this.tenantRepo.create({
      name: data.name,
      slug: data.slug,
      settings: data.settings || null,
      maxUsers: data.maxUsers ?? 10,
    });
    return this.tenantRepo.save(tenant);
  }

  async findAll(): Promise<TenantEntity[]> {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: number): Promise<TenantEntity> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<TenantEntity | null> {
    return this.tenantRepo.findOne({ where: { slug } });
  }

  async update(id: number, data: Partial<{ name: string; slug: string; settings: string; maxUsers: number; isActive: number }>): Promise<TenantEntity> {
    const tenant = await this.findById(id);
    if (data.slug && data.slug !== tenant.slug) {
      const existing = await this.tenantRepo.findOne({ where: { slug: data.slug } });
      if (existing) throw new ConflictException('Tenant slug already exists');
    }
    Object.assign(tenant, data);
    return this.tenantRepo.save(tenant);
  }

  async getTenantUsers(tenantId: number): Promise<Partial<UserEntity>[]> {
    const users = await this.userRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      phone: u.phone,
      realName: u.realName,
      authStatus: u.authStatus,
      role: u.role,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
  }

  async countTenantUsers(tenantId: number): Promise<number> {
    return this.userRepo.count({ where: { tenantId } });
  }

  async setActive(id: number, isActive: boolean): Promise<TenantEntity> {
    const tenant = await this.findById(id);
    tenant.isActive = isActive ? 1 : 0;
    return this.tenantRepo.save(tenant);
  }
}
