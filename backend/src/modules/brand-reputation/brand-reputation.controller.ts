import {
  Controller,
  Post,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BrandReputationService } from './brand-reputation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class ReputationQueryDto {
  brandKeywords: string[];
  days?: number;
}

class CompareQueryDto {
  brandA: string[];
  brandB: string[];
}

@Controller('brand-reputation')
@UseGuards(JwtAuthGuard)
export class BrandReputationController {
  constructor(private readonly service: BrandReputationService) {}

  @Post()
  async getReputation(
    @CurrentUser('id') userId: number,
    @Body() body: ReputationQueryDto,
  ) {
    return this.service.getReputation(userId, body.brandKeywords, { days: body.days });
  }

  @Post('compare')
  async compare(
    @CurrentUser('id') userId: number,
    @Body() body: CompareQueryDto,
  ) {
    return this.service.getBrandComparison(userId, body.brandA, body.brandB);
  }
}
