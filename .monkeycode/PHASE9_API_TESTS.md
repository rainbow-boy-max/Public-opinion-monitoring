# Phase 9 API 测试文档

## 测试环境

- 后端服务：http://localhost:3000
- 需要 JWT Token 认证
- Content-Type: application/json

---

## 一、趋势预测 API 测试

### 1.1 创建趋势预测

**端点**：`POST /api/prediction/trend`

**请求示例**：
```bash
curl -X POST http://localhost:3000/api/prediction/trend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": 1,
    "horizon": 24
  }'
```

**预期响应**：
```json
{
  "message": "趋势预测已创建",
  "data": {
    "id": 1,
    "eventId": 1,
    "predictionHorizon": 24,
    "predictedHeat": [
      {
        "timestamp": "2026-07-24T00:00:00.000Z",
        "value": 1250
      },
      ...
    ],
    "riskLevel": "medium",
    "confidenceScore": 75,
    "anomalyDetected": false,
    "algorithmUsed": "moving_average",
    "historicalDataPoints": 7,
    "createdAt": "2026-07-23T10:00:00.000Z"
  }
}
```

**测试要点**：
- [ ] 返回状态码 201
- [ ] predictedHeat 数组长度等于 horizon
- [ ] riskLevel 为 low/medium/high/critical 之一
- [ ] confidenceScore 在 0-100 之间
- [ ] 记录成功保存到数据库

### 1.2 获取预测结果

**端点**：`GET /api/prediction/trend/:eventId`

**请求示例**：
```bash
curl -X GET http://localhost:3000/api/prediction/trend/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期响应**：
```json
{
  "data": {
    "id": 1,
    "eventId": 1,
    "event": {
      "id": 1,
      "title": "测试事件标题",
      ...
    },
    "predictedHeat": [...],
    "riskLevel": "medium",
    ...
  }
}
```

**测试要点**：
- [ ] 返回状态码 200
- [ ] 包含关联的 event 对象
- [ ] 返回最新的预测记录

### 1.3 预测列表查询

**端点**：`GET /api/prediction/trend`

**请求示例**：
```bash
# 基础查询
curl -X GET "http://localhost:3000/api/prediction/trend?page=1&pageSize=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 筛选高风险
curl -X GET "http://localhost:3000/api/prediction/trend?riskLevel=high" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期响应**：
```json
{
  "data": [
    {
      "id": 1,
      "eventId": 1,
      "riskLevel": "high",
      ...
    }
  ],
  "total": 10
}
```

**测试要点**：
- [ ] 返回状态码 200
- [ ] 分页参数生效
- [ ] 筛选参数生效
- [ ] total 字段正确

---

## 二、归因分析 API 测试

### 2.1 创建归因分析

**端点**：`POST /api/analysis/attribution`

**请求示例**：
```bash
curl -X POST http://localhost:3000/api/analysis/attribution \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": 1
  }'
```

**预期响应**：
```json
{
  "message": "归因分析已创建",
  "data": {
    "id": 1,
    "eventId": 1,
    "triggerEvents": [
      {
        "eventId": 2,
        "title": "触发事件标题",
        "time": "2026-07-22T10:00:00.000Z",
        "impact": 125.5
      }
    ],
    "keyNodes": [
      {
        "type": "kol",
        "name": "张三",
        "followersCount": 0,
        "propagationPower": 250.3
      }
    ],
    "propagationPath": [
      {
        "source": "Event_2",
        "target": "Event_3",
        "weight": 0.125
      }
    ],
    "analysisContent": "## 归因分析报告\n\n...",
    "llmGenerated": true,
    "analysisDurationMs": 1523,
    "createdAt": "2026-07-23T10:00:00.000Z"
  }
}
```

**测试要点**：
- [ ] 返回状态码 201
- [ ] triggerEvents 数组不为空
- [ ] keyNodes 数组不为空
- [ ] analysisContent 包含 Markdown 内容
- [ ] analysisDurationMs 记录了耗时

### 2.2 获取归因分析

**端点**：`GET /api/analysis/attribution/:eventId`

**请求示例**：
```bash
curl -X GET http://localhost:3000/api/analysis/attribution/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期响应**：
```json
{
  "data": {
    "id": 1,
    "eventId": 1,
    "event": {
      "id": 1,
      "title": "主事件标题",
      ...
    },
    "triggerEvents": [...],
    "keyNodes": [...],
    "propagationPath": [...],
    "analysisContent": "...",
    ...
  }
}
```

**测试要点**：
- [ ] 返回状态码 200
- [ ] 包含关联的 event 对象
- [ ] 返回最新的分析记录

---

## 三、算法验证测试

### 3.1 趋势预测算法验证

**测试场景**：上升趋势事件

1. 创建预测（horizon=24）
2. 验证预测值是否递增
3. 验证风险等级评估合理性

**验证脚本**：
```javascript
const prediction = response.data;
const values = prediction.predictedHeat.map(p => p.value);

// 检查趋势
let isAscending = true;
for (let i = 1; i < values.length; i++) {
  if (values[i] < values[i-1] * 0.9) { // 允许 10% 波动
    isAscending = false;
    break;
  }
}

console.log('趋势递增:', isAscending);

// 检查风险评级
const currentHeat = 1000;
const maxPredicted = Math.max(...values);
const growthRate = (maxPredicted - currentHeat) / currentHeat;

console.log('增长率:', growthRate);
console.log('风险等级:', prediction.riskLevel);
```

### 3.2 异常检测验证

**测试场景**：创建一个热度突增的事件

1. 当前热度远高于历史平均值
2. 创建预测
3. 验证 anomalyDetected = true

### 3.3 归因分析验证

**测试场景**：有明确传播链的事件

1. 创建归因分析
2. 验证触发事件按影响力排序
3. 验证关键节点识别正确
4. 验证 LLM 报告生成成功

---

## 四、性能测试

### 4.1 响应时间测试

**目标**：
- 趋势预测：< 2 秒
- 归因分析：< 5 秒（含 LLM）

**测试命令**：
```bash
time curl -X POST http://localhost:3000/api/prediction/trend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId": 1, "horizon": 24}'
```

### 4.2 并发测试

**测试工具**：Apache Bench

```bash
ab -n 100 -c 10 -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -p data.json \
  http://localhost:3000/api/prediction/trend
```

**目标**：
- 成功率：> 95%
- 平均响应时间：< 3 秒

---

## 五、错误处理测试

### 5.1 事件不存在

```bash
curl -X POST http://localhost:3000/api/prediction/trend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId": 99999, "horizon": 24}'
```

**预期响应**：
```json
{
  "statusCode": 404,
  "message": "事件不存在"
}
```

### 5.2 历史数据不足

**测试**：对刚创建的事件进行预测

**预期响应**：
```json
{
  "statusCode": 400,
  "message": "历史数据不足，至少需要 7 个数据点"
}
```

### 5.3 参数验证

```bash
# horizon 超过范围
curl -X POST http://localhost:3000/api/prediction/trend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId": 1, "horizon": 200}'
```

**预期响应**：
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    "horizon must not be greater than 168"
  ]
}
```

---

## 六、测试结果记录

### 趋势预测 API

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 创建预测 | ⏳ | |
| 获取预测 | ⏳ | |
| 列表查询 | ⏳ | |
| 算法验证 | ⏳ | |
| 异常检测 | ⏳ | |
| 性能测试 | ⏳ | |
| 错误处理 | ⏳ | |

### 归因分析 API

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 创建分析 | ⏳ | |
| 获取分析 | ⏳ | |
| 算法验证 | ⏳ | |
| LLM 集成 | ⏳ | |
| 性能测试 | ⏳ | |
| 错误处理 | ⏳ | |

---

## 七、测试环境准备

### 7.1 准备测试数据

```sql
-- 插入测试事件（确保有足够的历史数据）
INSERT INTO opinion_events (task_id, platform, title, content, author, publish_time, read_count, like_count, comment_count, share_count, sentiment, matched_keywords, raw_data, status, matched_at, created_at)
VALUES 
(1, 'weibo', '测试事件1', '内容1', '用户A', DATE_SUB(NOW(), INTERVAL 7 DAY), 1000, 100, 50, 20, 'neutral', '[]', '{}', 0, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)),
(1, 'weibo', '测试事件2', '内容2', '用户B', DATE_SUB(NOW(), INTERVAL 6 DAY), 1200, 120, 60, 25, 'neutral', '[]', '{}', 0, DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY)),
(1, 'weibo', '测试事件3', '内容3', '用户C', DATE_SUB(NOW(), INTERVAL 5 DAY), 1500, 150, 75, 30, 'neutral', '[]', '{}', 0, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
-- ... 继续插入更多测试数据
(1, 'weibo', '测试事件7', '内容7', '用户G', DATE_SUB(NOW(), INTERVAL 1 DAY), 3000, 300, 150, 60, 'positive', '[]', '{}', 0, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY));
```

### 7.2 获取测试 Token

```bash
# 登录获取 token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'

# 保存返回的 token
export TEST_TOKEN="eyJhbGc..."
```

### 7.3 启动后端服务

```bash
cd /workspace/backend
npm run start:dev
```

---

**测试执行时间**：预计 2-3 小时  
**测试负责人**：开发团队  
**文档版本**：v1.0
