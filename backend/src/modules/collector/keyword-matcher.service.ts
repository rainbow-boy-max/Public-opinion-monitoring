import { Injectable, Logger } from '@nestjs/common';

export interface MatchInput {
  text: string;
  keywords: string[];
  excludeKeywords?: string[];
  matchMode?: 'exact' | 'fuzzy' | 'both';
}

export interface MatchResult {
  matched: boolean;
  matchedKeywords: string[];
}

@Injectable()
export class KeywordMatcherService {
  private readonly logger = new Logger(KeywordMatcherService.name);

  match(input: MatchInput): MatchResult {
    const text = (input.text || '').toLowerCase();
    if (!text) return { matched: false, matchedKeywords: [] };

    const excludeSet = new Set((input.excludeKeywords || []).map((k) => k.toLowerCase()));
    const matchedKeywords: string[] = [];

    for (const kw of input.keywords) {
      const keyword = kw.toLowerCase();
      if (!keyword) continue;

      let isHit = false;
      if (input.matchMode === 'exact' || input.matchMode === 'both') {
        const wordRegex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');
        if (wordRegex.test(text)) isHit = true;
      }
      if (!isHit && (input.matchMode === 'fuzzy' || input.matchMode === 'both' || !input.matchMode)) {
        if (text.includes(keyword)) isHit = true;
      }
      if (!isHit && keyword.includes('*')) {
        const regexBody = keyword.replace(/\\*/g, '.*');
        const fuzzyRegex = new RegExp(`\\b${this.escapeRegex(regexBody).replace(/\\\.\\\*/g, '.*')}\\b`, 'i');
        if (fuzzyRegex.test(text)) isHit = true;
      }

      if (isHit) {
        let inExclude = false;
        for (const ex of excludeSet) {
          if (text.includes(ex) && ex) {
            inExclude = true;
            break;
          }
        }
        if (!inExclude) matchedKeywords.push(kw);
      }
    }

    return { matched: matchedKeywords.length > 0, matchedKeywords: [...new Set(matchedKeywords)] };
  }

  matchBatch(
    texts: Array<{ id: string | number; text: string }>,
    keywords: string[],
    excludeKeywords: string[] = [],
    matchMode: 'exact' | 'fuzzy' | 'both' = 'both',
  ): Array<{ id: string | number; matched: boolean; matchedKeywords: string[] }> {
    return texts.map((t) => ({
      id: t.id,
      ...this.match({ text: t.text, keywords, excludeKeywords, matchMode }),
    }));
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}