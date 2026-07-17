<template>
  <div class="api-docs">
    <GlassCard title="API 文档" subtitle="Open API 接口参考">
      <div class="api-docs__section">
        <h3>认证</h3>
        <p>所有 API 请求需要在 HTTP 头部携带 API 密钥：</p>
        <pre>X-API-Key: your-api-key-here</pre>
        <p>你可以在「API 密钥管理」页面创建和管理密钥。</p>
      </div>

      <div class="api-docs__section">
        <h3>速率限制</h3>
        <p>每个密钥每分钟有固定的请求额度。超出限制后将在 <code>24</code> 小时内无法访问。</p>
        <ul>
          <li>默认限制：<strong>100 次/分钟</strong></li>
          <li>超限响应：HTTP <code>429 Too Many Requests</code></li>
          <li>响应头包含 <code>X-RateLimit-Remaining</code> 和 <code>X-RateLimit-Reset</code></li>
        </ul>
      </div>

      <div class="api-docs__section">
        <h3>基础 URL</h3>
        <pre>{{ baseUrl }}</pre>
      </div>

      <div class="api-docs__section">
        <h3>端点列表</h3>

        <div v-for="ep in endpoints" :key="ep.path" class="api-docs__endpoint">
          <div class="api-docs__endpoint-header">
            <el-tag :type="ep.method === 'GET' ? 'success' : ep.method === 'POST' ? 'primary' : ep.method === 'DELETE' ? 'danger' : 'warning'" size="small" effect="dark">
              {{ ep.method }}
            </el-tag>
            <code class="api-docs__path">{{ ep.path }}</code>
          </div>
          <p class="api-docs__desc">{{ ep.description }}</p>

          <template v-if="ep.params && ep.params.length">
            <h4>请求参数</h4>
            <el-table :data="ep.params" size="small" stripe>
              <el-table-column prop="name" label="名称" width="120" />
              <el-table-column prop="type" label="类型" width="80" />
              <el-table-column prop="required" label="必填" width="60">
                <template #default="{ row }">
                  <el-tag v-if="row.required" type="danger" size="small">是</el-tag>
                  <el-tag v-else type="info" size="small">否</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" />
            </el-table>
          </template>

          <template v-if="ep.requestExample">
            <h4>请求示例</h4>
            <pre>{{ ep.requestExample }}</pre>
          </template>

          <template v-if="ep.responseExample">
            <h4>响应示例</h4>
            <pre>{{ ep.responseExample }}</pre>
          </template>
        </div>
      </div>

      <div class="api-docs__section">
        <h3>错误码</h3>
        <el-table :data="errorCodes" size="small" stripe>
          <el-table-column prop="code" label="HTTP 状态码" width="120" />
          <el-table-column prop="message" label="说明" />
          <el-table-column prop="cause" label="可能原因" />
        </el-table>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'ApiDocsPage' });

import GlassCard from '@shared/components/GlassCard.vue';

const baseUrl = `${window.location.protocol}//${window.location.hostname}/api/v1`;

const endpoints = [
  {
    method: 'GET',
    path: '/api/v1/events',
    description: '获取舆情事件列表',
    params: [
      { name: 'page', type: 'number', required: false, description: '页码，默认 1' },
      { name: 'pageSize', type: 'number', required: false, description: '每页数量，默认 20' },
      { name: 'platform', type: 'string', required: false, description: '平台过滤' },
      { name: 'sentiment', type: 'string', required: false, description: '情感过滤：positive/negative/neutral' },
      { name: 'startDate', type: 'string', required: false, description: '开始日期 ISO 格式' },
      { name: 'endDate', type: 'string', required: false, description: '结束日期 ISO 格式' },
    ],
    requestExample: `curl -H "X-API-Key: your-key" "${baseUrl}/events?page=1&pageSize=10"`,
    responseExample: `{
  "data": [
    {
      "id": 1,
      "title": "事件标题",
      "platform": "weixin",
      "sentiment": "positive",
      "matchedAt": "2026-07-17T08:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 10
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/events/:id',
    description: '获取单个事件详情',
    requestExample: `curl -H "X-API-Key: your-key" "${baseUrl}/events/1"`,
    responseExample: `{
  "id": 1,
  "title": "事件标题",
  "content": "完整内容...",
  "platform": "weixin",
  "sentiment": "positive",
  "author": "作者",
  "publishTime": "2026-07-17T08:00:00.000Z",
  "url": "https://...",
  "matchedKeywords": ["关键词1", "关键词2"]
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/duty/overview',
    description: '获取值班监控概览数据',
    requestExample: `curl -H "X-API-Key: your-key" "${baseUrl}/duty/overview"`,
    responseExample: `{
  "totalEvents": 128,
  "alertCount": 5,
  "criticalAlerts": 2,
  "latestEvents": [...],
  "platformBreakdown": {"weixin": 60, "weibo": 40},
  "sentimentTrend": {"positive": 50, "negative": 30, "neutral": 48},
  "topKeywords": ["关键词1", "关键词2"]
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/dashboards',
    description: '获取用户自定义面板列表',
  },
  {
    method: 'POST',
    path: '/api/v1/dashboards',
    description: '创建自定义面板',
    params: [
      { name: 'name', type: 'string', required: true, description: '面板名称' },
      { name: 'layout', type: 'string', required: false, description: '布局 JSON' },
    ],
    requestExample: `curl -X POST -H "X-API-Key: your-key" -H "Content-Type: application/json" \\
  -d '{"name":"My Dashboard"}' "${baseUrl}/dashboards"`,
  },
];

const errorCodes = [
  { code: '401', message: '未授权', cause: 'API Key 缺失、无效或已禁用' },
  { code: '403', message: '权限不足', cause: 'API Key 无权访问该资源' },
  { code: '404', message: '资源不存在', cause: '请求的资源未找到' },
  { code: '422', message: '请求验证失败', cause: '参数格式不正确' },
  { code: '429', message: '请求频率超限', cause: '超过每分钟速率限制' },
  { code: '500', message: '服务器内部错误', cause: '服务端异常，请稍后重试' },
];
</script>

<style scoped>
.api-docs__section {
  margin-bottom: 32px;
}

.api-docs__section h3 {
  font-size: 18px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.api-docs__section p {
  margin: 8px 0;
  line-height: 1.8;
  color: var(--text-secondary);
}

.api-docs__section pre {
  background: var(--bg-subtle);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
}

.api-docs__section code {
  background: var(--bg-subtle);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.api-docs__section ul {
  padding-left: 20px;
  margin: 8px 0;
}

.api-docs__section li {
  margin: 4px 0;
  color: var(--text-secondary);
}

.api-docs__endpoint {
  background: var(--bg-subtle);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.api-docs__endpoint-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.api-docs__path {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.api-docs__desc {
  color: var(--text-tertiary);
  font-size: 13px;
  margin-bottom: 12px;
}

.api-docs__endpoint h4 {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 12px 0 8px;
}
</style>
