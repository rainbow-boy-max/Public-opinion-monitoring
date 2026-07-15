<template>
  <div class="verify-page">
    <div class="verify-bg" />
    <div class="verify-container">
      <GlassCard class="verify-card">
        <div class="verify-card__brand">
          <div class="verify-card__icon">🛡️</div>
          <h1 class="verify-card__title">手机号三要素实名认证</h1>
          <p class="verify-card__sub">完成认证后即可使用全部功能（监控任务、Webhook、实时大屏等）</p>
        </div>

        <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 20px">
          <template #title>注意</template>
          24 小时内最多认证 3 次，达到上限后锁定 7 天。请确保信息准确无误。
        </el-alert>

        <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
          <el-form-item label="真实姓名" prop="realName">
            <el-input v-model="form.realName" placeholder="您的真实姓名" />
          </el-form-item>
          <el-form-item label="身份证号" prop="idCard">
            <el-input v-model="form.idCard" placeholder="18 位身份证号" maxlength="18" />
          </el-form-item>
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="form.phone" placeholder="注册时使用的手机号" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="large" :loading="loading" @click="onSubmit" class="verify-submit">
              提交认证
            </el-button>
          </el-form-item>
        </el-form>
      </GlassCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import http from '@/utils/http';
import { useUserAuthStore } from '@/store/auth';
import GlassCard from '@shared/components/GlassCard.vue';

const router = useRouter();
const auth = useUserAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({ realName: '', idCard: '', phone: '' });

const rules = {
  realName: [{ required: true, min: 2, max: 64, message: '请输入真实姓名', trigger: 'blur' }],
  idCard: [
    { required: true, message: '请输入身份证号', trigger: 'blur' },
    { pattern: /^[0-9]{17}[0-9X]$/, message: '身份证号格式不正确', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
};

async function onSubmit(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      await http.post('/verify/real-name', form);
      ElMessage.success('认证成功');
      await auth.refreshUser();
      if (auth.user?.authStatus === 'verified') {
        router.push('/dashboard');
      }
    } catch (err: any) {
      ElMessage.error(err?.message || '认证失败');
    } finally {
      loading.value = false;
    }
  });
}

async function loadStatus(): Promise<void> {
  try {
    const res = await http.get('/verify/status');
    if (res.authStatus === 'verified') {
      ElMessage.info('您已完成实名认证');
      router.push('/dashboard');
    }
  } catch {
    // ignore
  }
}

onMounted(loadStatus);
</script>

<style scoped>
.verify-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
}

.verify-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.15) 0%, transparent 40%),
    radial-gradient(circle at 50% 100%, rgba(94, 114, 228, 0.1) 0%, transparent 60%);
}

.verify-container {
  position: relative;
  width: 100%;
  max-width: 540px;
}

.verify-card {
  padding: 8px;
}

.verify-card__brand {
  text-align: center;
  margin-bottom: 24px;
}

.verify-card__icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.verify-card__title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, #FFFFFF 0%, #A78BFA 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 6px;
}

.verify-card__sub {
  font-size: 13px;
  color: var(--text-tertiary);
}

.verify-submit {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 4px;
  background: var(--gradient-primary) !important;
  border: none !important;
  box-shadow: 0 4px 16px rgba(94, 114, 228, 0.4);
}
</style>
