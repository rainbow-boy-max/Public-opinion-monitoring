<template>
  <div class="prediction-container">
    <el-card>
      <template #header>
        <span>趋势预测看板</span>
      </template>

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
