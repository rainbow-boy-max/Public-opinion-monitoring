<template>
  <div class="create-report-container">
    <el-card>
      <template #header>
        <div class="header">
          <el-button @click="goBack" text>
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <span>创建报告</span>
        </div>
      </template>

      <el-steps :active="currentStep" finish-status="success" align-center style="margin-bottom: 40px">
        <el-step title="选择类型" />
        <el-step title="设置范围" />
        <el-step title="完成" />
      </el-steps>

      <!-- 步骤 1：选择报告类型 -->
      <div v-show="currentStep === 0" class="step-content">
        <h3>选择报告类型</h3>
        <el-row :gutter="20" style="margin-top: 30px">
          <el-col :span="6" v-for="type in reportTypes" :key="type.value">
            <el-card
              :class="['report-type-card', { active: formData.reportType === type.value }]"
              @click="selectReportType(type.value)"
              shadow="hover"
            >
              <div class="card-content">
                <el-icon :size="48" :color="type.color">
                  <component :is="type.icon" />
                </el-icon>
                <h4>{{ type.label }}</h4>
                <p>{{ type.description }}</p>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 步骤 2：设置时间范围和标题 -->
      <div v-show="currentStep === 1" class="step-content">
        <h3>设置报告参数</h3>
        <el-form :model="formData" :rules="rules" ref="formRef" label-width="120px" style="max-width: 600px; margin: 30px auto">
          <el-form-item label="报告标题" prop="title">
            <el-input v-model="formData.title" placeholder="请输入报告标题" />
          </el-form-item>
          <el-form-item label="时间范围" prop="dateRange">
            <el-date-picker
              v-model="formData.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="报告类型">
            <el-tag>{{ getReportTypeText(formData.reportType) }}</el-tag>
          </el-form-item>
        </el-form>
      </div>

      <!-- 步骤 3：确认信息 -->
      <div v-show="currentStep === 2" class="step-content">
        <h3>确认报告信息</h3>
        <el-descriptions :column="1" border style="max-width: 600px; margin: 30px auto">
          <el-descriptions-item label="报告类型">
            <el-tag>{{ getReportTypeText(formData.reportType) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="报告标题">
            {{ formData.title }}
          </el-descriptions-item>
          <el-descriptions-item label="开始日期">
            {{ formatDate(formData.dateRange?.[0]) }}
          </el-descriptions-item>
          <el-descriptions-item label="结束日期">
            {{ formatDate(formData.dateRange?.[1]) }}
          </el-descriptions-item>
        </el-descriptions>
        <el-alert
          title="生成提示"
          description="报告将在后台异步生成，预计需要 1-3 分钟。生成完成后，您可以在报告列表中查看和导出。"
          type="info"
          show-icon
          :closable="false"
          style="max-width: 600px; margin: 20px auto"
        />
      </div>

      <!-- 操作按钮 -->
      <div class="step-actions">
        <el-button v-if="currentStep > 0" @click="prevStep">上一步</el-button>
        <el-button v-if="currentStep < 2" type="primary" @click="nextStep" :disabled="!canNext">
          下一步
        </el-button>
        <el-button v-if="currentStep === 2" type="primary" @click="handleSubmit" :loading="submitting">
          创建报告
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Document, Calendar, TrendCharts, Files } from '@element-plus/icons-vue'
import request from '@/utils/request'

const router = useRouter()
const currentStep = ref(0)
const submitting = ref(false)
const formRef = ref()

const formData = ref({
  reportType: '',
  title: '',
  dateRange: null as any,
})

const reportTypes = [
  {
    value: 'daily',
    label: '日报',
    description: '每日舆情监测报告',
    icon: Document,
    color: '#409EFF',
  },
  {
    value: 'weekly',
    label: '周报',
    description: '每周舆情趋势分析',
    icon: Calendar,
    color: '#67C23A',
  },
  {
    value: 'monthly',
    label: '月报',
    description: '月度舆情总结报告',
    icon: TrendCharts,
    color: '#E6A23C',
  },
  {
    value: 'special',
    label: '专项报告',
    description: '专项舆情分析报告',
    icon: Files,
    color: '#F56C6C',
  },
]

const rules = {
  title: [{ required: true, message: '请输入报告标题', trigger: 'blur' }],
  dateRange: [{ required: true, message: '请选择时间范围', trigger: 'change' }],
}

const canNext = computed(() => {
  if (currentStep.value === 0) {
    return !!formData.value.reportType
  }
  if (currentStep.value === 1) {
    return !!(formData.value.title && formData.value.dateRange)
  }
  return true
})

const getReportTypeText = (type: string) => {
  const item = reportTypes.find(t => t.value === type)
  return item?.label || type
}

const formatDate = (date: Date) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const selectReportType = (type: string) => {
  formData.value.reportType = type
}

const nextStep = async () => {
  if (currentStep.value === 1) {
    try {
      await formRef.value.validate()
    } catch {
      return
    }
  }
  currentStep.value++
}

const prevStep = () => {
  currentStep.value--
}

const goBack = () => {
  router.back()
}

const handleSubmit = async () => {
  try {
    submitting.value = true
    
    const payload = {
      reportType: formData.value.reportType,
      title: formData.value.title,
      startDate: formatDate(formData.value.dateRange[0]),
      endDate: formatDate(formData.value.dateRange[1]),
    }
    
    await request.post('/admin/reports', payload)
    
    ElMessage.success('报告创建成功，正在后台生成中...')
    
    setTimeout(() => {
      router.push('/reports')
    }, 1500)
  } catch (error: any) {
    ElMessage.error(error.message || '创建失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.create-report-container {
  padding: 20px;
}

.header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-content {
  min-height: 400px;
  padding: 20px;

  h3 {
    text-align: center;
    margin-bottom: 20px;
    font-size: 20px;
  }
}

.report-type-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-5px);
  }

  &.active {
    border: 2px solid #409EFF;
    box-shadow: 0 0 10px rgba(64, 158, 255, 0.3);
  }

  .card-content {
    text-align: center;
    padding: 20px 0;

    h4 {
      margin: 15px 0 10px;
      font-size: 18px;
    }

    p {
      color: #999;
      font-size: 14px;
      margin: 0;
    }
  }
}

.step-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 40px;
  padding: 20px 0;
}
</style>
