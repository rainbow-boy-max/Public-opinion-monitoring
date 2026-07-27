<template>
  <div class="report-detail-container">
    <el-card v-loading="loading">
      <template #header>
        <div class="header-actions">
          <div class="left">
            <el-button @click="goBack" text>
              <el-icon><ArrowLeft /></el-icon>
              返回
            </el-button>
            <span class="title">{{ report?.title }}</span>
          </div>
          <div class="right">
            <el-button
              type="success"
              @click="handleExport('word')"
              :disabled="report?.status !== 'completed'"
              :loading="exporting"
            >
              <el-icon><Download /></el-icon>
              导出Word
            </el-button>
            <el-button
              type="success"
              @click="handleExport('pdf')"
              :disabled="report?.status !== 'completed'"
              :loading="exporting"
            >
              <el-icon><Download /></el-icon>
              导出PDF
            </el-button>
          </div>
        </div>
      </template>

      <!-- 报告信息 -->
      <el-descriptions :column="4" border style="margin-bottom: 20px">
        <el-descriptions-item label="报告类型">
          <el-tag :type="getReportTypeTag(report?.reportType)">
            {{ getReportTypeText(report?.reportType) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="生成状态">
          <el-tag :type="getStatusTag(report?.status)">
            {{ getStatusText(report?.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDateTime(report?.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="完成时间">
          {{ report?.completedAt ? formatDateTime(report.completedAt) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="时间范围" :span="2">
          {{ formatDate(report?.startDate) }} ~ {{ formatDate(report?.endDate) }}
        </el-descriptions-item>
        <el-descriptions-item label="创建人" :span="2">
          {{ report?.creator?.username || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 报告内容 -->
      <div v-if="report?.status === 'completed'" class="report-content">
        <el-divider content-position="left">报告内容</el-divider>
        <div class="markdown-body" v-html="renderedContent"></div>
      </div>

      <!-- 生成中提示 -->
      <el-alert
        v-else-if="report?.status === 'generating'"
        title="报告生成中"
        description="报告正在后台生成，请稍候刷新查看..."
        type="info"
        show-icon
        :closable="false"
      />

      <!-- 生成失败提示 -->
      <el-alert
        v-else-if="report?.status === 'failed'"
        title="报告生成失败"
        :description="report?.errorMessage || '未知错误'"
        type="error"
        show-icon
        :closable="false"
      />

      <!-- 待生成提示 -->
      <el-alert
        v-else-if="report?.status === 'pending'"
        title="报告待生成"
        description="报告已创建，正在排队等待生成..."
        type="warning"
        show-icon
        :closable="false"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Download } from '@element-plus/icons-vue'
import { marked } from 'marked'
import request from '@/utils/request'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const exporting = ref(false)
const report = ref<any>(null)

const renderedContent = computed(() => {
  if (!report.value?.content) return ''
  return marked.parse(report.value.content)
})

const getReportTypeText = (type?: string) => {
  if (!type) return ''
  const map: Record<string, string> = {
    daily: '日报',
    weekly: '周报',
    monthly: '月报',
    special: '专项报告',
  }
  return map[type] || type
}

const getReportTypeTag = (type?: string) => {
  if (!type) return ''
  const map: Record<string, any> = {
    daily: 'primary',
    weekly: 'success',
    monthly: 'warning',
    special: 'danger',
  }
  return map[type] || ''
}

const getStatusText = (status?: string) => {
  if (!status) return ''
  const map: Record<string, string> = {
    pending: '待生成',
    generating: '生成中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status] || status
}

const getStatusTag = (status?: string) => {
  if (!status) return ''
  const map: Record<string, any> = {
    pending: 'info',
    generating: 'warning',
    completed: 'success',
    failed: 'danger',
  }
  return map[status] || ''
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return ''
  return dateStr.replace('T', ' ').substring(0, 19)
}

const fetchReport = async () => {
  try {
    loading.value = true
    const id = route.params.id
    const res = await request.get(`/admin/reports/${id}`)
    report.value = res.data
  } catch (error: any) {
    ElMessage.error(error.message || '获取报告详情失败')
  } finally {
    loading.value = false
  }
}

const handleExport = async (format: 'word' | 'pdf') => {
  try {
    exporting.value = true
    const id = route.params.id
    const res = await request.get(`/admin/reports/${id}/export`, {
      params: { format },
      responseType: 'blob',
    })
    
    const blob = new Blob([res], {
      type: format === 'word'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf',
    })
    
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.value.title}.${format === 'word' ? 'docx' : 'pdf'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

const goBack = () => {
  router.back()
}

onMounted(() => {
  fetchReport()
})
</script>

<style scoped lang="scss">
.report-detail-container {
  padding: 20px;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .left {
    display: flex;
    align-items: center;
    gap: 10px;

    .title {
      font-size: 18px;
      font-weight: bold;
    }
  }

  .right {
    display: flex;
    gap: 10px;
  }
}

.report-content {
  margin-top: 20px;
}

.markdown-body {
  padding: 20px;
  background: #f9f9f9;
  border-radius: 4px;
  line-height: 1.8;

  :deep(h1) {
    border-bottom: 2px solid #409EFF;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }

  :deep(h2) {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 8px;
    margin-top: 25px;
    margin-bottom: 15px;
  }

  :deep(h3) {
    margin-top: 20px;
    margin-bottom: 12px;
  }

  :deep(ul), :deep(ol) {
    padding-left: 30px;
  }

  :deep(li) {
    margin: 5px 0;
  }

  :deep(p) {
    margin: 10px 0;
  }

  :deep(code) {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  :deep(pre) {
    background: #f5f5f5;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
  }
}
</style>
