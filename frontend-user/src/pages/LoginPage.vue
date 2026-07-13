<template>
  <el-card class="auth-card">
    <h2 class="title">用户登录</h2>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="账号" prop="username">
        <el-input v-model="form.username" placeholder="用户名" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          placeholder="密码"
          @keyup.enter="onLogin"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onLogin">登录</el-button>
        <el-button @click="$router.push('/register')">注册</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { useUserAuthStore } from '@/store/auth';

const router = useRouter();
const auth = useUserAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function onLogin(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      await auth.login(form.username, form.password);
      ElMessage.success('登录成功');
      router.push('/verify');
    } catch (err: any) {
      ElMessage.error(err?.message || '登录失败');
    } finally {
      loading.value = false;
    }
  });
}
</script>

<style scoped>
.auth-card {
  max-width: 420px;
  margin: 100px auto;
}
.title {
  text-align: center;
  margin-bottom: 24px;
}
</style>
