<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>阿里云短信服务配置</span>
        <el-button size="small" @click="loadData">刷新</el-button>
      </div>
    </template>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 20px">
      配置阿里云短信服务 AccessKey 和模板，用于用户登录/注册/通知等场景的短信发送。
    </el-alert>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="140px">
      <el-form-item label="AccessKey ID" prop="accessKey">
        <el-input v-model="form.accessKey" placeholder="阿里云 AccessKey ID" show-password />
      </el-form-item>
      <el-form-item label="AccessKey Secret" prop="secretKey">
        <el-input v-model="form.secretKey" placeholder="阿里云 AccessKey Secret" show-password />
      </el-form-item>
      <el-form-item label="短信签名" prop="signName">
        <el-input v-model="form.signName" placeholder="如：某某科技" />
      </el-form-item>
      <el-form-item label="模板CODE" prop="templateCode">
        <el-input v-model="form.templateCode" placeholder="如：SMS_123456789" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
        <el-button @click="loadData">取消</el-button>
      </el-form-item>
    </el-form>
  </el-card>

  <el-card style="margin-top: 20px">
    <template #header>
      <span>测试短信发送</span>
    </template>
    <el-form :inline="true">
      <el-form-item label="测试手机号">
        <el-input v-model="testPhone" placeholder="请输入手机号" style="width: 240px" />
      </el-form-item>
      <el-form-item>
        <el-button type="success" :loading="testing" @click="onTest">发送测试短信</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import http from '@/utils/http';

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
      ElMessage.success('配置已保存');
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
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
