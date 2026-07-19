# Real-time Data Fix Round 2

Feature Name: realtime-data-fix-round-2
Updated: 2026-07-19

## Description

修复管理端 3 个"实时数据不真实"问题：竞品追踪、品牌声誉、值班面板 WebSocket。核心原则：

1. **零 Mock**：所有 Controller 移除 `getMockXxx()` 调用分支
2. **真实聚合**：基于 MySQL `opinion_events` 表 LIKE 匹配 + GROUP BY
3. **空态友好**：无数据时显示引导，不展示假数据
4. **WS 可观测**：值班面板连接状态实时可见，自动重连可点击

---

## Architecture

```mermaid
graph TB
    A[Admin Frontend] -->|HTTP REST| B[NestJS Backend]
    A -->|Socket.IO /duty| B
    B -->|TypeORM| C[(MySQL)]
    B -->|@Cron| B
    
    subgraph Frontend Pages
        A1[/competitor-tracking/]
        A2[/brand-reputation/]
        A3[/duty/]
    end
    
    subgraph Backend Modules
        M1[CompetitorModule]
        M2[BrandReputationModule]
        M3[DutyModule]
    end
    
    A1 --> M1
    A2 --> M2
    A3 --> M3
    A3 -.->|WebSocket| M3
    
    M1 --> C
    M2 --> C
    M3 --> C
```

---

## Components and Interfaces

### Component 1: CompetitorService (REQ-11)

**File**: `backend/src/modules/competitor/competitor.service.ts`

**Current State**:
- `getComparison()` 已实现真实聚合（LIKE 匹配 keywords）
- 但 `getMockComparison()` 仍存在

**Changes**:

1. 移除 `getMockComparison()` 方法
2. `getComparison()` 增强：返回 `lastUpdated` 字段（ISO timestamp）
3. 添加 `dataSource: 'live'` 标识字段
4. 当无匹配事件时，返回 `competitors: []` + `totalEvents: 0`，**不生成假数据**

**Interface**:

```typescript
interface CompetitorComparison {
  dataSource: 'live';
  lastUpdated: string; // ISO 8601
  period: string;
  competitors: Array<{
    name: string;
    stats: {
      total: number;
      bySentiment: { positive: number; negative: number; neutral: number };
      byPlatform: Record<string, number>;
      shareOfVoice: number;
      sentimentScore: number;
    };
  }>;
}
```

### Component 2: BrandReputationService (REQ-12)

**File**: `backend/src/modules/brand-reputation/brand-reputation.service.ts`

**Current State**:
- `getReputation()` 已实现真实聚合
- `getMockReputation()` 仍存在

**Changes**:

1. 移除 `getMockReputation()` 方法
2. `getReputation()` 增强：返回 `lastUpdated` + `dataSource: 'live'`
3. `timeSeries` 数组长度严格等于 `days` 参数，缺失日期补 0
4. `overview.npsScore` 计算：`Math.round((positive/total - negative/total) * 100)`

**Interface**:

```typescript
interface BrandReputationData {
  dataSource: 'live';
  lastUpdated: string;
  overview: {
    brandVoice: number;
    shareOfVoice: number;
    npsScore: number;
    sentimentScore: number;
    trend: 'rising' | 'stable' | 'declining';
  };
  timeSeries: Array<{
    date: string; // YYYY-MM-DD
    brandVoice: number;
    sentimentScore: number;
  }>;
  competitorComparison: Array<{
    name: string;
    mentions: number;
    sentimentScore: number;
    shareOfVoice: number;
    trend: 'rising' | 'stable' | 'declining';
  }>;
}
```

### Component 3: DutyGateway (REQ-13)

**File**: `backend/src/modules/duty/duty.gateway.ts`

**Current State**:
- 已实现 Socket.IO Gateway + @Cron 定时推送
- 但前端测试显示"一直离线"

**Changes**:

1. 添加 JWT 鉴权中间件（`@UseGuards(WsAuthGuard)`）
2. 添加 namespace 命名空间 `/duty`
3. 添加连接日志（`this.logger.log`）
4. 推送 payload 增加 `timestamp` 字段

**Interface**:

```typescript
// Server -> Client
socket.emit('overview', {
  timestamp: '2026-07-19T04:30:00.000Z',
  totalEvents: 42,
  alertCount: 3,
  // ...
});

// Client -> Server
socket.emit('join', { token: 'jwt...' });
```

### Component 4: Frontend CompetitorTrackingPage

**File**: `frontend-admin/src/pages/CompetitorTrackingPage.vue`

**Changes**:

1. 添加"刷新"按钮 + "最后更新 HH:mm:ss"时间戳
2. 数据为空时显示三步引导空态
3. 加载失败显示错误提示 + 重试按钮
4. 移除所有 `getMockComparison` 引用（如有）

### Component 5: Frontend BrandReputationPage

**File**: `frontend-admin/src/pages/BrandReputationPage.vue`

**Changes**:

1. 添加"最后更新时间"显示
2. 数据为空时显示三步引导
3. 加载失败显示错误提示

### Component 6: Frontend DutyDashboardPage

**File**: `frontend-admin/src/pages/DutyDashboardPage.vue`

**Changes**:

1. 进入页面时先调用 `GET /api/duty/overview` 获取首屏数据
2. WebSocket 连接作为增量更新（不阻塞首屏）
3. 添加连接状态详细日志到 `recordAudit()`
4. 3 次重连失败后显示"重连失败"红色标签 + 重试按钮

---

## Data Models

### opinion_events 表查询模式

```sql
-- 竞品追踪：基于 keywords LIKE 匹配
SELECT 
  DATE(matched_at) AS date,
  platform,
  sentiment,
  COUNT(*) AS count
FROM opinion_events
WHERE matched_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
  AND (title LIKE '%LV%' OR content LIKE '%LV%')
GROUP BY DATE(matched_at), platform, sentiment;

-- 品牌声誉：基于 brandKeywords 数组
SELECT 
  DATE(matched_at) AS date,
  sentiment,
  COUNT(*) AS count
FROM opinion_events
WHERE matched_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
  AND (
    title LIKE '%LV%' OR content LIKE '%LV%'
    OR title LIKE '%Dior%' OR content LIKE '%Dior%'
  )
GROUP BY DATE(matched_at), sentiment;
```

### 索引建议（性能）

```sql
ALTER TABLE opinion_events ADD INDEX idx_matched_title (matched_at, title(50));
ALTER TABLE opinion_events ADD INDEX idx_matched_content (matched_at, content(50));
```

---

## Correctness Properties

| ID | Property | 验证方法 |
|----|----------|---------|
| CP-9 | 创建竞品组后，竞品追踪页面声量数字 ≥ 0 且与 DB 一致 | 创建 "LV" / "GUCCI" 竞品组，触发事件采集，对比页面与 `SELECT COUNT(*)` |
| CP-10 | 移除 `getMockXxx` 后 grep 无残留 | `grep -r "getMock" backend/src/modules/{competitor,brand-reputation}/` |
| CP-11 | 品牌声誉 NPS 计算公式正确 | 正面 60 / 负面 20 / 总 100 → NPS = 60-20 = 40 |
| CP-12 | shareOfVoice 计算误差 ≤ 0.01 | 公式验证 |
| CP-13 | 值班面板保持 5 分钟 readyState=CONNECTED | `socket.connected === true` |
| CP-14 | kill 后端进程，前端 5 秒内显示离线 | 手动测试 |

---

## Error Handling

| 场景 | 处理 |
|------|------|
| `competitor_groups` 无数据 | 前端显示「暂无竞品组」空态 + 「新建竞品组」按钮 |
| `opinion_events` 无匹配 | 前端显示「暂无数据」+ 三步引导 |
| 接口 500 错误 | 前端 ElMessage.error + 重试按钮 |
| 接口 401 错误 | 前端跳转到 `/login` |
| WebSocket 连接失败 | 5 秒后自动重连，3 次失败显示手动重试按钮 |
| WebSocket 鉴权失败 | 立即断开，显示「请重新登录」 |
| 数据库连接失败 | 后端返回 503，前端显示「服务暂时不可用」 |

---

## Test Strategy

### 后端单元测试

1. `CompetitorService.getComparison()` 无数据时返回 `competitors: []`
2. `BrandReputationService.getReputation()` NPS 计算正确
3. `DutyGateway.broadcastOverview()` 调用 `dutyService.getOverview()`

### 后端集成测试

```bash
# 1. 创建测试竞品组
curl -X POST http://localhost:3000/api/competitor/groups \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"奢侈品","competitors":[{"name":"LV","keywords":["LV","路易威登"],"platforms":["weibo"]}]}'

# 2. 查询真实数据
curl http://localhost:3000/api/competitor/groups/1/comparison \
  -H "Authorization: Bearer $TOKEN"

# 3. 验证无 mock 残留
grep -r "getMock\|mockData\|hardcoded" backend/src/modules/competitor/
```

### 前端 E2E 测试

1. 访问 `/competitor-tracking`，看到真实数据或空态（非假数据）
2. 访问 `/brand-reputation`，输入关键词点击分析，看到真实结果
3. 访问 `/duty`，3 秒内显示「实时」，保持 5 分钟不间断
4. kill 后端进程，前端 5 秒内显示「离线」

---

## Implementation Plan

### Phase 1: 移除 Mock（2h）

| 任务 | 文件 | 工时 |
|------|------|------|
| 移除 `getMockComparison` | `competitor.service.ts` | 0.5h |
| 移除 `getMockReputation` | `brand-reputation.service.ts` | 0.5h |
| Controller 移除 mock 分支 | 两个 controller | 0.5h |
| 验证无残留 | grep | 0.5h |

### Phase 2: 数据增强（2h）

| 任务 | 文件 | 工时 |
|------|------|------|
| CompetitorService 添加 `lastUpdated` | `competitor.service.ts` | 0.5h |
| BrandReputationService 添加 `lastUpdated` + 严格 timeSeries | `brand-reputation.service.ts` | 1h |
| DutyGateway 增强日志 + JWT | `duty.gateway.ts` | 0.5h |

### Phase 3: 前端优化（3h）

| 任务 | 文件 | 工时 |
|------|------|------|
| CompetitorTrackingPage 空态 + 刷新按钮 | `CompetitorTrackingPage.vue` | 1h |
| BrandReputationPage 空态 + 时间戳 | `BrandReputationPage.vue` | 1h |
| DutyDashboardPage 首屏 REST + WS 增量 + 重连 | `DutyDashboardPage.vue` | 1h |

### Phase 4: 测试验收（1h）

| 任务 | 工时 |
|------|------|
| 后端接口 curl 测试 | 0.5h |
| 前端 E2E 测试 | 0.5h |

**总计**: 8 小时

---

## References

- 已有规格：`.monkeycode/specs/260716-admin-commercial-readiness/`
- 已有规格：`.monkeycode/specs/260718-llm-admin-upgrade-v2/`
- 已有规格：`.monkeycode/specs/260718-admin-v2-round/`（REQ-6~10）

