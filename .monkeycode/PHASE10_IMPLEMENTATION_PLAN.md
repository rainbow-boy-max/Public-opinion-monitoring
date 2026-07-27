# Phase 10 实施计划 - 分级预警与多渠道推送

## 目标

完善预警机制，支持分级预警与多渠道推送，提升预警的及时性和覆盖面。

---

## 核心功能

### 1. 分级预警规则

**预警等级**：
- **一般舆情**：24h 汇总推送
- **重要舆情**：4h 内推送
- **重大舆情**：1h 内实时推送
- **特级舆情**：15min 内推送

**触发条件**：
- 阅读量、点赞量、评论量、转发量
- 情感倾向（负面舆情权重更高）
- 关键词匹配（敏感词）
- 传播速度（短时间内快速增长）

### 2. 多渠道推送

**已实现渠道**：
- ✅ 短信（阿里云短信）
- ✅ 站内消息

**待实现渠道**：
- ⏳ 邮件通知
- ⏳ 企业微信机器人
- ⏳ 钉钉机器人

### 3. 预警配置管理

**功能**：
- 用户自定义预警规则
- 预警接收人管理
- 预警时段设置（避免夜间打扰）
- 预警渠道开关

### 4. 预警历史

**功能**：
- 预警记录查询
- 预警处理反馈
- 预警统计分析

---

## 数据模型设计

### 1. 预警等级枚举

```typescript
export enum AlertLevel {
  NORMAL = 'normal',      // 一般
  IMPORTANT = 'important', // 重要
  MAJOR = 'major',        // 重大
  CRITICAL = 'critical'   // 特级
}

export enum AlertChannel {
  SMS = 'sms',
  EMAIL = 'email',
  WECHAT = 'wechat',
  DINGTALK = 'dingtalk',
  INTERNAL = 'internal'
}

export enum AlertStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CONFIRMED = 'confirmed'
}
```

### 2. 预警配置表

```typescript
// alert-config.entity.ts
@Entity('alert_configs')
export class AlertConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ name: 'alert_level', type: 'varchar', length: 32 })
  alertLevel: AlertLevel;

  @Column({ name: 'enabled_channels', type: 'json', comment: '启用的通知渠道' })
  enabledChannels: AlertChannel[];

  @Column({ name: 'quiet_hours', type: 'json', nullable: true, comment: '免打扰时段' })
  quietHours: { start: string; end: string } | null;

  @Column({ name: 'recipients', type: 'json', comment: '接收人列表' })
  recipients: {
    phone?: string[];
    email?: string[];
    wechat?: string[];
    dingtalk?: string[];
  };

  @Column({ name: 'trigger_conditions', type: 'json', comment: '触发条件' })
  triggerConditions: {
    readCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    sentiment?: string[];
    keywords?: string[];
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 3. 预警记录表

```typescript
// alert-record.entity.ts
@Entity('alert_records')
export class AlertRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'event_id', type: 'bigint' })
  eventId: number;

  @ManyToOne(() => OpinionEventEntity)
  @JoinColumn({ name: 'event_id' })
  event: OpinionEventEntity;

  @Column({ name: 'alert_level', type: 'varchar', length: 32 })
  alertLevel: AlertLevel;

  @Column({ name: 'alert_channel', type: 'varchar', length: 32 })
  alertChannel: AlertChannel;

  @Column({ name: 'recipient', type: 'varchar', length: 255, comment: '接收人' })
  recipient: string;

  @Column({ name: 'status', type: 'varchar', length: 32 })
  status: AlertStatus;

  @Column({ name: 'content', type: 'text', comment: '预警内容' })
  content: string;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true, comment: '确认时间' })
  confirmedAt: Date | null;

  @Column({ name: 'confirmed_by', type: 'bigint', nullable: true, comment: '确认人' })
  confirmedBy: number | null;

  @Column({ name: 'feedback', type: 'text', nullable: true, comment: '处理反馈' })
  feedback: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## 实施方案

### Phase 10.1：数据模型与基础服务（1 周）

**任务清单**：
- [ ] 创建 AlertConfigEntity
- [ ] 创建 AlertRecordEntity
- [ ] 创建 AlertLevel/AlertChannel/AlertStatus 枚举
- [ ] 扩展 AlertModule
- [ ] 创建 AlertConfigService
- [ ] 创建 AlertRecordService

### Phase 10.2：分级预警服务（1 周）

**核心功能**：
- 预警等级评估算法
- 预警触发检测
- 预警规则匹配
- 预警时段控制

**实现步骤**：
1. 实现预警等级评估（基于事件数据）
2. 实现触发条件检测
3. 实现免打扰时段控制
4. 实现预警记录保存

### Phase 10.3：多渠道推送服务（1 周）

**邮件通知**：
```typescript
// 使用 nodemailer
npm install nodemailer
npm install @types/nodemailer --save-dev

class EmailNotificationService {
  async sendEmail(to: string, subject: string, content: string) {
    // 实现邮件发送
  }
}
```

**企业微信机器人**：
```typescript
// 企业微信 Webhook
class WechatNotificationService {
  async sendMessage(webhook: string, content: string) {
    // POST 到企业微信 Webhook
  }
}
```

**钉钉机器人**：
```typescript
// 钉钉 Webhook
class DingtalkNotificationService {
  async sendMessage(webhook: string, content: string) {
    // POST 到钉钉 Webhook
  }
}
```

### Phase 10.4：前端预警管理页面（1 周）

**页面设计**：

1. **预警配置页面**
   - 预警等级设置
   - 通知渠道配置
   - 接收人管理
   - 触发条件设置
   - 免打扰时段配置

2. **预警历史页面**
   - 预警记录列表
   - 预警详情查看
   - 预警确认处理
   - 预警统计图表

---

## API 设计

### 预警配置 API

```typescript
// 获取预警配置
GET /api/alert/config

// 更新预警配置
PUT /api/alert/config
{
  alertLevel: 'major',
  enabledChannels: ['sms', 'email'],
  quietHours: { start: '22:00', end: '08:00' },
  recipients: {
    phone: ['13800138000'],
    email: ['admin@example.com']
  },
  triggerConditions: {
    readCount: 10000,
    sentiment: ['negative']
  }
}
```

### 预警记录 API

```typescript
// 获取预警记录列表
GET /api/alert/records?page=1&pageSize=20&alertLevel=major

// 获取预警记录详情
GET /api/alert/records/:id

// 确认预警处理
POST /api/alert/records/:id/confirm
{
  feedback: '已处理'
}

// 预警统计
GET /api/alert/statistics?startDate=2026-07-01&endDate=2026-07-31
```

---

## 预警等级评估算法

```typescript
class AlertLevelEvaluator {
  evaluateLevel(event: OpinionEventEntity): AlertLevel {
    let score = 0;
    
    // 阅读量评分（0-30 分）
    if (event.readCount > 100000) score += 30;
    else if (event.readCount > 50000) score += 20;
    else if (event.readCount > 10000) score += 10;
    
    // 互动量评分（0-30 分）
    const engagement = event.likeCount + event.commentCount + event.shareCount;
    if (engagement > 10000) score += 30;
    else if (engagement > 5000) score += 20;
    else if (engagement > 1000) score += 10;
    
    // 情感评分（0-20 分）
    if (event.sentiment === 'negative') score += 20;
    else if (event.sentiment === 'neutral') score += 5;
    
    // 传播速度评分（0-20 分）
    const age = Date.now() - event.publishTime.getTime();
    const hoursSincePublish = age / (1000 * 3600);
    const growthRate = event.readCount / Math.max(hoursSincePublish, 1);
    if (growthRate > 5000) score += 20;
    else if (growthRate > 2000) score += 10;
    else if (growthRate > 500) score += 5;
    
    // 评级
    if (score >= 80) return AlertLevel.CRITICAL;  // 特级
    if (score >= 60) return AlertLevel.MAJOR;     // 重大
    if (score >= 40) return AlertLevel.IMPORTANT; // 重要
    return AlertLevel.NORMAL;                      // 一般
  }
}
```

---

## 工期与资源

| 阶段 | 任务 | 工期 | 状态 |
|------|------|------|------|
| 10.1 | 数据模型与基础服务 | 1 周 | ⏳ 待开始 |
| 10.2 | 分级预警服务 | 1 周 | ⏳ 待开始 |
| 10.3 | 多渠道推送服务 | 1 周 | ⏳ 待开始 |
| 10.4 | 前端预警管理页面 | 1 周 | ⏳ 待开始 |
| **总计** | - | **4 周** | - |

**人力需求**：
- 后端开发：1 人
- 前端开发：1 人

---

## 依赖与注意事项

### 外部依赖

1. **邮件服务**
   - SMTP 服务器配置
   - 发件人邮箱配置

2. **企业微信**
   - 企业微信账号
   - 机器人 Webhook URL

3. **钉钉**
   - 钉钉企业账号
   - 机器人 Webhook URL

### 注意事项

1. **频率控制**
   - 同一事件避免重复预警
   - 实现预警去重机制

2. **通知限流**
   - 避免短时间内大量通知
   - 实现通知队列

3. **数据安全**
   - 敏感信息加密存储
   - 通知内容脱敏

---

## 下一步行动

### 立即开始（本周）

1. **创建数据模型**
   - AlertConfigEntity
   - AlertRecordEntity

2. **实现基础服务**
   - AlertConfigService
   - AlertRecordService

3. **实现预警等级评估**
   - AlertLevelEvaluator
   - 触发条件检测

### 下周

1. 实现多渠道推送服务
2. 实现前端配置页面
3. 集成测试

---

**文档版本**：v1.0  
**更新日期**：2026-07-23  
**预计完成时间**：4 周  
**状态**：准备开始
