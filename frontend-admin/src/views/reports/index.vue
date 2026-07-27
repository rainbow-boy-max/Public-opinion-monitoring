<template>
  <div class="reports-container">
    <el-card>
      <template #header>
        <div class="header-actions">
          <span>报告管理</span>
          <el-button type="primary" @click="goToCreate">
            <el-icon><Plus /></el-icon>
            创建报告
          </el-button>
        </div>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" :model="queryForm" class="filter-form">
        <el-form-item label="报告类型">
          <el-select v-model="queryForm.reportType" placeholder="全部" clearable style="width: 150px">
            <el-option label="日报" value="daily" />
            <el-option label="周报" value="weekly" />
            <el-option label="月报" value="monthly" />
            <el-option label="专项报告" value="special" />
          </el-select>
        </el-form-item>
        <el-form-item label="生成状态">
          <el-select v-model="queryForm.status" placeholder="全部" clearable style="width: 150px">
            <el-option label="待生成" value="pending" />
            <el-option label="生成中" value="generating" />
            <el-option label="已完成" value="completed" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 报告列表 -->
      <el-table :data="tableData" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="报告标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="reportType" label="报告类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getReportTypeTag(row.reportType)">
              {{ getReportTypeText(row.reportType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间范围" width="220">
          <template #default="{ row }">
            {{ formatDate(row.startDate) }} ~ {{ formatDate(row.endDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              @click="handleView(row)"
              :disabled="row.status !== 'completed'"
            >
              查看
            </el-button>
            <el-button
              type="success"
              size="small"
              @click="handleExport(row, 'word')"
              :disabled="row.status !== 'completed'"
            >
              导出Word
            </el-button>
            <el-button
              type="success"
              size="small"
              @click="handleExport(row, 'pdf')"
              :disabled="row.status !== 'completed'"
            >
              导出PDF
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="handleDelete(row)"
            >
              删除
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import request from '@/utils/request'

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)

const queryForm = ref({
  reportType: '',
  status: '',
  page: 1,
  pageSize: 20,
})

const getReportTypeText = (type: string) => {
  const map: Record<string, string> = {
    daily: '日报',
    weekly: '周报',
    monthly: '月报',
    special: '专项报告',
  }
  return map[type] || type
}

const getReportTypeTag = (type: string) => {
  const map: Record<string, any> = {
    daily: 'primary',
    weekly: 'success',
    monthly: 'warning',
    special: 'danger',
  }
  return map[type] || ''
}

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待生成',
    generating: '生成中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status] || status
}

const getStatusTag = (status: string) => {
  const map: Record<string, any> = {
    pending: 'info',
    generating: 'warning',
    completed: 'success',
    failed: 'danger',
  }
  return map[status] || ''
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return ''
  return dateStr.replace('T', ' ').substring(0, 19)
}

const fetchReports = async () => {
  try {
    loading.value = true
    const params: any = {
      page: queryForm.value.page,
      pageSize: queryForm.value.pageSize,
    }
    if (queryForm.value.reportType) {
      params.reportType = queryForm.value.reportType
    }
    if (queryForm.value.status) {
      params.status = queryForm.value.status
    }
    
    const res = await request.get('/admin/reports', { params })
    tableData.value = res.data || []
    total.value = res.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取报告列表失败')
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  queryForm.value.page = 1
  fetchReports()
}

const handleReset = () => {
  queryForm.value.reportType = ''
  queryForm.value.status = ''
  queryForm.value.page = 1
  queryForm.value.pageSize = 20
  fetchReports()
}

const goToCreate = () => {
  router.push('/reports/create')
}

const handleView = (row: any) => {
  router.push(`/reports/${row.id}`)
}

const handleExport = async (row: any, format: 'word' | 'pdf') => {
  try {
    loading.value = true
    const res = await request.get(`/admin/reports/${row.id}/export`, {
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
    a.download = `${row.title}.${format === 'word' ? 'docx' : 'pdf'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败')
  } finally {
    loading.value = false
  }
}

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除该报告吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    
    loading.value = true
    await request.delete(`/admin/reports/${row.id}`)
    ElMessage.success('删除成功')
    fetchReports()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchReports()
})
</script>

<style scoped lang="scss">
.reports-container {
  padding: 20px;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  margin-bottom: 20px;
}
</style>
