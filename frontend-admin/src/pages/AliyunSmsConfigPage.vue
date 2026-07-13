<template>
  <div class="config-page">
    <GlassCard title="阿里云短信服务配置" icon="✉️" subtitle="用户登录/注册/通知等场景的短信发送">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="160px">
        <el-form-item label="AccessKey ID" prop="accessKey">
          <el-input v-model="form.accessKey" show-password placeholder="阿里云 AccessKey ID" />
        </el-form-item>
        <el-form-item label="AccessKey Secret" prop="secretKey">
          <el-input v-model="form.secretKey" show-password placeholder="阿里云 AccessKey Secret" />
        </el-form-item>
        <el-form-item label="短信签名" prop="signName">
          <el-input v-model="form.signName" placeholder="例如 某某科技" />
        </el-form-item>
        <el-form-item label="模板 CODE" prop="templateCode">
          <el-input v-model="form.templateCode" placeholder="例如 SMS_123456789" />
          <div class="form-tip">需在阿里云短信控制台申请含 <code>{code}</code> 变量的验证码模板</div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
          <el-button @click="loadData">取消</el-button>
        </el-form-item>
      </el-form>
    </GlassCard>

    <GlassCard title="测试短信发送" icon="📡" subtitle="验证配置生效（不会插入数据库）">
      <div class="test-row">
        <el-input v-model="testPhone" placeholder="请输入测试手机号" style="width: 280px">
          <template #prefix><span>📱</span></template>
        </el-input>
        <el-button type="success" :loading="testing" @click="onTest">
          发送测试短信
        </el-button>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const formRef = ref<FormInstance>();
const saving = ref(false);
const testing = ref(false);
const testPhone = ref('');

const form = reactive({
  accessKey: '',
  secretKey: '',
  signName: '',
  templateCode: '',
});

const rules = {
  accessKey: [{ required: true, message: '请输入 AccessKey', trigger: 'blur' }],
  secretKey: [{ required: true, message: '请输入 Secret', trigger: 'blur' }],
  signName: [{ required: true, message: '请输入短信签名', trigger: 'blur' }],
  templateCode: [{ required: true, message: '请输入模板 CODE', trigger: 'blur' }],
};

async function loadData(): Promise<void> {
  try {
    const res = await http.get('/admin/config/aliyun-sms');
    if (res) {
      form.signName = res.signName || '';
      form.templateCode = res.templateCode || '';
    }
  } catch (err) {
    console.error(err);
  }
}

async function onSave(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      await http.put('/admin/config/aliyun-sms', form);
      ElMessage.success('配置已加密保存');
      loadData();
    } catch (err: any) {
      ElMessage.error(err?.message || '保存失败');
    } finally {
      saving.value = false;
    }
  });
}

async function onTest(): Promise<void> {
  if (!testPhone.value) {
    ElMessage.warning('请输入手机号');
    return;
  }
  testing.value = true;
  try {
    await http.post('/admin/sms/test', { phone: testPhone.value });
    ElMessage.success('测试短信已发送');
  } catch (err: any) {
    ElMessage.error(err?.message || '发送失败');
  } finally {
    testing.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.config-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.test-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.form-tip code {
  background: rgba(94, 114, 228, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
}
</style>
