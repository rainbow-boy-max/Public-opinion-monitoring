# Phase 11 实施计划 - 政务场景增强

## 目标

针对政务客户需求，增强简报生成与上报能力，提升政务舆情管理效率。

---

## 核心功能

### 1. 舆情简报自动生成

**简报类型**：
- 日报：每日舆情概览
- 周报：每周舆情汇总
- 专报：重大舆情专项报告

**生成方式**：
- 基于模板自动生成
- LLM 智能撰写
- 支持 Word/PDF 导出

### 2. 一键上报

**上报渠道**：
- 钉钉群/飞书群
- 内部 OA 系统
- 自定义接口

**上报功能**：
- 简报推送
- 状态跟踪
- 上报记录

### 3. 政府官网监测

**监测范围**：
- 本级政府网站
- 上级政府网站
- 政策发布动态

**监测内容**：
- 政策文件
- 新闻动态
- 通知公告

### 4. 领导批示管理

**批示功能**：
- 批示记录
- 事项跟踪
- 处理反馈

---

## 数据模型设计

### 1. 政务简报表

```typescript
@Entity('gov_briefings')
export class GovBriefingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'briefing_type', type: 'varchar', length: 32 })
  briefingType: 'daily' | 'weekly' | 'special';

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ type: 'longtext' })
  content: string;

  @Column({ name: 'export_url', type: 'varchar', length: 500, nullable: true })
  exportUrl: string | null;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'submitted_to', type: 'varchar', length: 255, nullable: true })
  submittedTo: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### 2. 领导批示表

```typescript
@Entity('leader_instructions')
export class LeaderInstructionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'event_id', type: 'bigint' })
  eventId: number;

  @ManyToOne(() => OpinionEventEntity)
  @JoinColumn({ name: 'event_id' })
  event: OpinionEventEntity;

  @Column({ name: 'leader_name', type: 'varchar', length: 100 })
  leaderName: string;

  @Column({ type: 'text' })
  instruction: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: 'pending' | 'processing' | 'completed';

  @Column({ name: 'handler_name', type: 'varchar', length: 100, nullable: true })
  handlerName: string | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @Column({ name: 'deadline', type: 'date', nullable: true })
  deadline: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## API 设计

### 简报管理 API

```typescript
// 生成简报
POST /api/gov/briefing/generate
{
  briefingType: 'daily',
  startDate: '2026-07-23',
  endDate: '2026-07-23'
}

// 获取简报列表
GET /api/gov/briefing?page=1&pageSize=20

// 获取简报详情
GET /api/gov/briefing/:id

// 上报简报
POST /api/gov/briefing/:id/submit
{
  submittedTo: 'dingtalk',
  webhookUrl: 'https://...'
}

// 导出简报
GET /api/gov/briefing/:id/export?format=word
```

### 领导批示 API

```typescript
// 创建批示
POST /api/gov/instruction
{
  eventId: 123,
  leaderName: '张市长',
  instruction: '请XX部门立即核实处理',
  deadline: '2026-07-25'
}

// 获取批示列表
GET /api/gov/instruction?status=pending

// 更新批示状态
PUT /api/gov/instruction/:id
{
  status: 'processing',
  handlerName: '王处长',
  feedback: '已安排人员处理'
}
```

---

## 实施方案

### Phase 11.1：数据模型与基础服务（1 周）

- [ ] 创建 GovBriefingEntity
- [ ] 创建 LeaderInstructionEntity
- [ ] 创建 GovReportModule
- [ ] 创建 BriefingService
- [ ] 创建 InstructionService

### Phase 11.2：简报生成服务（1 周）

**功能实现**：
1. 数据采集（指定时间范围）
2. 数据分析（热点事件、情感分布）
3. LLM 生成简报内容
4. Word/PDF 导出

### Phase 11.3：上报与官网监测（1 周）

**上报功能**：
- 钉钉/飞书 Webhook
- HTTP POST 自定义接口
- 上报状态记录

**官网监测**：
- 网站抓取
- 内容解析
- 变更检测

### Phase 11.4：前端页面（1 周）

**页面设计**：
1. 简报生成页面
2. 简报列表页面
3. 领导批示管理页面
4. 官网监测配置页面

---

## 工期与资源

| 阶段 | 任务 | 工期 | 状态 |
|------|------|------|------|
| 11.1 | 数据模型与基础服务 | 1 周 | ⏳ 待开始 |
| 11.2 | 简报生成服务 | 1 周 | ⏳ 待开始 |
| 11.3 | 上报与官网监测 | 1 周 | ⏳ 待开始 |
| 11.4 | 前端页面 | 1 周 | ⏳ 待开始 |
| **总计** | - | **4 周** | - |

**人力需求**：
- 后端开发：1 人
- 前端开发：1 人

---

## 依赖与注意事项

### 外部依赖

1. **钉钉/飞书**
   - 群机器人 Webhook
   - 消息推送权限

2. **政府官网**
   - 网站访问权限
   - 爬虫友好性

### 注意事项

1. **数据安全**
   - 简报内容加密存储
   - 上报记录审计

2. **合规性**
   - 遵守政府信息公开规定
   - 网站抓取合规

3. **稳定性**
   - 简报生成失败重试
   - 上报失败告警

---

## 下一步行动

### 立即开始

1. **创建数据模型**
   - GovBriefingEntity
   - LeaderInstructionEntity

2. **实现基础服务**
   - BriefingService
   - InstructionService

3. **实现简报生成**
   - 数据采集和分析
   - LLM 内容生成

---

**文档版本**：v1.0  
**更新日期**：2026-07-23  
**预计完成时间**：4 周  
**状态**：准备开始
