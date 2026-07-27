<template>
  <div class="alert-history-container">
    <el-card>
      <template #header>
        <span>预警历史</span>
      </template>

      <el-form :inline="true" :model="queryForm" class="filter-form">
        <el-form-item label="预警等级">
          <el-select v-model="queryForm.alertLevel" placeholder="全部" clearable>
            <el-option label="一般" value="normal" />
            <el-option label="重要" value="important" />
            <el-option label="重大" value="major" />
            <el-option label="特级" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="发送状态">
          <el-select v-model="queryForm.status" placeholder="全部" clearable>
            <el-option label="待发送" value="pending" />
            <el-option label="已发送" value="sent" />
            <el-option label="发送失败" value="failed" />
            <el-option label="已确认" value="confirmed" />
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
        <el-table-column prop="alertLevel" label="预警等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getLevelTag(row.alertLevel)">
              {{ getLevelText(row.alertLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="alertChannel" label="通知渠道" width="120">
          <template #default="{ row }">
            {{ getChannelText(row.alertChannel) }}
          </template>
        </el-table-column>
        <el-table-column prop="recipient" label="接收人" width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sentAt" label="发送时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.sentAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">
              查看
            </el-button>
            <el-button
              type="success"
              size="small"
              @click="handleConfirm(row)"
              :disabled="row.status === 'confirmed'"
            >
              确认
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

    <el-dialog v-model="detailDialogVisible" title="预警详情" width="60%">
      <el-descriptions :column="2" border v-if="currentRecord">
        <el-descriptions-item label="事件标题" :span="2">
          {{ currentRecord.event?.title }}
        </el-descriptions-item>
        <el-descriptions-item label="预警等级">
          <el-tag :type="getLevelTag(currentRecord.alertLevel)">
            {{ getLevelText(currentRecord.alertLevel) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="通知渠道">
          {{ getChannelText(currentRecord.alertChannel) }}
        </el-descriptions-item>
        <el-descriptions-item label="接收人">
          {{ currentRecord.recipient }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTag(currentRecord.status)">
            {{ getStatusText(currentRecord.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="发送时间" :span="2">
          {{ formatDateTime(currentRecord.sentAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="预警内容" :span="2">
          <pre style="white-space: pre-wrap">{{ currentRecord.content }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="处理反馈" :span="2" v-if="currentRecord.feedback">
          {{ currentRecord.feedback }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="confirmDialogVisible" title="确认预警处理" width="40%">
      <el-form :model="confirmForm" label-width="100px">
        <el-form-item label="处理反馈">
          <el-input
            v-model="confirmForm.feedback"
            type="textarea"
            :rows="4"
            placeholder="请输入处理反馈（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitConfirm" :loading="confirming">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const loading = ref(false)
const confirming = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const detailDialogVisible = ref(false)
const confirmDialogVisible = ref(false)
const currentRecord = ref<any>(null)

const queryForm = ref({
  alertLevel: '',
  status: '',
  page: 1,
  pageSize: 20,
})

const confirmForm = ref({
  feedback: '',
})

const getLevelText = (level: string) => {
  const map: Record<string, string> = {
    normal: '一般',
    important: '重要',
    major: '重大',
    critical: '特级',
  }
  return map[level] || level
}

const getLevelTag = (level: string) => {
  const map: Record<string, any> = {
    normal: 'info',
    important: 'warning',
    major: 'danger',
    critical: 'danger',
  }
  return map[level] || ''
}

const getChannelText = (channel: string) => {
  const map: Record<string, string> = {
    sms: '短信',
    email: '邮件',
    wechat: '企业微信',
    dingtalk: '钉钉',
    internal: '站内消息',
  }
  return map[channel] || channel
}

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待发送',
    sent: '已发送',
    failed: '发送失败',
    confirmed: '已确认',
  }
  return map[status] || status
}

const getStatusTag = (status: string) => {
  const map: Record<string, any> = {
    pending: 'info',
    sent: 'success',
    failed: 'danger',
    confirmed: 'success',
  }
  return map[status] || ''
}

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-'
  return dateStr.replace('T', ' ').substring(0, 19)
}

const fetchRecords = async () => {
  try {
    loading.value = true
    const params: any = {
      page: queryForm.value.page,
      pageSize: queryForm.value.pageSize,
    }
    if (queryForm.value.alertLevel) {
      params.alertLevel = queryForm.value.alertLevel
    }
    if (queryForm.value.status) {
      params.status = queryForm.value.status
    }
    
    const res = await request.get('/api/alert/records', { params })
    tableData.value = res.data || []
    total.value = res.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取预警记录失败')
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  queryForm.value.page = 1
  fetchRecords()
}

const handleReset = () => {
  queryForm.value.alertLevel = ''
  queryForm.value.status = ''
  queryForm.value.page = 1
  queryForm.value.pageSize = 20
  fetchRecords()
}

const handleView = async (row: any) => {
  try {
    const res = await request.get(`/api/alert/records/${row.id}`)
    currentRecord.value = res.data
    detailDialogVisible.value = true
  } catch (error: any) {
    ElMessage.error(error.message || '获取详情失败')
  }
}

const handleConfirm = (row: any) => {
  currentRecord.value = row
  confirmForm.value.feedback = ''
  confirmDialogVisible.value = true
}

const submitConfirm = async () => {
  try {
    confirming.value = true
    await request.post(`/api/alert/records/${currentRecord.value.id}/confirm`, confirmForm.value)
    ElMessage.success('预警已确认')
    confirmDialogVisible.value = false
    fetchRecords()
  } catch (error: any) {
    ElMessage.error(error.message || '确认失败')
  } finally {
    confirming.value = false
  }
}

onMounted(() => {
  fetchRecords()
})
</script>

<style scoped lang="scss">
.alert-history-container {
  padding: 20px;
}

.filter-form {
  margin-bottom: 20px;
}
</style>
