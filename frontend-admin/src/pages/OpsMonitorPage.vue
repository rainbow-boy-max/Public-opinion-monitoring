<template>
  <div class="ops-monitor-page">
    <div class="ops-header">
      <div>
        <h2 class="ops-title">系统健康监控</h2>
        <p class="ops-subtitle">实时监控所有功能模块的运行状态</p>
      </div>
      <div class="ops-actions">
        <el-button type="primary" :loading="checking" @click="onCheckAll">
          <el-icon style="margin-right: 4px"><Refresh /></el-icon>
          一键检测
        </el-button>
        <el-button type="success" :loading="fixing" @click="onFixAll">
          <el-icon style="margin-right: 4px"><Tools /></el-icon>
          一键修复
        </el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="6" v-for="item in healthChecks" :key="item.module" :xs="12" :sm="12" :md="8" :lg="6">
        <div class="health-card" :class="`health-card--${item.status}`">
          <div class="health-card__top">
            <span class="health-dot" :class="`health-dot--${item.status}`"></span>
            <span class="health-card__name">{{ item.name }}</span>
            <span class="health-card__latency">{{ item.latency }}ms</span>
          </div>
          <div class="health-card__status">{{ statusText(item.status) }}</div>
          <div v-if="item.error" class="health-card__error">{{ item.error }}</div>
          <div class="health-card__checks">
            <div v-for="(val, key) in item.checks" :key="key" class="health-card__check">
              <span>{{ key }}:</span>
              <span>{{ val }}</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-divider />

    <div class="ops-header">
      <div>
        <h2 class="ops-title">功能开关管理</h2>
        <p class="ops-subtitle">开启或关闭系统的功能模块</p>
      </div>
      <div class="ops-actions">
        <el-button type="warning" :loading="togglingAll" @click="onToggleAll(true)">
          一键开启全部
        </el-button>
        <el-button type="danger" :loading="togglingAll" @click="onToggleAll(false)">
          一键关闭全部
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="toggleError"
      :title="toggleError"
      type="error"
      :closable="true"
      show-icon
      style="margin-bottom: 16px"
    />

    <el-row :gutter="16">
      <el-col :span="8" v-for="flag in flags" :key="flag.key" :xs="24" :sm="12" :md="8" :lg="6">
        <div class="flag-card" :class="{ 'flag-card--disabled': !flag.isEnabled }">
          <div class="flag-card__info">
            <div class="flag-card__name">{{ flag.name }}</div>
            <div class="flag-card__key">{{ flag.key }}</div>
            <div v-if="flag.description" class="flag-card__desc">{{ flag.description }}</div>
          </div>
          <el-switch
            v-model="flag.isEnabled"
            @change="(val: boolean) => onToggleFlag(flag, val)"
          />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Tools } from '@element-plus/icons-vue';
import http from '@/utils/http';

interface ModuleHealth {
  module: string;
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latency: number;
  error?: string;
  checks: Record<string, string | number | boolean>;
}

interface FeatureFlag {
  id: number;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  menuPath: string | null;
  sort: number;
  category: string | null;
}

const healthChecks = ref<ModuleHealth[]>([]);
const flags = ref<FeatureFlag[]>([]);
const checking = ref(false);
const fixing = ref(false);
const togglingAll = ref(false);
const toggleError = ref('');

function statusText(s: string): string {
  return s === 'ok' ? '运行正常' : s === 'degraded' ? '性能降级' : '服务异常';
}

async function onCheckAll(): Promise<void> {
  checking.value = true;
  try {
    const data = await http.get('/ops-monitor/check-all') as ModuleHealth[];
    healthChecks.value = data;
    ElMessage.success('检测完成');
  } catch (err) {
    ElMessage.error('检测失败');
  } finally {
    checking.value = false;
  }
}

async function onFixAll(): Promise<void> {
  fixing.value = true;
  try {
    const results = await http.post('/ops-monitor/fix-all') as any[];
    const failed = results.filter((r) => !r.success);
    if (failed.length === 0) {
      ElMessage.success('所有异常模块已修复');
    } else {
      ElMessage.warning(`${failed.length} 个模块修复失败`);
    }
    await onCheckAll();
  } catch (err) {
    ElMessage.error('修复失败');
  } finally {
    fixing.value = false;
  }
}

async function loadFlags(): Promise<void> {
  try {
    const data = await http.get('/feature-flags') as FeatureFlag[];
    flags.value = data;
  } catch (err) {
    console.error('Failed to load flags', err);
  }
}

async function onToggleFlag(flag: FeatureFlag, val: boolean): Promise<void> {
  toggleError.value = '';
  try {
    flag.isEnabled = val;
    await http.post('/feature-flags/set', { key: flag.key, enabled: val });
    ElMessage.success(`${flag.name} ${val ? '已开启' : '已关闭'}`);
  } catch (err: any) {
    flag.isEnabled = !val;
    toggleError.value = `操作 ${flag.name} 失败: ${err?.message || '未知错误'}`;
    ElMessage.error('操作失败');
  }
}

async function onToggleAll(enabled: boolean): Promise<void> {
  togglingAll.value = true;
  toggleError.value = '';
  try {
    const payload = flags.value.map((f) => ({ key: f.key, enabled }));
    await http.post('/feature-flags/set-many', { flags: payload });
    flags.value.forEach((f) => { f.isEnabled = enabled; });
    ElMessage.success(enabled ? '已开启全部功能' : '已关闭全部功能');
  } catch (err: any) {
    toggleError.value = `操作失败: ${err?.message || '未知错误'}`;
    ElMessage.error('操作失败');
  } finally {
    togglingAll.value = false;
  }
}

onMounted(() => {
  onCheckAll();
  loadFlags();
});
</script>

<style scoped>
.ops-monitor-page {
  padding: 24px;
}
.ops-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.ops-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}
.ops-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}
.ops-actions {
  display: flex;
  gap: 8px;
}
.health-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 16px;
  transition: all 0.3s;
}
.health-card--ok { border-left: 4px solid #10B981; }
.health-card--degraded { border-left: 4px solid #F59E0B; }
.health-card--down { border-left: 4px solid #EF4444; }
.health-card__top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.health-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.health-dot--ok { background: #10B981; box-shadow: 0 0 8px #10B981; }
.health-dot--degraded { background: #F59E0B; box-shadow: 0 0 8px #F59E0B; }
.health-dot--down { background: #EF4444; box-shadow: 0 0 8px #EF4444; }
.health-card__name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.health-card__latency {
  font-size: 12px;
  color: var(--text-tertiary);
}
.health-card__status {
  font-size: 13px;
  margin-bottom: 8px;
}
.health-card--ok .health-card__status { color: #10B981; }
.health-card--degraded .health-card__status { color: #F59E0B; }
.health-card--down .health-card__status { color: #EF4444; }
.health-card__error {
  font-size: 12px;
  color: #EF4444;
  margin-bottom: 8px;
  word-break: break-all;
}
.health-card__checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.health-card__check {
  display: flex;
  gap: 4px;
}
.flag-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s;
}
.flag-card--disabled {
  opacity: 0.6;
}
.flag-card__info {
  flex: 1;
  margin-right: 12px;
}
.flag-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.flag-card__key {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: monospace;
  margin-top: 2px;
}
.flag-card__desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
</style>