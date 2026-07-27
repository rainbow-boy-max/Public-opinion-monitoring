# Phase 10 前端实施指南

## 概述

Phase 10 前端包含两个主要页面：
1. **预警配置页**：用户自定义预警规则和通知设置
2. **预警历史页**：查看和管理预警记录

---

## 一、预警配置页面

### 文件位置
`frontend-admin/src/views/alert-config/index.vue`

### 页面功能

- 预警等级选择（4 级）
- 通知渠道配置（多选）
- 接收人管理（分渠道）
- 触发条件设置
- 免打扰时段配置
- 保存和重置

### 完整代码

```vue
<template>
  <div class="alert-config-container">
    <el-card>
      <template #header>
        <span>预警配置</span>
      </template>

      <el-form :model="formData" :rules="rules" ref="formRef" label-width="120px">
        <!-- 预警等级 -->
        <el-form-item label="预警等级" prop="alertLevel">
          <el-select v-model="formData.alertLevel" placeholder="选择预警等级">
            <el-option label="一般（24h 汇总）" value="normal" />
            <el-option label="重要（4h 内推送）" value="important" />
            <el-option label="重大（1h 内推送）" value="major" />
            <el-option label="特级（15min 内推送）" value="critical" />
          </el-select>
        </el-form-item>

        <!-- 通知渠道 -->
        <el-form-item label="通知渠道" prop="enabledChannels">
          <el-checkbox-group v-model="formData.enabledChannels">
            <el-checkbox label="sms">短信</el-checkbox>
            <el-checkbox label="email">邮件</el-checkbox>
            <el-checkbox label="wechat">企业微信</el-checkbox>
            <el-checkbox label="dingtalk">钉钉</el-checkbox>
            <el-checkbox label="internal">站内消息</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <!-- 接收人配置 -->
        <el-form-item label="短信接收人" v-if="formData.enabledChannels.includes('sms')">
          <el-input
            v-model="phoneInput"
            placeholder="输入手机号，按回车添加"
            @keyup.enter="addPhone"
          >
            <template #append>
              <el-button @click="addPhone">添加</el-button>
            </template>
          </el-input>
          <el-tag
            v-for="phone in formData.recipients.phone"
            :key="phone"
            closable
            @close="removePhone(phone)"
            style="margin: 5px"
          >
            {{ phone }}
          </el-tag>
        </el-form-item>

        <el-form-item label="邮件接收人" v-if="formData.enabledChannels.includes('email')">
          <el-input
            v-model="emailInput"
            placeholder="输入邮箱，按回车添加"
            @keyup.enter="addEmail"
          >
            <template #append>
              <el-button @click="addEmail">添加</el-button>
            </template>
          </el-input>
          <el-tag
            v-for="email in formData.recipients.email"
            :key="email"
            closable
            @close="removeEmail(email)"
            style="margin: 5px"
          >
            {{ email }}
          </el-tag>
        </el-form-item>

        <el-form-item label="企业微信 Webhook" v-if="formData.enabledChannels.includes('wechat')">
          <el-input v-model="wechatInput" placeholder="输入 Webhook URL">
            <template #append>
              <el-button @click="addWechat">添加</el-button>
            </template>
          </el-input>
          <el-tag
            v-for="url in formData.recipients.wechat"
            :key="url"
            closable
            @close="removeWechat(url)"
            style="margin: 5px"
          >
            {{ url.substring(0, 30) }}...
          </el-tag>
        </el-form-item>

        <el-form-item label="钉钉 Webhook" v-if="formData.enabledChannels.includes('dingtalk')">
          <el-input v-model="dingtalkInput" placeholder="输入 Webhook URL">
            <template #append>
              <el-button @click="addDingtalk">添加</el-button>
            </template>
          </el-input>
          <el-tag
            v-for="url in formData.recipients.dingtalk"
            :key="url"
            closable
            @close="removeDingtalk(url)"
            style="margin: 5px"
          >
            {{ url.substring(0, 30) }}...
          </el-tag>
        </el-form-item>

        <!-- 触发条件 -->
        <el-divider content-position="left">触发条件</el-divider>

        <el-form-item label="最低阅读量">
          <el-input-number v-model="formData.triggerConditions.readCount" :min="0" />
        </el-form-item>

        <el-form-item label="最低点赞量">
          <el-input-number v-model="formData.triggerConditions.likeCount" :min="0" />
        </el-form-item>

        <el-form-item label="情感倾向">
          <el-checkbox-group v-model="formData.triggerConditions.sentiment">
            <el-checkbox label="positive">正面</el-checkbox>
            <el-checkbox label="neutral">中性</el-checkbox>
            <el-checkbox label="negative">负面</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="关键词">
          <el-input
            v-model="keywordInput"
            placeholder="输入关键词，按回车添加"
            @keyup.enter="addKeyword"
          >
            <template #append>
              <el-button @click="addKeyword">添加</el-button>
            </template>
          </el-input>
          <el-tag
            v-for="keyword in formData.triggerConditions.keywords"
            :key="keyword"
            closable
            @close="removeKeyword(keyword)"
            style="margin: 5px"
          >
            {{ keyword }}
          </el-tag>
        </el-form-item>

        <!-- 免打扰时段 -->
        <el-divider content-position="left">免打扰时段</el-divider>

        <el-form-item>
          <el-checkbox v-model="enableQuietHours">启用免打扰时段</el-checkbox>
        </el-form-item>

        <el-form-item label="免打扰时段" v-if="enableQuietHours">
          <el-time-picker
            v-model="quietHoursRange"
            is-range
            format="HH:mm"
            value-format="HH:mm"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
          />
        </el-form-item>

        <!-- 操作按钮 -->
        <el-form-item>
          <el-button type="primary" @click="handleSave" :loading="saving">保存配置</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const formRef = ref()
const saving = ref(false)
const phoneInput = ref('')
const emailInput = ref('')
const wechatInput = ref('')
const dingtalkInput = ref('')
const keywordInput = ref('')
const enableQuietHours = ref(false)
const quietHoursRange = ref<[string, string] | null>(null)

const formData = ref({
  alertLevel: 'important',
  enabledChannels: ['sms', 'internal'],
  recipients: {
    phone: [] as string[],
    email: [] as string[],
    wechat: [] as string[],
    dingtalk: [] as string[],
  },
  triggerConditions: {
    readCount: 10000,
    likeCount: 1000,
    sentiment: ['negative'],
    keywords: [] as string[],
  },
  quietHours: null as { start: string; end: string } | null,
})

const rules = {
  alertLevel: [{ required: true, message: '请选择预警等级', trigger: 'change' }],
  enabledChannels: [{ required: true, message: '请至少选择一个通知渠道', trigger: 'change' }],
}

const addPhone = () => {
  if (phoneInput.value && !formData.value.recipients.phone.includes(phoneInput.value)) {
    formData.value.recipients.phone.push(phoneInput.value)
    phoneInput.value = ''
  }
}

const removePhone = (phone: string) => {
  formData.value.recipients.phone = formData.value.recipients.phone.filter(p => p !== phone)
}

const addEmail = () => {
  if (emailInput.value && !formData.value.recipients.email.includes(emailInput.value)) {
    formData.value.recipients.email.push(emailInput.value)
    emailInput.value = ''
  }
}

const removeEmail = (email: string) => {
  formData.value.recipients.email = formData.value.recipients.email.filter(e => e !== email)
}

const addWechat = () => {
  if (wechatInput.value && !formData.value.recipients.wechat.includes(wechatInput.value)) {
    formData.value.recipients.wechat.push(wechatInput.value)
    wechatInput.value = ''
  }
}

const removeWechat = (url: string) => {
  formData.value.recipients.wechat = formData.value.recipients.wechat.filter(u => u !== url)
}

const addDingtalk = () => {
  if (dingtalkInput.value && !formData.value.recipients.dingtalk.includes(dingtalkInput.value)) {
    formData.value.recipients.dingtalk.push(dingtalkInput.value)
    dingtalkInput.value = ''
  }
}

const removeDingtalk = (url: string) => {
  formData.value.recipients.dingtalk = formData.value.recipients.dingtalk.filter(u => u !== url)
}

const addKeyword = () => {
  if (keywordInput.value && !formData.value.triggerConditions.keywords.includes(keywordInput.value)) {
    formData.value.triggerConditions.keywords.push(keywordInput.value)
    keywordInput.value = ''
  }
}

const removeKeyword = (keyword: string) => {
  formData.value.triggerConditions.keywords = formData.value.triggerConditions.keywords.filter(k => k !== keyword)
}

watch(enableQuietHours, (val) => {
  if (val && !quietHoursRange.value) {
    quietHoursRange.value = ['22:00', '08:00']
  }
})

watch(quietHoursRange, (val) => {
  if (val) {
    formData.value.quietHours = { start: val[0], end: val[1] }
  } else {
    formData.value.quietHours = null
  }
})

const fetchConfig = async () => {
  try {
    const res = await request.get('/api/alert/config')
    if (res.data) {
      Object.assign(formData.value, res.data)
      if (res.data.quietHours) {
        enableQuietHours.value = true
        quietHoursRange.value = [res.data.quietHours.start, res.data.quietHours.end]
      }
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取配置失败')
  }
}

const handleSave = async () => {
  try {
    await formRef.value.validate()
    saving.value = true
    await request.put('/api/alert/config', formData.value)
    ElMessage.success('配置已保存')
  } catch (error: any) {
    if (error.message) {
      ElMessage.error(error.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

const handleReset = () => {
  formRef.value.resetFields()
  fetchConfig()
}

onMounted(() => {
  fetchConfig()
})
</script>

<style scoped lang="scss">
.alert-config-container {
  padding: 20px;
}
</style>
```

---

## 二、预警历史页面

### 文件位置
`frontend-admin/src/views/alert-history/index.vue`

### 页面功能

- 预警记录列表
- 筛选（等级、状态）
- 分页查询
- 查看详情
- 确认处理
- 统计图表

### 完整代码

```vue
<template>
  <div class="alert-history-container">
    <el-card>
      <template #header>
        <span>预警历史</span>
      </template>

      <!-- 筛选条件 -->
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

      <!-- 预警记录列表 -->
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

    <!-- 详情对话框 -->
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

    <!-- 确认对话框 -->
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
```

---

## 三、路由配置

### 在 `frontend-admin/src/router/index.ts` 添加：

```typescript
{
  path: 'alert-config',
  component: () => import('@/views/alert-config/index.vue'),
},
{
  path: 'alert-history',
  component: () => import('@/views/alert-history/index.vue'),
},
```

---

## 四、集成步骤

1. **创建页面目录**
```bash
mkdir -p frontend-admin/src/views/alert-config
mkdir -p frontend-admin/src/views/alert-history
```

2. **复制代码**
   - 将上述代码复制到对应文件

3. **配置路由**
   - 添加到 router/index.ts

4. **测试访问**
   - http://localhost:5173/alert-config
   - http://localhost:5173/alert-history

---

## 五、功能验证清单

### 预警配置页
- [ ] 页面正常加载
- [ ] 获取现有配置
- [ ] 预警等级选择
- [ ] 通知渠道多选
- [ ] 接收人添加/删除
- [ ] 触发条件设置
- [ ] 免打扰时段配置
- [ ] 保存配置成功

### 预警历史页
- [ ] 页面正常加载
- [ ] 记录列表展示
- [ ] 等级筛选
- [ ] 状态筛选
- [ ] 分页功能
- [ ] 查看详情
- [ ] 确认处理
- [ ] 处理反馈

---

**文档版本**：v1.0  
**更新日期**：2026-07-23  
**状态**：前端实施指南完成
