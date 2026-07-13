<template>
  <el-card>
    <template #header>个人中心</template>
    <el-descriptions :column="2" border>
      <el-descriptions-item label="用户名">{{ user?.username }}</el-descriptions-item>
      <el-descriptions-item label="认证状态">
        <el-tag :type="auth.user?.authStatus === 'verified' ? 'success' : 'warning'">
          {{ auth.user?.authStatus === 'verified' ? '已认证' : '未认证' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="手机号">{{ phone }}</el-descriptions-item>
      <el-descriptions-item label="用户ID">{{ user?.id }}</el-descriptions-item>
    </el-descriptions>
    <el-divider />
    <el-form :inline="true">
      <el-form-item label="修改密码">
        <el-input v-model="passwords.old" type="password" show-password placeholder="原密码" style="width: 200px" />
      </el-form-item>
      <el-form-item>
        <el-input v-model="passwords.new" type="password" show-password placeholder="新密码" style="width: 200px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onChangePassword">提交</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';
import { useUserAuthStore } from '@/store/auth';

const auth = useUserAuthStore();
const user = auth.user;
const phone = ref('-');
const passwords = reactive({ old: '', new: '' });

async function onChangePassword(): Promise<void> {
  if (!passwords.old || !passwords.new) {
    ElMessage.warning('请填写完整');
    return;
  }
  try {
    await http.post('/auth/change-password', {
      oldPassword: passwords.old,
      newPassword: passwords.new,
    });
    ElMessage.success('密码修改成功');
    passwords.old = '';
    passwords.new = '';
  } catch (err: any) {
    ElMessage.error(err?.message || '修改失败');
  }
}
</script>
