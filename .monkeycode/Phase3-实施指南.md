# Phase 3 剩余任务实施指南

**待实施任务**: 3 个（11 小时）  
**优先级**: P0: 1个（4h） / P1: 1个（2h） / P2: 2个（5h）

---

## 任务 7：TTS API Key 持久化修复（P0，4h）

### 步骤 1：定位 TTS 配置存储

```bash
# 查找 TTS 配置实体
grep -r "TtsConfig\|tts_config" backend/src/database/entities/

# 查看 AdminService 中的 TTS 方法
grep -A 20 "setTtsConfig\|getTtsConfig" backend/src/modules/admin/*.service.ts
```

### 步骤 2：检查当前实现

预期实体结构：
```typescript
@Entity('tts_config')
export class TtsConfigEntity {
  @PrimaryColumn() id: number = 1;
  @Column() activeProvider: string;
  @Column({ type: 'text', nullable: true }) minimaxApiKeyEnc: string;
  @Column({ nullable: true }) minimaxGroupId: string;
  @Column({ type: 'text', nullable: true }) xiaomiApiKeyEnc: string;
}
```

### 步骤 3：修复保存逻辑

```typescript
// backend/src/modules/admin/admin.service.ts
async setTtsConfig(dto: TtsConfigDto): Promise<void> {
  let config = await this.ttsConfigRepo.findOne({ where: { id: 1 } });
  if (!config) {
    config = this.ttsConfigRepo.create({ id: 1 });
  }
  
  config.activeProvider = dto.activeProvider;
  
  if (dto.minimax?.apiKey) {
    config.minimaxApiKeyEnc = CryptoUtil.encrypt(dto.minimax.apiKey);
  }
  if (dto.xiaomi?.apiKey) {
    config.xiaomiApiKeyEnc = CryptoUtil.encrypt(dto.xiaomi.apiKey);
  }
  config.minimaxGroupId = dto.minimax?.groupId || null;
  
  await this.ttsConfigRepo.save(config);
  this.logger.log('TTS config saved with encrypted keys');
}

async getTtsConfig(): Promise<TtsConfigResponseDto> {
  const config = await this.ttsConfigRepo.findOne({ where: { id: 1 } });
  return {
    activeProvider: config?.activeProvider || 'minimax',
    minimax: {
      apiKey: config?.minimaxApiKeyEnc ? CryptoUtil.decrypt(config.minimaxApiKeyEnc) : '',
      groupId: config?.minimaxGroupId || '',
    },
    xiaomi: {
      apiKey: config?.xiaomiApiKeyEnc ? CryptoUtil.decrypt(config.xiaomiApiKeyEnc) : '',
    },
  };
}
```

### 步骤 4：验证

```bash
# 保存配置
curl -X POST http://localhost:3000/api/admin/config/tts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"activeProvider":"minimax","minimax":{"apiKey":"sk-test","groupId":"123"}}'

# 检查数据库
mysql -h127.0.0.1 -uopinion -popinionpass opinion_monitor \
  -e "SELECT id, activeProvider, LENGTH(minimaxApiKeyEnc) as keyLen FROM tts_config;"

# 重新获取
curl http://localhost:3000/api/admin/config/tts \
  -H "Authorization: Bearer $TOKEN"
```

---

## 任务 8：监控任务管理入口（P1，2h）

### 步骤 1：新增路由

```typescript
// frontend-admin/src/router/index.ts
// 在 children 数组中添加
{
  path: 'monitor-tasks',
  component: () => import('@/pages/MonitorTasksPage.vue'),
}
```

### 步骤 2：创建简化版页面

```vue
<!-- frontend-admin/src/pages/MonitorTasksPage.vue -->
<template>
  <div class="monitor-tasks-page">
    <GlassCard title="监控任务管理" icon="📋" subtitle="查看和管理所有监控任务">
      <el-table :data="tasks" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="任务名称" min-width="200" />
        <el-table-column prop="keywords" label="关键词" width="200" show-overflow-tooltip />
        <el-table-column label="平台" width="150">
          <template #default="{ row }">
            <el-tag v-for="p in row.platforms" :key="p" size="small" style="margin: 2px;">{{ p }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">
              {{ row.isEnabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const loading = ref(false);
const tasks = ref<any[]>([]);

onMounted(async () => {
  loading.value = true;
  try {
    const res = await http.get('/monitor-tasks');
    tasks.value = res.data || [];
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
});

function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN');
}
</script>
```

### 步骤 3：添加菜单项

```vue
<!-- frontend-admin/src/layouts/AdminLayout.vue -->
<!-- 在菜单配置中添加 -->
{
  label: '监控任务',
  icon: 'Monitor',
  path: '/monitor-tasks',
}
```

### 步骤 4：验证

1. 启动前端：`cd frontend-admin && pnpm dev`
2. 访问管理端，左侧菜单应出现「监控任务」
3. 点击进入，显示任务列表
4. 报告模板页面的任务 ID 下拉框有选项

---

## 任务 4+5：真实数据接入（P2，5h）

### 品牌声誉真实数据（3h）

#### 1. 图标修复

```typescript
// frontend-admin/src/pages/BrandReputationPage.vue
// 在 <script setup> 顶部添加
import { TrendCharts, DataAnalysis, PieChart, BarChart } from '@element-plus/icons-vue';

// 替换所有 :icon="'xxx'" 为 :icon="ComponentName"
```

#### 2. 实现真实聚合

```typescript
// backend/src/modules/brand-reputation/brand-reputation.service.ts
async analyze(dto: BrandAnalysisDto): Promise<BrandReputationData> {
  const [startDate, endDate] = dto.dateRange;
  
  // 查询所有事件
  const events = await this.eventRepo.find({
    where: {
      matched_at: Between(startDate, endDate),
    },
  });
  
  // 筛选品牌事件
  const brandEvents = events.filter(e => 
    dto.brandKeywords.some(kw => 
      (e.title || '').includes(kw) || (e.content || '').includes(kw)
    )
  );
  
  const brandVoice = brandEvents.length;
  const totalVoice = events.length;
  const shareOfVoice = totalVoice > 0 ? ((brandVoice / totalVoice) * 100).toFixed(2) : '0';
  
  // 情感聚合
  const positiveCount = brandEvents.filter(e => e.sentiment === 'positive').length;
  const negativeCount = brandEvents.filter(e => e.sentiment === 'negative').length;
  const neutralCount = brandEvents.filter(e => e.sentiment === 'neutral').length;
  
  // NPS 计算（简化版）
  const npsScore = totalVoice > 0 
    ? Math.round(((positiveCount - negativeCount) / totalVoice) * 100)
    : 0;
  
  return {
    overview: {
      brandVoice,
      shareOfVoice: parseFloat(shareOfVoice),
      npsScore,
      sentimentScore: positiveCount - negativeCount,
      trend: npsScore > 10 ? 'rising' : npsScore < -10 ? 'declining' : 'stable',
    },
    competitorComparison: [], // 同样逻辑聚合竞品数据
    timeSeriesData: [], // 按时间分组聚合
  };
}
```

#### 3. 移除 Mock 逻辑

```typescript
// backend/src/modules/brand-reputation/brand-reputation.controller.ts
@Post()
async analyze(@Body() dto: BrandAnalysisDto) {
  // 移除 if (query.mock) return mockData;
  return this.service.analyze(dto);
}
```

### 竞品追踪真实数据（2h）

```typescript
// backend/src/modules/competitor/competitor.service.ts
async getComparison(groupId: number): Promise<CompetitorComparisonData> {
  const group = await this.groupRepo.findOne({ 
    where: { id: groupId },
  });
  
  if (!group) {
    throw new NotFoundException('Competitor group not found');
  }
  
  const competitors = JSON.parse(group.competitors_json || '[]');
  
  const results = await Promise.all(competitors.map(async (comp: any) => {
    const events = await this.eventRepo.find({
      where: [
        { title: Like(`%${comp.name}%`) },
        { content: Like(`%${comp.name}%`) },
      ],
    });
    
    const totalMentions = events.length;
    const positive = events.filter(e => e.sentiment === 'positive').length;
    const negative = events.filter(e => e.sentiment === 'negative').length;
    const sentimentScore = positive - negative;
    
    // 平台分布
    const platformBreakdown = events.reduce((acc, e) => {
      acc[e.platform] = (acc[e.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      id: comp.id,
      name: comp.name,
      totalMentions,
      sentimentScore,
      shareOfVoice: 0, // 需要全局事件总数计算
      platformBreakdown,
    };
  }));
  
  return { competitors: results };
}
```

---

## 验收清单

### TTS Key 持久化
- [ ] 保存 MiniMax API Key 后刷新页面，Key 仍显示
- [ ] 重新登录后 Key 不消失
- [ ] 数据库中 `minimaxApiKeyEnc` 字段为密文

### 监控任务入口
- [ ] 管理端左侧菜单出现「监控任务」
- [ ] 点击进入显示任务列表
- [ ] 报告模板生成对话框中任务 ID 下拉框有选项

### 品牌声誉真实数据
- [ ] 所有按钮图标正常显示
- [ ] 输入「LV」后点击分析，返回真实聚合数据
- [ ] 声量/NPS/情感得分与数据库事件匹配

### 竞品追踪真实数据
- [ ] 创建竞品组后，查看返回真实数据
- [ ] 各竞品的声量/情感/平台分布正确

---

**预计总工时**: 11 小时  
**建议顺序**: 任务 8 → 任务 7 → 任务 4+5

