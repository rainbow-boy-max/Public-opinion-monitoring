<template>
  <div class="login-page">
    <div class="login-bg" />

    <div class="login-container">
      <!-- 左侧品牌区 -->
      <div class="login-brand">
        <div class="login-brand__logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <defs>
              <linearGradient id="loginLogoGrad" x1="0" y1="0" x2="48" y2="48">
                <stop offset="0%" stop-color="#5E72E4" />
                <stop offset="100%" stop-color="#7C3AED" />
              </linearGradient>
            </defs>
            <rect width="48" height="48" rx="12" fill="url(#loginLogoGrad)" />
            <path d="M12 30L21 18L27 24L36 15" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle cx="36" cy="15" r="3" fill="white" />
          </svg>
        </div>
        <h1 class="login-brand__title">舆情监测系统</h1>
        <p class="login-brand__sub">实时感知 全网洞察 智能预警</p>

        <div class="login-brand__features">
          <div class="brand-feature">
            <span class="brand-feature__icon">⚡</span>
            <div>
              <div class="brand-feature__title">实时监测</div>
              <div class="brand-feature__sub">端到端延迟 &lt; 3 秒</div>
            </div>
          </div>
          <div class="brand-feature">
            <span class="brand-feature__icon">🌐</span>
            <div>
              <div class="brand-feature__title">7 大平台覆盖</div>
              <div class="brand-feature__sub">微博/微信/抖音/小红书…</div>
            </div>
          </div>
          <div class="brand-feature">
            <span class="brand-feature__icon">🔔</span>
            <div>
              <div class="brand-feature__title">Webhook + 短信告警</div>
              <div class="brand-feature__sub">企业微信/钉钉/飞书</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="login-form-card">
        <h2 class="login-form__title">管理端登录</h2>
        <p class="login-form__sub">使用管理员账号登录系统</p>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          @keyup.enter="onLogin"
          class="login-form"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入账号"
              size="large"
              clearable
              autocomplete="username"
            >
              <template #prefix>
                <span class="login-input-icon">👤</span>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              show-password
              autocomplete="current-password"
            >
              <template #prefix>
                <span class="login-input-icon">🔒</span>
              </template>
            </el-input>
          </el-form-item>

          <el-alert
            v-if="errorMessage"
            :title="errorMessage"
            type="error"
            :closable="false"
            show-icon
            style="margin-bottom: 16px"
          />

          <el-button
            type="primary"
            size="large"
            :loading="loading"
            @click="onLogin"
            class="login-submit"
          >
            登 录
          </el-button>
        </el-form>

        <div class="login-form__hint">
          <span>默认账号 </span>
          <code>admin</code>
          <span> 密码 </span>
          <code>123456</code>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { useAdminAuthStore } from '@/store/auth';

const router = useRouter();
const auth = useAdminAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({ username: '', password: '' });

const rules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 3, max: 64, message: '账号长度 3-64 字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6-64 字符', trigger: 'blur' },
  ],
};

async function onLogin(): Promise<void> {
  errorMessage.value = '';
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      const result = await auth.login(form.username, form.password);
      if (result.passwordChangeRequired) {
        ElMessage.warning({
          message: '首次登录需要修改默认密码 / First login requires password change',
          duration: 5000,
        });
        router.push('/change-password');
      } else {
        ElMessage.success('登录成功 / Login successful');
        router.push('/dashboard');
      }
    } catch (err: any) {
      // http.ts 拦截器已自动弹窗提示完整错误（含双语文案 + 解决按钮）
      // 这里只在表单内显示一条精简双语提示
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

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(94, 114, 228, 0.18) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(124, 58, 237, 0.18) 0%, transparent 40%),
    radial-gradient(circle at 50% 100%, rgba(16, 185, 129, 0.08) 0%, transparent 60%);
  pointer-events: none;
}

.login-container {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  max-width: 1100px;
  width: 100%;
  align-items: center;
}

.login-brand {
  animation: slide-in-left 500ms ease-out both;
}

@keyframes slide-in-left {
  from { opacity: 0; transform: translateX(-40px); }
  to { opacity: 1; transform: translateX(0); }
}

.login-brand__logo {
  margin-bottom: 24px;
  filter: drop-shadow(0 8px 24px rgba(94, 114, 228, 0.4));
}

.login-brand__title {
  font-size: 36px;
  font-weight: 800;
  background: linear-gradient(135deg, #FFFFFF 0%, #7C8FE8 50%, #A78BFA 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 12px;
  letter-spacing: -0.5px;
}

.login-brand__sub {
  font-size: 16px;
  color: var(--text-tertiary);
  margin: 0 0 40px;
}

.login-brand__features {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.brand-feature {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.brand-feature:hover {
  transform: translateX(6px);
  border-color: var(--color-primary);
}

.brand-feature__icon {
  font-size: 22px;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(94, 114, 228, 0.3);
}

.brand-feature__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.brand-feature__sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

.login-form-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur-strong));
  -webkit-backdrop-filter: blur(var(--glass-blur-strong));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 48px 40px;
  box-shadow: 0 24px 60px rgba(0, 5, 30, 0.55);
  animation: slide-in-right 500ms ease-out both;
}

@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}

.login-form__title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.login-form__sub {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0 0 32px;
}

.login-form {
  margin-bottom: 16px;
}

.login-input-icon {
  font-size: 16px;
  margin-right: 6px;
  opacity: 0.7;
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
  transition: all var(--transition-fast);
}

.login-submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(94, 114, 228, 0.55);
}

.login-form__hint {
  margin-top: 20px;
  padding: 12px 16px;
  background: rgba(94, 114, 228, 0.08);
  border: 1px dashed rgba(94, 114, 228, 0.3);
  border-radius: var(--radius-sm);
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

.login-form__hint code {
  background: rgba(94, 114, 228, 0.15);
  color: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  margin: 0 2px;
}

@media (max-width: 900px) {
  .login-container {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .login-brand__features {
    display: none;
  }
}
</style>
