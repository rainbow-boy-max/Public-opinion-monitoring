<template>
  <el-card class="change-password-card">
    <h2 class="title">首次登录 - 请修改密码</h2>
    <el-alert type="warning" :closable="false" show-icon>
      为了账号安全，首次登录后必须修改默认密码
    </el-alert>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" style="margin-top: 20px">
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
        <el-button type="primary" :loading="loading" @click="onSubmit">提交</el-button>
      </el-form-item>
    </el-form>
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

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const rules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [{ required: true, min: 6, max: 64, message: '密码长度 6-64 位', trigger: 'blur' }],
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
.change-password-card {
  max-width: 480px;
  margin: 80px auto;
}
.title {
  text-align: center;
  margin-bottom: 20px;
}
</style>
