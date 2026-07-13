<template>
  <el-card class="login-card">
    <h2 class="title">舆情监测系统 - 管理端登录</h2>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="账号" prop="username">
        <el-input v-model="form.username" placeholder="请输入账号" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          placeholder="请输入密码"
          @keyup.enter="onLogin"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onLogin">登录</el-button>
      </el-form-item>
    </el-form>
    <div v-if="lockedMessage" class="error">{{ lockedMessage }}</div>
  </el-card>
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
const lockedMessage = ref('');

const form = reactive({ username: '', password: '' });

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function onLogin(): Promise<void> {
  lockedMessage.value = '';
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      const result = await auth.login(form.username, form.password);
      if (result.passwordChangeRequired) {
        ElMessage.warning('首次登录需要修改密码');
        router.push('/change-password');
      } else {
        ElMessage.success('登录成功');
        router.push('/dashboard');
      }
    } catch (err: any) {
      lockedMessage.value = err?.message || '登录失败';
      ElMessage.error(lockedMessage.value);
    } finally {
      loading.value = false;
    }
  });
}
</script>

<style scoped>
.login-card {
  max-width: 420px;
  margin: 100px auto;
}
.title {
  text-align: center;
  margin-bottom: 24px;
  color: #303133;
}
.error {
  color: #f56c6c;
  font-size: 14px;
  text-align: center;
}
</style>
