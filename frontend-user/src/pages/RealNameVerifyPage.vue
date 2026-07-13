<template>
  <el-card class="verify-card">
    <h2 class="title">手机号三要素认证</h2>
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 20px"
    >
      完成认证后即可使用全部功能（监控任务、Webhook、实时大屏等）
    </el-alert>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item label="真实姓名" prop="realName">
        <el-input v-model="form.realName" placeholder="请输入您的真实姓名" />
      </el-form-item>
      <el-form-item label="身份证号" prop="idCard">
        <el-input v-model="form.idCard" placeholder="请输入18位身份证号" maxlength="18" />
      </el-form-item>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="form.phone" placeholder="注册时使用的手机号" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onSubmit">提交认证</el-button>
      </el-form-item>
    </el-form>
    <p class="tips">24 小时内最多认证 3 次，达到上限后锁定 7 天。请确保信息准确无误。</p>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import http from '@/utils/http';
import { useUserAuthStore } from '@/store/auth';

const router = useRouter();
const auth = useUserAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({ realName: '', idCard: '', phone: '' });

const rules = {
  realName: [{ required: true, min: 2, max: 64, message: '请输入真实姓名', trigger: 'blur' }],
  idCard: [
    { required: true, message: '请输入身份证号', trigger: 'blur' },
    { pattern: /^[0-9]{17}[0-9X]$/, message: '身份证号格式不正确', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
};

async function onSubmit(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      await http.post('/verify/real-name', form);
      ElMessage.success('认证成功');
      await auth.refreshUser();
      if (auth.user?.authStatus === 'verified') {
        router.push('/dashboard');
      }
    } catch (err: any) {
      ElMessage.error(err?.message || '认证失败');
    } finally {
      loading.value = false;
    }
  });
}

async function loadStatus(): Promise<void> {
  try {
    const res = await http.get('/verify/status');
    if (res.authStatus === 'verified') {
      router.push('/dashboard');
    }
  } catch {
    // ignore
  }
}

onMounted(loadStatus);
</script>

<style scoped>
.verify-card {
  max-width: 520px;
  margin: 80px auto;
}
.title {
  text-align: center;
  margin-bottom: 20px;
}
.tips {
  color: #909399;
  font-size: 13px;
  margin-top: 20px;
  text-align: center;
}
</style>
