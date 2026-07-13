<template>
  <div class="change-password-page">
    <div class="cp-card">
      <div class="cp-header">
        <div class="cp-header__icon">🔐</div>
        <h1 class="cp-header__title">首次登录 - 修改密码</h1>
        <p class="cp-header__sub">为了账号安全，首次登录后必须修改默认密码</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        size="large"
        class="cp-form"
      >
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="form.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" @click="onSubmit" class="cp-submit">
            提交修改
          </el-button>
        </el-form-item>
      </el-form>
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

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const rules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6-64 字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule, value, cb) => {
        if (value !== form.newPassword) cb(new Error('两次输入的密码不一致'));
        else cb();
      },
      trigger: 'blur',
    },
  ],
};

async function onSubmit(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      await auth.changePassword(form.oldPassword, form.newPassword);
      ElMessage.success('密码修改成功');
      router.push('/dashboard');
    } catch (err: any) {
      ElMessage.error(err?.message || '修改失败');
    } finally {
      loading.value = false;
    }
  });
}
</script>

<style scoped>
.change-password-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.cp-card {
  width: 460px;
  max-width: 100%;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur-strong));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 40px 36px;
  box-shadow: 0 24px 60px rgba(0, 5, 30, 0.55);
}

.cp-header {
  text-align: center;
  margin-bottom: 28px;
}

.cp-header__icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.cp-header__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
  background: linear-gradient(135deg, #FFFFFF 0%, #7C8FE8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.cp-header__sub {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

.cp-form :deep(.el-form-item__label) {
  color: var(--text-secondary);
  font-weight: 500;
}

.cp-submit {
  width: 100%;
  margin-top: 8px;
  background: var(--gradient-primary) !important;
  border: none !important;
}
</style>
