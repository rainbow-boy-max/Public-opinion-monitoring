# 短视频配置管理 + Phase 8 实施摘要

## 一、短视频平台配置管理（已部分完成）

### 已实现

✅ **后端数据模型**
- `ShortVideoConfigEntity`：平台配置（抖音、快手、视频号、B站）
- `AliyunVideoConfigEntity`：阿里云服务配置（OSS、OCR、ASR）

✅ **后端服务**
- `ShortVideoConfigService`：配置 CRUD、连接测试

### 待实现（需 2-3 天）

**1. 后端控制器与 API**
```typescript
// short-video-config.controller.ts
@Controller('admin/short-video-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ShortVideoConfigController {
  @Get('platforms')
  async getAllPlatforms() { }
  
  @Put('platforms/:platform')
  async updatePlatform() { }
  
  @Post('platforms/:platform/test')
  async testConnection() { }
  
  @Get('aliyun')
  async getAliyunConfig() { }
  
  @Put('aliyun')
  async updateAliyunConfig() { }
  
  @Post('aliyun/test')
  async testAliyunConnection() { }
}
```

**2. 前端管理页面**

路径：`frontend-admin/src/views/short-video-config/index.vue`

页面结构：
```
短视频平台配置
├── 平台配置 Tab
│   ├── 抖音开放平台
│   │   ├── App Key [输入框]
│   │   ├── App Secret [密码框]
│   │   ├── API Base URL [输入框]
│   │   ├── 启用状态 [开关]
│   │   └── 测试连接 [按钮]
│   ├── 快手开放平台 [同上]
│   ├── 微信视频号 [同上]
│   └── B站 [同上]
│
└── 阿里云配置 Tab
    ├── Access Key ID [输入框]
    ├── Access Key Secret [密码框]
    ├── Region ID [下拉选择]
    ├── OSS Bucket [输入框]
    ├── OSS Endpoint [输入框]
    ├── 视频 OCR Endpoint [输入框]
    ├── 语音识别 App Key [输入框]
    ├── 语音识别 Endpoint [输入框]
    ├── 启用状态 [开关]
    └── 测试连接 [按钮]
```

**3. 敏感信息安全**
- 密钥字段前端显示为 `****`
- 仅管理员可访问
- 数据库存储加密（可选）

---

## 二、Phase 8: AI 智能报告生成

### 目标

实现基于 LLM 的舆情报告自动生成，支持日报、周报、专项报告。

### 核心功能

#### 1. 报告生成引擎

**数据模型**：
```typescript
// report-generation.entity.ts
@Entity('report_generations')
export class ReportGenerationEntity {
  id: number;
  reportType: 'daily' | 'weekly' | 'monthly' | 'special'; // 报告类型
  title: string; // 报告标题
  timeRange: { start: Date; end: Date }; // 时间范围
  status: 'pending' | 'generating' | 'completed' | 'failed';
  content: string; // 生成的报告内容（Markdown）
  exportFormat: 'word' | 'pdf'; // 导出格式
  exportUrl: string | null; // 导出文件 URL
  createdBy: number; // 创建人
  createdAt: Date;
  completedAt: Date | null;
}
```

**报告生成流程**：
```
用户创建报告 → 采集数据 → LLM 生成 → 导出文件
```

#### 2. 报告模板

**日报模板**：
```markdown
# 舆情监测日报
日期：{{date}}

## 一、舆情概览
- 监测事件数：{{eventCount}}
- 新增舆情：{{newEventCount}}
- 热度 TOP 5：
  1. {{topEvent1}}
  2. {{topEvent2}}
  ...

## 二、热点事件分析
{{eventAnalysis}}

## 三、情感趋势
{{sentimentTrend}}

## 四、应对建议
{{suggestions}}
```

**周报/月报模板**：增加趋势对比、数据统计图表。

#### 3. LLM Prompt 设计

**智能摘要 Prompt**：
```
请根据以下舆情数据生成执行摘要（200-300字）：

事件列表：
{events}

要求：
1. 提炼核心问题
2. 指出关键风险
3. 语言简洁专业
```

**应对建议 Prompt**：
```
基于以下舆情分析，生成应对建议：

舆情类型：{type}
严重程度：{severity}
历史案例：{similarCases}

要求：
1. 3-5 条具体建议
2. 包含优先级
3. 可操作性强
```

#### 4. 报告导出

**Word 导出**（使用 `docx` 库）：
```typescript
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';

async function generateWordReport(content: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: '舆情监测报告',
          heading: HeadingLevel.TITLE,
        }),
        // ... Markdown 转 Word 段落
      ],
    }],
  });
  
  return Packer.toBuffer(doc);
}
```

**PDF 导出**（使用 `puppeteer` 或 `pdfkit`）：
```typescript
import puppeteer from 'puppeteer';

async function generatePdfReport(htmlContent: string): Promise<Buffer> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent);
  const pdf = await page.pdf({ format: 'A4' });
  await browser.close();
  return pdf;
}
```

#### 5. 前端页面

**报告列表页** (`frontend-admin/src/views/reports/index.vue`)：
- 表格展示：标题、类型、时间范围、状态、创建时间
- 操作：查看、导出、删除
- 筛选：报告类型、日期范围

**报告创建向导** (`frontend-admin/src/views/reports/create.vue`)：
- 步骤 1：选择报告类型
- 步骤 2：设置时间范围
- 步骤 3：选择监测事件（可选）
- 步骤 4：自定义模板（可选）
- 步骤 5：生成预览

**报告详情页** (`frontend-admin/src/views/reports/detail.vue`)：
- Markdown 预览
- 编辑功能
- 导出按钮（Word、PDF）

### 实施计划

| 任务 | 工期 | 依赖 |
|------|------|------|
| 报告数据模型 | 0.5 天 | 无 |
| 报告生成引擎 | 2 天 | LLM 服务 |
| 报告模板系统 | 1 天 | 无 |
| Word/PDF 导出 | 1.5 天 | NPM 包 |
| 前端报告列表 | 1 天 | 无 |
| 前端报告创建向导 | 1.5 天 | 无 |
| 前端报告详情页 | 1 天 | 无 |
| 测试与优化 | 1 天 | 全部完成 |
| **总计** | **9.5 天** | - |

实际完成时间：**约 2 周**（考虑调试和优化）

### NPM 依赖

```json
{
  "dependencies": {
    "docx": "^8.5.0",
    "puppeteer": "^21.6.0",
    "marked": "^11.0.0",
    "pdfkit": "^0.14.0"
  }
}
```

---

## 三、完整实施路径

### 第 1 周

**Day 1-2：短视频配置管理**
- 完成后端控制器与 API
- 完成前端配置页面
- 测试配置保存与连接测试

**Day 3-4：Phase 8 后端开发**
- 报告数据模型
- 报告生成引擎
- LLM Prompt 设计

**Day 5：Phase 8 导出功能**
- Word 导出实现
- PDF 导出实现

### 第 2 周

**Day 1-3：Phase 8 前端开发**
- 报告列表页
- 报告创建向导
- 报告详情页

**Day 4-5：集成测试与优化**
- 端到端测试
- 性能优化
- 文档编写

---

## 四、下一步行动

### 立即可做

1. ✅ 完成短视频配置管理后端控制器
2. ✅ 完成短视频配置管理前端页面
3. ✅ 开始 Phase 8 报告数据模型

### 并行任务

- 申请抖音/快手账号（审核 1-2 周）
- 开通阿里云服务

### 完成顺序

```
短视频配置管理（3 天）
  → Phase 8 后端（4 天）
  → Phase 8 前端（3 天）
  → 测试与优化（2 天）
  → 外部账号审核通过
  → 填入真实密钥
  → Phase 7.2 真实 API 集成
```

---

## 五、技术要点

### 1. 敏感信息脱敏

前端展示密钥时：
```typescript
function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return '****';
  return secret.substring(0, 4) + '****' + secret.substring(secret.length - 4);
}
```

### 2. LLM 调用优化

使用流式输出提升用户体验：
```typescript
async function* generateReportStream(prompt: string) {
  const stream = await llmService.streamComplete(prompt);
  for await (const chunk of stream) {
    yield chunk.text;
  }
}
```

### 3. 报告缓存

生成的报告缓存 1 小时，避免重复生成：
```typescript
const cacheKey = `report:${type}:${startDate}:${endDate}`;
let content = await redis.get(cacheKey);
if (!content) {
  content = await generateReport();
  await redis.setex(cacheKey, 3600, content);
}
```

---

**文档版本**：v1.0  
**更新日期**：2026-07-22  
**预计完成时间**：2 周
