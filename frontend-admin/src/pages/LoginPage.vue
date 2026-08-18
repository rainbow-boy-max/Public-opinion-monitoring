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
              name="username"
              autocomplete="off"
              @focus="errorMessage = ''"
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
              name="password"
              show-password
              autocomplete="off"
              @focus="errorMessage = ''"
            >
              <template #prefix>
                <span class="login-input-icon">🔒</span>
              </template>
            </el-input>
          </el-form-item>

          <!-- 阿里云验证码 2.0 -->
          <div v-if="captchaEnabled" id="captcha-element" class="captcha-wrapper"></div>

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
          <code>Admin@123456</code>
        </div>
      </div>
    </div>

    <!-- P1-14: MFA 验证对话框 -->
    <el-dialog
      v-model="mfaDialogVisible"
      title="MFA 双因素认证"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="mfa-dialog-content">
        <p>请输入您的 MFA 验证码（6 位数字）</p>
        <el-input
          v-model="mfaToken"
          placeholder="000000"
          maxlength="6"
          size="large"
          style="margin-top: 16px"
          @keyup.enter="onMfaVerify"
        />
      </div>
      <template #footer>
        <el-button @click="mfaDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="mfaLoading" @click="onMfaVerify">
          验证
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useAdminAuthStore } from '@/store/auth';
import http from '@/utils/http';

const router = useRouter();
const auth = useAdminAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const errorMessage = ref('');
const captchaEnabled = ref(false);
const captchaVerifyParam = ref('');
let captchaInstance: any = null;

// P1-14: MFA 验证相关
const mfaDialogVisible = ref(false);
const mfaUserId = ref(0);
const mfaToken = ref('');
const mfaLoading = ref(false);

const form = reactive({ username: '', password: '' });

const rules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'change' },
    { min: 3, max: 64, message: '账号长度 3-64 字符', trigger: 'change' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'change' },
    { min: 6, max: 64, message: '密码长度 6-64 字符', trigger: 'change' },
  ],
};

async function loadCaptchaConfig(): Promise<void> {
  try {
    const cfg = await http.get('/captcha/config') as any;
    if (cfg.isEnabled && cfg.prefix && cfg.sceneId) {
      captchaEnabled.value = true;
      initAliyunCaptchaSDK(cfg);
    }
  } catch {
    // captcha 不可用时不阻塞登录
  }
}

function initAliyunCaptchaSDK(cfg: any): void {
  setWindowAliyunCaptchaConfig(cfg);
  loadAliyunCaptchaScript(cfg);
}

function setWindowAliyunCaptchaConfig(cfg: any): void {
  (window as any).AliyunCaptchaConfig = {
    region: cfg.region || 'cn',
    prefix: cfg.prefix,
  };
}

function loadAliyunCaptchaScript(cfg: any): void {
  if ((window as any).initAliyunCaptcha) {
    initCaptcha(cfg);
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
  script.onload = () => {
    setTimeout(() => initCaptcha(cfg), 500);
  };
  document.head.appendChild(script);
}

function initCaptcha(cfg: any): void {
  if ((window as any).initAliyunCaptcha) {
    (window as any).initAliyunCaptcha({
      SceneId: cfg.sceneId,
      mode: 'popup',
      element: '#captcha-element',
      button: '#captcha-element',
      slideStyle: { width: 320, height: 40 },
      language: 'cn',
      success: function (param: string) {
        captchaVerifyParam.value = param;
      },
      fail: function (err: any) {
        console.error('Captcha fail:', err);
      },
      getInstance: function (instance: any) {
        captchaInstance = instance;
      },
    });
  }
}

async function onLogin(): Promise<void> {
  errorMessage.value = '';
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    if (captchaEnabled.value && !captchaVerifyParam.value) {
      captchaInstance?.show();
      captchaInstance?.startTracelessVerification();
      return;
    }

    if (captchaEnabled.value && captchaVerifyParam.value) {
      const verifyResult = await http.post('/captcha/verify', {
        captchaVerifyParam: captchaVerifyParam.value,
      }) as any;
      if (!verifyResult.success) {
        errorMessage.value = '验证码验证失败，请重试';
        captchaVerifyParam.value = '';
        captchaInstance?.show();
        return;
      }
    }

    loading.value = true;
    try {
      const result = await auth.login(form.username, form.password);
      
      // P1-14: 处理 MFA 验证
      if (result.mfaRequired) {
        loading.value = false;
        mfaUserId.value = result.user.id;
        mfaDialogVisible.value = true;
        return;
      }
      
      if (result.passwordChangeRequired) {
        await ElMessageBox.alert(
          '检测到您使用的是初始密码，为保障账号安全，请立即修改密码。',
          '强制改密',
          {
            confirmButtonText: '立即修改',
            showClose: false,
            closeOnClickModal: false,
            closeOnPressEscape: false,
            type: 'warning',
          }
        );
        localStorage.setItem('forceChangePassword', '1');
        router.push('/change-password?force=1');
      } else {
        ElMessage.success('登录成功 / Login successful');
        router.push('/dashboard');
      }
    } catch (err: any) {
      errorMessage.value = err?.message || '登录失败';
      captchaVerifyParam.value = '';
    } finally {
      loading.value = false;
    }
  });
}

async function onMfaVerify(): Promise<void> {
  if (!mfaToken.value || mfaToken.value.length !== 6) {
    ElMessage.warning('请输入 6 位验证码');
    return;
  }
  mfaLoading.value = true;
  try {
    const result = await http.post('/auth/verify-mfa', {
      userId: mfaUserId.value,
      token: mfaToken.value,
    }) as any;
    if (result.token) {
      ElMessage.success('登录成功');
      router.push('/dashboard');
    } else {
      ElMessage.error('验证码错误');
    }
  } catch (err: any) {
    ElMessage.error(err?.message || '验证失败');
  } finally {
    mfaLoading.value = false;
  }
}

onMounted(loadCaptchaConfig);
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

@media (max-width: 767px) {
  .login-page {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
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

.captcha-wrapper {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.mfa-dialog-content p {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 14px;
}

/* 防止移动端浏览器自动填充干扰输入 */
.login-form :deep(.el-input__wrapper) {
  transition: none !important;
}

.login-form :deep(.el-input__inner) {
  transition: none !important;
}

/* 移动端优化：防止键盘弹起时布局错乱 */
@media (max-width: 767px) {
  .login-form :deep(.el-input__wrapper) {
    min-height: 44px;
  }
  
  .login-form :deep(.el-input__inner) {
    font-size: 16px !important; /* 防止 iOS Safari 自动缩放 */
  }
}

@media (max-width: 900px) {
  .login-container {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .login-brand__features {
    display: none;
  }
  .login-brand {
    display: none;
  }
}

@media (max-width: 767px) {
  .login-container {
    gap: 16px;
  }
  .login-form {
    padding: 24px 16px;
  }
}
</style>
