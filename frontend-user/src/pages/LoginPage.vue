<template>
  <div class="login-page">
    <div class="login-bg" />

    <div class="login-container">
      <GlassCard class="login-card">
        <div class="login-card__brand">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <defs>
              <linearGradient id="userLoginGrad" x1="0" y1="0" x2="48" y2="48">
                <stop offset="0%" stop-color="#5E72E4" />
                <stop offset="100%" stop-color="#7C3AED" />
              </linearGradient>
            </defs>
            <rect width="48" height="48" rx="12" fill="url(#userLoginGrad)" />
            <path d="M12 30L21 18L27 24L36 15" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle cx="36" cy="15" r="3" fill="white" />
          </svg>
          <h1 class="login-card__title">舆情监测 · 用户端</h1>
          <p class="login-card__sub">登录账号，开启全网舆情监控</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" @keyup.enter="onLogin">
          <el-form-item prop="username">
            <el-input v-model="form.username" size="large" placeholder="账号">
              <template #prefix><span class="login-prefix">👤</span></template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" size="large" show-password placeholder="密码">
              <template #prefix><span class="login-prefix">🔒</span></template>
            </el-input>
          </el-form-item>

          <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon style="margin-bottom: 16px" />

          <el-button type="primary" size="large" :loading="loading" @click="onLogin" class="login-submit">
            登 录
          </el-button>
          <div class="login-actions">
            <a @click="$router.push('/register')">注册账号</a>
          </div>
        </el-form>
      </GlassCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { useUserAuthStore } from '@/store/auth';
import GlassCard from '@shared/components/GlassCard.vue';

const router = useRouter();
const auth = useUserAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function onLogin(): Promise<void> {
  errorMessage.value = '';
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      await auth.login(form.username, form.password);
      ElMessage.success('登录成功');
      router.push('/verify');
    } catch (err: any) {
      errorMessage.value = err?.message || '登录失败';
      ElMessage.error(errorMessage.value);
    } finally {
      loading.value = false;
    }
  });
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
}

.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 30%, rgba(94, 114, 228, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 70% 70%, rgba(124, 58, 237, 0.15) 0%, transparent 50%);
  pointer-events: none;
}

.login-container {
  position: relative;
  width: 100%;
  max-width: 440px;
}

.login-card {
  padding: 12px;
}

.login-card__brand {
  text-align: center;
  margin-bottom: 28px;
}

.login-card__brand svg {
  filter: drop-shadow(0 8px 20px rgba(94, 114, 228, 0.4));
  margin-bottom: 16px;
}

.login-card__title {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #FFFFFF 0%, #7C8FE8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 6px;
}

.login-card__sub {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

.login-prefix {
  margin-right: 6px;
  opacity: 0.7;
  font-size: 16px;
}

.login-submit {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 4px;
  background: var(--gradient-primary) !important;
  border: none !important;
  box-shadow: 0 4px 16px rgba(94, 114, 228, 0.4);
}

.login-actions {
  margin-top: 16px;
  text-align: center;
}

.login-actions a {
  color: var(--color-primary-light);
  cursor: pointer;
  text-decoration: none;
  font-size: 13px;
}

.login-actions a:hover {
  text-decoration: underline;
}
</style>
