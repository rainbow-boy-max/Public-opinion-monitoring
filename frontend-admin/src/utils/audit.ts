import http from '@/utils/http';

/**
 * 前端操作审计上报
 * 用于记录用户在管理端的关键操作
 */
export async function recordAudit(params: {
  module: string;
  action: string;
  title: string;
  resourceType?: string;
  resourceId?: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await http.post('/admin/audit-events/record', params);
  } catch (err) {
    // 审计失败不阻塞主流程，静默处理
    console.warn('[Audit] Failed to record:', err);
  }
}
