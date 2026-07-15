import { Controller, Get, Post, Put, Param, Body, UseGuards, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantService } from './tenant.service';

class CreateTenantDto {
  name: string;
  slug: string;
  settings?: string;
  maxUsers?: number;
}

class UpdateTenantDto {
  name?: string;
  slug?: string;
  settings?: string;
  maxUsers?: number;
  isActive?: number;
}

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class TenantController {
  constructor(private tenantService: TenantService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get()
  async list() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.findById(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }

  @Put(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.setActive(id, true);
  }

  @Put(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.setActive(id, false);
  }

  @Get(':id/users')
  async users(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.getTenantUsers(id);
  }
}
