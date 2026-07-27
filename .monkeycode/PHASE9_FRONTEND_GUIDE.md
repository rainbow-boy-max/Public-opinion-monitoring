# Phase 9 前端可视化完整指南

## 概述

Phase 9 前端包含两个主要页面：
1. **趋势预测看板**：展示事件列表和预测结果
2. **归因分析详情页**：展示归因分析报告和可视化图谱

---

## 一、趋势预测看板页面

### 文件位置
`frontend-admin/src/views/prediction/index.vue`

### 页面功能
- 事件列表（可预测的事件）
- 创建预测按钮
- 预测结果展示（ECharts 曲线图）
- 风险等级标签
- 异常点标注
- 筛选功能（风险等级）

### 完整代码

```vue
<template>
  <div class="prediction-container">
    <el-card>
      <template #header>
        <span>趋势预测看板</span>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" :model="queryForm" class="filter-form">
        <el-form-item label="风险等级">
          <el-select v-model="queryForm.riskLevel" placeholder="全部" clearable style="width: 150px">
            <el-option label="低风险" value="low" />
            <el-option label="中风险" value="medium" />
            <el-option label="高风险" value="high" />
            <el-option label="严重风险" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 预测列表 -->
      <el-table :data="tableData" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="事件标题" min-width="200">
          <template #default="{ row }">
            {{ row.event?.title || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="predictionHorizon" label="预测时长" width="120">
          <template #default="{ row }">
            {{ row.predictionHorizon }} 小时
          </template>
        </el-table-column>
        <el-table-column prop="riskLevel" label="风险等级" width="120">
          <template #default="{ row }">
            <el-tag :type="getRiskTag(row.riskLevel)">
              {{ getRiskText(row.riskLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="confidenceScore" label="置信度" width="100">
          <template #default="{ row }">
            {{ row.confidenceScore }}%
          </template>
        </el-table-column>
        <el-table-column prop="anomalyDetected" label="异常检测" width="100">
          <template #default="{ row }">
            <el-tag :type="row.anomalyDetected ? 'danger' : 'success'">
              {{ row.anomalyDetected ? '异常' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleViewChart(row)">
              查看图表
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="queryForm.page"
        v-model:page-size="queryForm.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleQuery"
        @current-change="handleQuery"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>

    <!-- 预测图表对话框 -->
    <el-dialog
      v-model="chartDialogVisible"
      :title="currentPrediction?.event?.title || '趋势预测图表'"
      width="80%"
      destroy-on-close
    >
      <div ref="chartRef" style="width: 100%; height: 500px"></div>
      
      <div style="margin-top: 20px">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="风险等级">
            <el-tag :type="getRiskTag(currentPrediction?.riskLevel)">
              {{ getRiskText(currentPrediction?.riskLevel) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="置信度">
            {{ currentPrediction?.confidenceScore }}%
          </el-descriptions-item>
          <el-descriptions-item label="预测时长">
            {{ currentPrediction?.predictionHorizon }} 小时
          </el-descriptions-item>
          <el-descriptions-item label="历史数据点">
            {{ currentPrediction?.historicalDataPoints }} 个
          </el-descriptions-item>
          <el-descriptions-item label="异常检测">
            <el-tag :type="currentPrediction?.anomalyDetected ? 'danger' : 'success'">
              {{ currentPrediction?.anomalyDetected ? '检测到异常' : '正常' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="算法">
            {{ currentPrediction?.algorithmUsed }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import request from '@/utils/request'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const chartDialogVisible = ref(false)
const currentPrediction = ref<any>(null)
const chartRef = ref<HTMLElement>()

const queryForm = ref({
  riskLevel: '',
  page: 1,
  pageSize: 20,
})

const getRiskText = (level?: string) => {
  const map: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    critical: '严重风险',
  }
  return map[level || ''] || level
}

const getRiskTag = (level?: string) => {
  const map: Record<string, any> = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
    critical: 'danger',
  }
  return map[level || ''] || ''
}

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return ''
  return dateStr.replace('T', ' ').substring(0, 19)
}

const fetchPredictions = async () => {
  try {
    loading.value = true
    const params: any = {
      page: queryForm.value.page,
      pageSize: queryForm.value.pageSize,
    }
    if (queryForm.value.riskLevel) {
      params.riskLevel = queryForm.value.riskLevel
    }
    
    const res = await request.get('/api/prediction/trend', { params })
    tableData.value = res.data || []
    total.value = res.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取预测列表失败')
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  queryForm.value.page = 1
  fetchPredictions()
}

const handleReset = () => {
  queryForm.value.riskLevel = ''
  queryForm.value.page = 1
  queryForm.value.pageSize = 20
  fetchPredictions()
}

const handleViewChart = async (row: any) => {
  currentPrediction.value = row
  chartDialogVisible.value = true
  
  await nextTick()
  renderChart()
}

const renderChart = () => {
  if (!chartRef.value || !currentPrediction.value) return
  
  const chart = echarts.init(chartRef.value)
  
  const predictedData = currentPrediction.value.predictedHeat || []
  const times = predictedData.map((item: any) => {
    return new Date(item.timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  })
  const values = predictedData.map((item: any) => item.value)
  
  const option = {
    title: {
      text: '趋势预测曲线',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const item = params[0]
        return `${item.name}<br/>预测热度: ${item.value}`
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: false,
      axisLabel: {
        rotate: 45,
      },
    },
    yAxis: {
      type: 'value',
      name: '热度',
    },
    series: [
      {
        name: '预测热度',
        type: 'line',
        smooth: true,
        data: values,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64, 158, 255, 0.5)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.1)' },
          ]),
        },
        lineStyle: {
          color: '#409EFF',
          width: 2,
        },
        itemStyle: {
          color: '#409EFF',
        },
        markPoint: currentPrediction.value.anomalyDetected ? {
          data: [
            { type: 'max', name: '异常峰值' },
          ],
          symbol: 'pin',
          symbolSize: 50,
          itemStyle: {
            color: '#F56C6C',
          },
        } : undefined,
      },
    ],
  }
  
  chart.setOption(option)
}

onMounted(() => {
  fetchPredictions()
})
</script>

<style scoped lang="scss">
.prediction-container {
  padding: 20px;
}

.filter-form {
  margin-bottom: 20px;
}
</style>
```

---

## 二、归因分析详情页面

### 文件位置
`frontend-admin/src/views/attribution/detail.vue`

### 页面功能
- 归因分析报告展示
- 触发事件时间线
- 关键节点列表
- 传播路径图谱（ECharts Graph）
- 创建归因分析

### 完整代码

```vue
<template>
  <div class="attribution-container">
    <el-card>
      <template #header>
        <div class="header-actions">
          <span>归因分析详情</span>
          <el-button type="primary" @click="handleCreateAnalysis" :loading="creating">
            生成归因分析
          </el-button>
        </div>
      </template>

      <!-- 事件选择 -->
      <el-form :inline="true" :model="queryForm" v-if="!analysis">
        <el-form-item label="事件ID">
          <el-input-number v-model="queryForm.eventId" :min="1" placeholder="请输入事件ID" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">查询</el-button>
        </el-form-item>
      </el-form>

      <!-- 归因分析结果 -->
      <div v-if="analysis" v-loading="loading">
        <!-- 基本信息 -->
        <el-descriptions :column="2" border style="margin-bottom: 20px">
          <el-descriptions-item label="事件标题" :span="2">
            {{ analysis.event?.title }}
          </el-descriptions-item>
          <el-descriptions-item label="触发事件数">
            {{ analysis.triggerEvents?.length || 0 }} 个
          </el-descriptions-item>
          <el-descriptions-item label="关键节点数">
            {{ analysis.keyNodes?.length || 0 }} 个
          </el-descriptions-item>
          <el-descriptions-item label="分析时长">
            {{ analysis.analysisDurationMs }} ms
          </el-descriptions-item>
          <el-descriptions-item label="生成方式">
            {{ analysis.llmGenerated ? 'LLM 生成' : '规则生成' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 触发事件时间线 -->
        <el-divider content-position="left">触发事件时间线</el-divider>
        <el-timeline v-if="analysis.triggerEvents && analysis.triggerEvents.length > 0">
          <el-timeline-item
            v-for="(event, index) in analysis.triggerEvents"
            :key="index"
            :timestamp="formatDateTime(event.time)"
            placement="top"
          >
            <el-card>
              <h4>{{ event.title }}</h4>
              <p>影响力: {{ event.impact.toFixed(2) }}</p>
            </el-card>
          </el-timeline-item>
        </el-timeline>

        <!-- 关键节点列表 -->
        <el-divider content-position="left">关键传播节点</el-divider>
        <el-table :data="analysis.keyNodes" border stripe>
          <el-table-column prop="name" label="节点名称" />
          <el-table-column prop="type" label="节点类型" width="120">
            <template #default="{ row }">
              <el-tag :type="getNodeTypeTag(row.type)">
                {{ getNodeTypeText(row.type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="propagationPower" label="传播力" width="150">
            <template #default="{ row }">
              {{ row.propagationPower.toFixed(2) }}
            </template>
          </el-table-column>
        </el-table>

        <!-- 传播路径图谱 -->
        <el-divider content-position="left">传播路径图谱</el-divider>
        <div ref="graphRef" style="width: 100%; height: 600px"></div>

        <!-- 归因分析报告 -->
        <el-divider content-position="left">归因分析报告</el-divider>
        <div class="analysis-content">
          <div v-html="renderedContent"></div>
        </div>
      </div>

      <el-empty v-else description="请选择事件或生成归因分析" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import * as echarts from 'echarts'
import request from '@/utils/request'

const route = useRoute()
const loading = ref(false)
const creating = ref(false)
const analysis = ref<any>(null)
const graphRef = ref<HTMLElement>()

const queryForm = ref({
  eventId: 0,
})

const renderedContent = computed(() => {
  if (!analysis.value?.analysisContent) return ''
  return marked.parse(analysis.value.analysisContent)
})

const getNodeTypeText = (type: string) => {
  const map: Record<string, string> = {
    kol: 'KOL',
    media: '媒体',
    official: '官方',
  }
  return map[type] || type
}

const getNodeTypeTag = (type: string) => {
  const map: Record<string, any> = {
    kol: 'primary',
    media: 'success',
    official: 'warning',
  }
  return map[type] || ''
}

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const fetchAnalysis = async (eventId: number) => {
  try {
    loading.value = true
    const res = await request.get(`/api/analysis/attribution/${eventId}`)
    if (res.data) {
      analysis.value = res.data
      await nextTick()
      renderGraph()
    } else {
      ElMessage.info('该事件暂无归因分析')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取归因分析失败')
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  if (!queryForm.value.eventId) {
    ElMessage.warning('请输入事件ID')
    return
  }
  fetchAnalysis(queryForm.value.eventId)
}

const handleCreateAnalysis = async () => {
  if (!queryForm.value.eventId) {
    ElMessage.warning('请输入事件ID')
    return
  }
  
  try {
    creating.value = true
    await request.post('/api/analysis/attribution', { eventId: queryForm.value.eventId })
    ElMessage.success('归因分析已创建，正在生成中...')
    
    setTimeout(() => {
      fetchAnalysis(queryForm.value.eventId)
    }, 2000)
  } catch (error: any) {
    ElMessage.error(error.message || '创建失败')
  } finally {
    creating.value = false
  }
}

const renderGraph = () => {
  if (!graphRef.value || !analysis.value) return
  
  const chart = echarts.init(graphRef.value)
  
  const nodes = analysis.value.keyNodes.map((node: any, index: number) => ({
    id: `Node_${index}`,
    name: node.name,
    value: node.propagationPower,
    symbolSize: Math.min(Math.max(node.propagationPower / 10, 30), 80),
    itemStyle: {
      color: node.type === 'kol' ? '#409EFF' : node.type === 'media' ? '#67C23A' : '#E6A23C',
    },
  }))
  
  const links = analysis.value.propagationPath.map((edge: any) => ({
    source: edge.source,
    target: edge.target,
    value: edge.weight,
  }))
  
  const option = {
    title: {
      text: '传播路径图谱',
      left: 'center',
    },
    tooltip: {
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `${params.data.name}<br/>传播力: ${params.data.value.toFixed(2)}`
        } else {
          return `${params.data.source} → ${params.data.target}`
        }
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        roam: true,
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
        },
        force: {
          repulsion: 200,
          edgeLength: 150,
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3,
        },
      },
    ],
  }
  
  chart.setOption(option)
}

onMounted(() => {
  if (route.params.eventId) {
    queryForm.value.eventId = +route.params.eventId
    fetchAnalysis(queryForm.value.eventId)
  }
})
</script>

<style scoped lang="scss">
.attribution-container {
  padding: 20px;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.analysis-content {
  padding: 20px;
  background: #f9f9f9;
  border-radius: 4px;
  line-height: 1.8;

  :deep(h2) {
    margin-top: 20px;
    margin-bottom: 10px;
  }

  :deep(h3) {
    margin-top: 15px;
    margin-bottom: 8px;
  }

  :deep(p) {
    margin: 10px 0;
  }
}
</style>
```

---

## 三、路由配置

### 在 `frontend-admin/src/router/index.ts` 添加：

```typescript
{
  path: '/prediction',
  component: Layout,
  meta: { title: '趋势预测', icon: 'TrendCharts' },
  children: [
    {
      path: '',
      name: 'PredictionDashboard',
      component: () => import('@/views/prediction/index.vue'),
      meta: { title: '趋势预测看板' }
    }
  ]
},
{
  path: '/attribution',
  component: Layout,
  meta: { title: '归因分析', icon: 'Connection' },
  children: [
    {
      path: 'detail/:eventId?',
      name: 'AttributionDetail',
      component: () => import('@/views/attribution/detail.vue'),
      meta: { title: '归因分析详情' }
    }
  ]
}
```

---

## 四、安装依赖

```bash
cd frontend-admin
pnpm add echarts marked
```

---

## 五、集成步骤

1. **创建页面目录**
```bash
mkdir -p frontend-admin/src/views/prediction
mkdir -p frontend-admin/src/views/attribution
```

2. **复制代码**
   - 将上述代码复制到对应文件
   - 调整导入路径（根据项目实际情况）

3. **配置路由**
   - 添加到 router/index.ts
   - 配置侧边栏菜单

4. **测试访问**
   - 启动前端服务
   - 访问 `/prediction` 和 `/attribution/detail`

---

## 六、功能测试清单

### 趋势预测测试
- [ ] 访问趋势预测看板
- [ ] 筛选不同风险等级
- [ ] 分页功能正常
- [ ] 点击查看图表
- [ ] ECharts 曲线渲染正常
- [ ] 异常点标注显示
- [ ] 风险等级标签正确

### 归因分析测试
- [ ] 输入事件ID查询
- [ ] 生成归因分析
- [ ] 触发事件时间线显示
- [ ] 关键节点列表正常
- [ ] 传播路径图谱渲染
- [ ] Markdown 报告渲染
- [ ] 节点类型标签正确

---

**文档版本**：v1.0  
**更新日期**：2026-07-23  
**状态**：前端实施指南完成
