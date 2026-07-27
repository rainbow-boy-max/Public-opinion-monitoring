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

      <el-form :inline="true" :model="queryForm" v-if="!analysis">
        <el-form-item label="事件ID">
          <el-input-number v-model="queryForm.eventId" :min="1" placeholder="请输入事件ID" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">查询</el-button>
        </el-form-item>
      </el-form>

      <div v-if="analysis" v-loading="loading">
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

        <el-divider content-position="left">传播路径图谱</el-divider>
        <div ref="graphRef" style="width: 100%; height: 600px"></div>

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
