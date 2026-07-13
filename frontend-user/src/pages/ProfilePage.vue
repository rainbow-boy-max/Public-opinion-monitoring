<template>
  <GlassCard title="个人中心" icon="👤" subtitle="账号信息与安全">
    <el-descriptions :column="2" border class="profile-desc">
      <el-descriptions-item label="用户名">
        <span class="profile-cell">{{ user?.username }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="认证状态">
        <el-tag :type="user?.authStatus === 'verified' ? 'success' : 'warning'" effect="dark">
          {{ user?.authStatus === 'verified' ? '✓ 已认证' : '⚠ 未认证' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="用户 ID">
        <code class="profile-id">#{{ user?.id }}</code>
      </el-descriptions-item>
      <el-descriptions-item label="账号角色">普通用户</el-descriptions-item>
    </el-descriptions>
  </GlassCard>

  <GlassCard title="修改密码" icon="🔒" subtitle="建议每 90 天更换一次密码">
    <el-form :inline="false" label-width="100px">
      <el-form-item label="原密码">
        <el-input
          v-model="passwords.old"
          type="password"
          show-password
          placeholder="输入原密码"
        />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input
          v-model="passwords.new"
          type="password"
          show-password
          placeholder="输入新密码 (6-64 字符)"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="updating" @click="onChangePassword">
          更新密码
        </el-button>
      </el-form-item>
    </el-form>
  </GlassCard>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';
import { useUserAuthStore } from '@/store/auth';
import GlassCard from '@shared/components/GlassCard.vue';

const auth = useUserAuthStore();
const user = auth.user;
const updating = ref(false);
const passwords = reactive({ old: '', new: '' });

async function onChangePassword(): Promise<void> {
  if (!passwords.old || !passwords.new) {
    ElMessage.warning('请填写完整');
    return;
  }
  if (passwords.new.length < 6) {
    ElMessage.warning('新密码长度至少 6 位');
    return;
  }
  updating.value = true;
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
  } finally {
    updating.value = false;
  }
}
</script>

<style scoped>
.profile-desc {
  margin-bottom: 0;
}

.profile-cell {
  font-weight: 600;
  color: var(--text-primary);
}

.profile-id {
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
