<template>
  <div class="mfa-settings-page">
    <PageHeader title="MFA 双因素认证" subtitle="增强账号安全性" />

    <el-card class="mfa-card">
      <div class="mfa-status">
        <div class="mfa-status__info">
          <div class="mfa-status__title">TOTP 认证器</div>
          <div class="mfa-status__desc">
            使用 Google Authenticator、Authy 等应用扫描二维码绑定
          </div>
        </div>
        <el-tag :type="mfaEnabled ? 'success' : 'info'" size="large">
          {{ mfaEnabled ? '已启用' : '未启用' }}
        </el-tag>
      </div>

      <el-divider />

      <div v-if="!mfaEnabled && !setupStep">
        <el-button type="primary" size="large" @click="startSetup">
          开始绑定
        </el-button>
      </div>

      <div v-if="setupStep === 1">
        <div class="setup-step">
          <div class="setup-step__title">步骤 1：扫描二维码</div>
          <div class="setup-step__qr">
            <img :src="qrCodeUrl" alt="MFA QR Code" />
          </div>
          <div class="setup-step__secret">
            或手动输入密钥：
            <code>{{ setupData.secret }}</code>
          </div>
          <el-button type="primary" @click="setupStep = 2">下一步</el-button>
        </div>
      </div>

      <div v-if="setupStep === 2">
        <div class="setup-step">
          <div class="setup-step__title">步骤 2：验证并启用</div>
          <div class="setup-step__input">
            <el-input
              v-model="verifyToken"
              placeholder="请输入 6 位验证码"
              maxlength="6"
              style="width: 200px"
            />
            <el-button type="primary" :loading="enabling" @click="enableMfa">
              验证并启用
            </el-button>
          </div>
          <div v-if="backupCodes.length" class="setup-step__backup">
            <el-alert
              title="请保存以下备用码（每个只能使用一次）"
              type="warning"
              :closable="false"
            />
            <div class="backup-codes">
              <code v-for="code in backupCodes" :key="code">{{ code }}</code>
            </div>
          </div>
        </div>
      </div>

      <div v-if="mfaEnabled">
        <el-button type="danger" @click="disableMfa">
          禁用 MFA
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '@/utils/http';
import PageHeader from '@/shared/components/PageHeader.vue';

const mfaEnabled = ref(false);
const setupStep = ref(0);
const setupData = ref({ secret: '', qrUrl: '' });
const verifyToken = ref('');
const backupCodes = ref<string[]>([]);
const enabling = ref(false);

const qrCodeUrl = ref('');

async function loadStatus() {
  try {
    const data = await http.get('/mfa/status') as { enabled: boolean };
    mfaEnabled.value = data.enabled;
  } catch (err) {
    console.error('Failed to load MFA status', err);
  }
}

async function startSetup() {
  try {
    const data = await http.post('/mfa/setup') as {
      secret: string;
      qrUrl: string;
      backupCodes: string[];
    };
    setupData.value = { secret: data.secret, qrUrl: data.qrUrl };
    backupCodes.value = data.backupCodes;
    // 生成二维码 URL（使用 Google Charts API）
    qrCodeUrl.value = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(data.qrUrl)}`;
    setupStep.value = 1;
  } catch (err) {
    ElMessage.error('绑定失败');
  }
}

async function enableMfa() {
  if (!verifyToken.value || verifyToken.value.length !== 6) {
    ElMessage.warning('请输入 6 位验证码');
    return;
  }
  enabling.value = true;
  try {
    const data = await http.post('/mfa/enable', { token: verifyToken.value }) as { success: boolean };
    if (data.success) {
      mfaEnabled.value = true;
      setupStep.value = 0;
      ElMessage.success('MFA 已启用');
    } else {
      ElMessage.error('验证码错误');
    }
  } catch (err) {
    ElMessage.error('验证失败');
  } finally {
    enabling.value = false;
  }
}

async function disableMfa() {
  try {
    await ElMessageBox.confirm(
      '禁用 MFA 会降低账号安全性，确定要禁用吗？',
      '确认禁用',
      { type: 'warning' }
    );
    await http.post('/mfa/disable');
    mfaEnabled.value = false;
    ElMessage.success('MFA 已禁用');
  } catch (err) {
    // User cancelled
  }
}

onMounted(loadStatus);
</script>

<style scoped>
.mfa-settings-page {
  padding: 24px;
}
.mfa-card {
  max-width: 600px;
}
.mfa-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mfa-status__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.mfa-status__desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
}
.setup-step {
  padding: 20px 0;
}
.setup-step__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
}
.setup-step__qr {
  margin: 16px 0;
}
.setup-step__qr img {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 8px;
}
.setup-step__secret {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 12px 0;
}
.setup-step__secret code {
  background: var(--bg-subtle);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
}
.setup-step__input {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 16px 0;
}
.setup-step__backup {
  margin-top: 20px;
}
.backup-codes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;
}
.backup-codes code {
  background: var(--bg-subtle);
  padding: 6px 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  text-align: center;
}
</style>
