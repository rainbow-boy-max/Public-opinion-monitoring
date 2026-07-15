import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsArray, IsInt, IsOptional, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { KeywordSuggestService } from './keyword-suggest.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class SuggestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  keywords: string[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(20)
  count?: number;
}

@Controller('keywords')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KeywordSuggestController {
  constructor(private keywordSuggestService: KeywordSuggestService) {}

  @Post('suggest')
  @HttpCode(HttpStatus.OK)
  async suggest(@Body() dto: SuggestDto) {
    return this.keywordSuggestService.suggestRelated(dto.keywords, dto.count ?? 10);
  }
}
