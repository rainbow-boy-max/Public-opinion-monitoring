<template>
  <div class="alert-config-container">
    <el-card>
      <template #header>
        <span>预警配置</span>
      </template>

      <el-form :model="formData" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="预警等级" prop="alertLevel">
          <el-select v-model="formData.alertLevel" placeholder="选择预警等级">
            <el-option label="一般（24h 汇总）" value="normal" />
            <el-option label="重要（4h 内推送）" value="important" />
            <el-option label="重大（1h 内推送）" value="major" />
            <el-option label="特级（15min 内推送）" value="critical" />
          </el-select>
        </el-form-item>

        <el-form-item label="通知渠道" prop="enabledChannels">
          <el-checkbox-group v-model="formData.enabledChannels">
            <el-checkbox label="sms">短信</el-checkbox>
            <el-checkbox label="email">邮件</el-checkbox>
            <el-checkbox label="wechat">企业微信</el-checkbox>
            <el-checkbox label="dingtalk">钉钉</el-checkbox>
            <el-checkbox label="internal">站内消息</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

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
