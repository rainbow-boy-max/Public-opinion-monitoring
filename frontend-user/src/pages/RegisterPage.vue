<template>
  <el-card class="auth-card">
    <h2 class="title">用户注册</h2>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="form.phone" />
      </el-form-item>
      <el-form-item label="验证码" prop="code">
        <el-input v-model="form.code" style="max-width: 200px" />
        <el-button
          :disabled="countdown > 0"
          @click="onSendCode"
          style="margin-left: 10px"
        >
          {{ countdown > 0 ? `${countdown}s 后重试` : '获取验证码' }}
        </el-button>
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onRegister">注册</el-button>
        <el-button @click="$router.push('/login')">返回登录</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { useUserAuthStore } from '@/store/auth';

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
.auth-card {
  max-width: 480px;
  margin: 80px auto;
}
.title {
  text-align: center;
  margin-bottom: 24px;
}
</style>
