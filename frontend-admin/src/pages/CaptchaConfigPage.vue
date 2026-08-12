<template>
  <div class="captcha-config-page">
    <PageHeader title="阿里云验证码配置" description="配置阿里云验证码2.0，增强登录和注册安全性" />

    <div class="captcha-config-card">
      <el-form :model="form" label-width="160px" label-position="left" class="captcha-form">
        <el-form-item label="开启验证码">
          <el-switch v-model="form.isEnabled" active-text="开启" inactive-text="关闭" />
        </el-form-item>

        <el-divider content-position="left">基础配置</el-divider>

        <el-form-item label="所属区域">
          <el-select v-model="form.region" style="width: 300px">
            <el-option label="中国内地 (cn)" value="cn" />
            <el-option label="新加坡 (sgp)" value="sgp" />
          </el-select>
        </el-form-item>

        <el-form-item label="身份标 (prefix)">
          <el-input v-model="form.prefix" placeholder="在控制台概览页获取" style="width: 300px" />
        </el-form-item>

        <el-form-item label="场景 ID (SceneId)">
          <el-input v-model="form.sceneId" placeholder="新建验证场景后获取" style="width: 300px" />
        </el-form-item>

        <el-divider content-position="left">API 密钥（服务端验签）</el-divider>

        <el-form-item label="AccessKey ID">
          <el-input v-model="form.accessKeyId" placeholder="RAM 用户 AccessKey ID" style="width: 400px" />
        </el-form-item>

        <el-form-item label="AccessKey Secret">
          <el-input v-model="form.accessKeySecret" type="password" show-password placeholder="RAM 用户 AccessKey Secret" style="width: 400px" />
        </el-form-item>

        <el-form-item label="Endpoint">
          <el-input v-model="form.endpoint" placeholder="captcha.cn-shanghai.aliyuncs.com" style="width: 300px" />
        </el-form-item>

        <el-divider />

        <el-form-item>
          <el-button type="primary" size="large" @click="onSave" :loading="saving">保存配置</el-button>
          <el-button size="large" @click="onTest">测试验证码</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';
import PageHeader from '@/shared/components/PageHeader.vue';

interface CaptchaConfig {
  isEnabled: boolean;
  region: string;
  prefix: string;
  sceneId: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
}

const form = reactive<CaptchaConfig>({
  isEnabled: false,
  region: 'cn',
  prefix: '',
  sceneId: '',
  accessKeyId: '',
  accessKeySecret: '',
  endpoint: 'captcha.cn-shanghai.aliyuncs.com',
});

const saving = ref(false);

async function loadConfig(): Promise<void> {
  try {
    const data = await http.get('/captcha/admin/config') as CaptchaConfig;
    Object.assign(form, data);
  } catch (err) {
    console.error('Failed to load captcha config', err);
  }
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    await http.put('/captcha/config', form);
    ElMessage.success('验证码配置已保存');
  } catch (err) {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

async function onTest(): Promise<void> {
  if (!form.isEnabled) {
    ElMessage.warning('请先开启验证码');
    return;
  }
  ElMessage.info('验证码测试需要在登录页面实际验证，保存后刷新登录页即可看到效果');
}

onMounted(loadConfig);
</script>

<style scoped>
.captcha-config-page {
  padding: 24px;
}
.captcha-config-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 32px;
  max-width: 720px;
  margin-top: 24px;
}
.captcha-form :deep(.el-form-item__label) {
  color: var(--text-primary);
  font-weight: 500;
}
</style>