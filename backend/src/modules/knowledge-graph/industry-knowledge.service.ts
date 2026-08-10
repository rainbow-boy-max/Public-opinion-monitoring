import { Injectable, Logger } from '@nestjs/common';

export type IndustryDomain = 'finance' | 'auto' | 'fcmg' | 'tech' | 'realestate' | 'healthcare';

export interface IndustryTerm {
  term: string;
  domain: IndustryDomain;
  type: 'product' | 'company' | 'regulation' | 'metric' | 'risk_factor';
  weight: number;
  synonyms: string[];
  description: string;
}

export interface IndustryRule {
  domain: IndustryDomain;
  name: string;
  condition: string;
  riskLevel: 'low' | 'medium' | 'high';
  suggestion: string;
}

@Injectable()
export class IndustryKnowledgeService {
  private readonly logger = new Logger(IndustryKnowledgeService.name);

  private readonly industryTerms: IndustryTerm[] = [
    // 金融
    { term: '逾期', domain: 'finance', type: 'risk_factor', weight: 0.8, synonyms: ['违约', '坏账', '不良'], description: '贷款逾期' },
    { term: '理财', domain: 'finance', type: 'product', weight: 0.6, synonyms: ['基金', '资管', '信托'], description: '理财产品' },
    { term: '降息', domain: 'finance', type: 'metric', weight: 0.5, synonyms: ['利率下调', '降准'], description: '利率调整' },
    { term: '挤兑', domain: 'finance', type: 'risk_factor', weight: 0.9, synonyms: ['恐慌性提现', '集中兑付'], description: '银行挤兑风险' },
    { term: '退市', domain: 'finance', type: 'risk_factor', weight: 0.9, synonyms: ['摘牌', '终止上市'], description: '上市公司退市' },

    // 汽车
    { term: '召回', domain: 'auto', type: 'risk_factor', weight: 0.8, synonyms: ['回厂', '维修计划'], description: '车辆召回' },
    { term: '自燃', domain: 'auto', type: 'risk_factor', weight: 0.9, synonyms: ['起火', '燃烧'], description: '车辆自燃事故' },
    { term: '续航', domain: 'auto', type: 'metric', weight: 0.6, synonyms: ['里程', '电量'], description: '电动车续航里程' },
    { term: '自动驾驶', domain: 'auto', type: 'product', weight: 0.7, synonyms: ['智驾', '辅助驾驶', 'NOA'], description: '自动驾驶技术' },

    // 快消
    { term: '食品安全', domain: 'fcmg', type: 'risk_factor', weight: 0.9, synonyms: ['食品质量', '卫生问题'], description: '食品安全问题' },
    { term: '添加剂', domain: 'fcmg', type: 'risk_factor', weight: 0.7, synonyms: ['防腐剂', '色素', '香精'], description: '食品添加剂' },
    { term: '假货', domain: 'fcmg', type: 'risk_factor', weight: 0.8, synonyms: ['山寨', '仿冒', '盗版'], description: '假冒伪劣产品' },

    // 科技
    { term: '数据泄露', domain: 'tech', type: 'risk_factor', weight: 0.9, synonyms: ['信息泄露', '数据外泄', '隐私泄露'], description: '用户数据泄露' },
    { term: '宕机', domain: 'tech', type: 'risk_factor', weight: 0.8, synonyms: ['崩溃', '无法访问', '服务中断'], description: '系统宕机' },
    { term: '裁员', domain: 'tech', type: 'risk_factor', weight: 0.7, synonyms: ['优化', '缩减', '减员'], description: '公司裁员' },

    // 房地产
    { term: '烂尾', domain: 'realestate', type: 'risk_factor', weight: 0.9, synonyms: ['停工', '延期交付'], description: '楼盘烂尾' },
    { term: '断供', domain: 'realestate', type: 'risk_factor', weight: 0.8, synonyms: ['停贷', '弃房'], description: '房贷断供' },
    { term: '暴雷', domain: 'realestate', type: 'risk_factor', weight: 0.9, synonyms: ['违约', '债务危机'], description: '房企违约' },

    // 医疗
    { term: '医疗事故', domain: 'healthcare', type: 'risk_factor', weight: 0.9, synonyms: ['医疗纠纷', '误诊'], description: '医疗事故' },
    { term: '集采', domain: 'healthcare', type: 'regulation', weight: 0.7, synonyms: ['集中采购', '带量采购'], description: '药品集中采购' },
    { term: '假药', domain: 'healthcare', type: 'risk_factor', weight: 0.9, synonyms: ['假疫苗', '劣药'], description: '假药劣药' },
  ];

  private readonly industryRules: IndustryRule[] = [
    { domain: 'finance', name: '挤兑风险', condition: 'text contains "挤兑" or "恐慌"', riskLevel: 'high', suggestion: '立即启动金融应急预案，联系监管部门' },
    { domain: 'auto', name: '安全召回', condition: 'text contains "召回" and "安全"', riskLevel: 'high', suggestion: '准备召回声明，联系质检部门' },
    { domain: 'fcmg', name: '食品安全', condition: 'text contains "食品" and ("安全" or "中毒")', riskLevel: 'high', suggestion: '启动产品追溯，发布安全声明' },
    { domain: 'tech', name: '数据泄露', condition: 'text contains "数据" and "泄露"', riskLevel: 'high', suggestion: '立即启动安全应急响应，通知受影响用户' },
    { domain: 'realestate', name: '楼盘风险', condition: 'text contains "烂尾" or "停工"', riskLevel: 'high', suggestion: '准备项目进展说明，联系业主沟通' },
    { domain: 'healthcare', name: '医疗安全', condition: 'text contains "医疗" and "事故"', riskLevel: 'high', suggestion: '启动医疗安全应急流程，配合调查' },
  ];

  getTerms(domain?: IndustryDomain): IndustryTerm[] {
    if (domain) return this.industryTerms.filter((t) => t.domain === domain);
    return this.industryTerms;
  }

  getRules(domain?: IndustryDomain): IndustryRule[] {
    if (domain) return this.industryRules.filter((r) => r.domain === domain);
    return this.industryRules;
  }

  getDomains(): IndustryDomain[] {
    return [...new Set(this.industryTerms.map((t) => t.domain))];
  }

  analyzeText(text: string, domain?: IndustryDomain): {
    matchedTerms: IndustryTerm[];
    matchedRules: IndustryRule[];
    riskScore: number;
  } {
    const lower = text.toLowerCase();
    const terms = domain ? this.industryTerms.filter((t) => t.domain === domain) : this.industryTerms;
    const rules = domain ? this.industryRules.filter((r) => r.domain === domain) : this.industryRules;

    const matchedTerms = terms.filter((t) => {
      if (lower.includes(t.term.toLowerCase())) return true;
      return t.synonyms.some((s) => lower.includes(s.toLowerCase()));
    });

    const matchedRules = rules.filter((r) => {
      const parts = r.condition.split(/\s+(and|or)\s+/);
      if (parts.length < 3) return false;
      const field = parts[0];
      const op = parts[1] === 'and' ? 'every' : 'some';
      const conditions = [];
      for (let i = 0; i < parts.length; i += 2) {
        if (parts[i].startsWith('text')) {
          const match = parts[i].match(/"([^"]+)"/);
          if (match) conditions.push(lower.includes(match[1].toLowerCase()));
        }
      }
      return op === 'every' ? conditions.every(Boolean) : conditions.some(Boolean);
    });

    const riskScore = matchedTerms.reduce((sum, t) => sum + t.weight, 0) / Math.max(terms.length, 1);

    return { matchedTerms, matchedRules, riskScore: Math.round(riskScore * 100) / 100 };
  }
}