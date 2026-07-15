# 竞品追踪页面崩溃修复方案

## 错误分析

**错误**: `Cannot read properties of undefined (reading 'toLocaleString')`  
**位置**: `CompetitorTrackingPage.vue:41` → `c.totalMentions.toLocaleString()`

## 根因

前端 `CompetitorCompItem` 接口定义与实际后端 API 返回结构不一致：

### 前端期望（已部署源码）
```typescript
interface CompetitorCompItem {
  totalMentions: number;       // 顶层字段
  sentiment: { positive, negative, neutral };  // 顶层字段
  platformDistribution: [];    // 顶层字段
}
```

### 后端实际返回
```json
{
  "competitors": [{
    "name": "竞品A",
    "stats": {                 // 嵌套在 stats 内
      "total": 0,
      "sentimentScore": 0,
      "shareOfVoice": 0,
      "bySentiment": { "positive": 0, "negative": 0, "neutral": 0 },
      "byPlatform": { "weibo": 0 }
    }
  }]
}
```

## 受影响文件

| 文件 | 问题 | 修复方式 |
|------|------|----------|
| `frontend-admin/.../CompetitorTrackingPage.vue` | 模板直接访问 `c.totalMentions` / `c.sentiment` / `c.platformDistribution`，实际 API 返回嵌套在 `c.stats` 内 | 在 `loadComparison()` 中添加数据扁平化映射 |
| `frontend-user/.../CompetitorPage.vue` | 同上 | 同上 |
| `frontend-admin/.../CompetitorTrackingPage.vue` | 雷达图 `drawRadar()` 内直接访问 `c.platformDistribution` | 改为访问 `c.byPlatform` |
| `frontend-admin/.../CompetitorTrackingPage.vue` | 情感分布图 `drawSentimentStacked()` 访问 `c.sentiment.positive` | 改为 `c.bySentiment.positive` |
| `frontend-user/.../CompetitorPage.vue` | 情感柱状图访问 `c.sentiment.positive` | 改为 `c.bySentiment.positive` |
| 两文件 | `getMockData()` 使用旧字段名 | 统一为 `bySentiment` / `byPlatform` |
| 两文件 | `CompetitorCompItem` 接口字段缺失 | 补充 `totalEngagement`/`avgEngagement`/`topKeywords`/`hourlyTrend`/`bySentiment`/`byPlatform` |

## 修复示意图

```
API Response                          Frontend Expected
┌─────────────────┐                  ┌──────────────────┐
│  competitors[]  │    transform     │  competitors[]   │
│  ├─ name        │  ──────────→     │  ├─ name         │
│  └─ stats       │                  │  ├─ totalMentions│ ← c.stats.total
│     ├─ total    │                  │  ├─ sentimentScore│ ← c.stats.sentimentScore
│     ├─ sentimentScore              │  ├─ shareOfVoice │
│     ├─ bySentiment                 │  ├─ bySentiment  │ ← c.stats.bySentiment
│     └─ byPlatform                  │  └─ byPlatform   │ ← c.stats.byPlatform
└─────────────────┘                  └──────────────────┘
```

## 额外发现

巡检用户端其他类似页面，发现 `frontend-user/src/pages/CompetitorPage.vue` 存在**完全相同的结构不匹配问题**，一并修复。

---

请确认方案后开始实施。
