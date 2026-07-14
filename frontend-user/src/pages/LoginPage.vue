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
      ElMessage.success('登录成功 / Login successful');
      router.push('/verify');
    } catch (err: any) {
      // http.ts 拦截器已自动弹窗提示完整错误（含双语文案 + 解决按钮）
      const lang = (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
      errorMessage.value = err?.messageEn
        ? lang === 'en'
          ? err.messageEn
          : err.message
        : err?.message || (lang === 'en' ? 'Login failed' : '登录失败');
    } finally {
      loading.value = false;
    }
  });
}
</script>
