import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IndustryKnowledgeService, IndustryDomain } from './industry-knowledge.service';

@Controller('industry')
@UseGuards(JwtAuthGuard)
export class IndustryKnowledgeController {
  constructor(private readonly industry: IndustryKnowledgeService) {}

  @Get('domains')
  getDomains() {
    return { domains: this.industry.getDomains() };
  }

  @Get('terms')
  getTerms(@Query('domain') domain?: IndustryDomain) {
    return { terms: this.industry.getTerms(domain) };
  }

  @Get('rules')
  getRules(@Query('domain') domain?: IndustryDomain) {
    return { rules: this.industry.getRules(domain) };
  }

  @Post('analyze')
  analyze(@Body() body: { text: string; domain?: IndustryDomain }) {
    return this.industry.analyzeText(body.text, body.domain);
  }
}