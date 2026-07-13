<template>
  <div class="register-page">
    <div class="register-bg" />
    <div class="register-container">
      <GlassCard class="register-card">
        <div class="register-card__brand">
          <h1 class="register-card__title">创建新账号</h1>
          <p class="register-card__sub">完成手机号验证，开启舆情监控之旅</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="3-64 字符" />
          </el-form-item>
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="form.phone" placeholder="11 位手机号" />
          </el-form-item>
          <el-form-item label="验证码" prop="code">
            <div class="code-row">
              <el-input v-model="form.code" maxlength="6" placeholder="6 位验证码" />
              <el-button :disabled="countdown > 0" @click="onSendCode">
                {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" show-password placeholder="6-64 字符" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="large" :loading="loading" @click="onRegister" class="register-submit">
              注册
            </el-button>
            <div class="register-actions">
              <a @click="$router.push('/login')">已有账号，去登录</a>
            </div>
          </el-form-item>
        </el-form>
      </GlassCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { useUserAuthStore } from '@/store/auth';
import GlassCard from '@shared/components/GlassCard.vue';

const router = useRouter();
const auth = useUserAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const countdown = ref(0);
let timer: number | null = null;

const form = reactive({ username: '', phone: '', code: '', password: '' });

const rules = {
  username: [{ required: true, min: 3, max: 64, message: '账号 3-64 字符', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' },
  ],
  code: [{ required: true, len: 6, message: '验证码 6 位', trigger: 'blur' }],
  password: [{ required: true, min: 6, max: 64, message: '密码 6-64 字符', trigger: 'blur' }],
};

async function onSendCode(): Promise<void> {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    ElMessage.warning('请输入正确的手机号');
    return;
  }
  try {
    await auth.sendSms(form.phone, 'register');
    ElMessage.success('验证码已发送');
    countdown.value = 60;
    timer = window.setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0 && timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }, 1000);
  } catch (err: any) {
    ElMessage.error(err?.message || '发送失败');
  }
}

async function onRegister(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      await auth.register({
        username: form.username,
        phone: form.phone,
        code: form.code,
        password: form.password,
      });
      ElMessage.success('注册成功，请完成实名认证');
      router.push('/verify');
    } catch (err: any) {
      ElMessage.error(err?.message || '注册失败');
    } finally {
      loading.value = false;
    }
  });
}

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
}

.register-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 70% 30%, rgba(124, 58, 237, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 30% 70%, rgba(16, 185, 129, 0.1) 0%, transparent 50%);
}

.register-container {
  position: relative;
  width: 100%;
  max-width: 480px;
}

.register-card {
  padding: 8px 8px 8px 8px;
}

.register-card__brand {
  text-align: center;
  margin-bottom: 24px;
}

.register-card__title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, #FFFFFF 0%, #7C8FE8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 6px;
}

.register-card__sub {
  font-size: 13px;
  color: var(--text-tertiary);
}

.code-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.code-row .el-input {
  flex: 1;
}

.register-submit {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 4px;
  background: var(--gradient-primary) !important;
  border: none !important;
  box-shadow: 0 4px 16px rgba(94, 114, 228, 0.4);
}

.register-actions {
  margin-top: 16px;
  text-align: center;
}

.register-actions a {
  color: var(--color-primary-light);
  font-size: 13px;
  cursor: pointer;
}
</style>
