<template>
  <div class="hot-topics-config-page">
    <PageHeader title="热点话题配置" subtitle="平台数据源选择与刷新策略" />

    <el-form label-width="140px" class="config-form">
      <el-form-item label="数据源选择">
        <el-checkbox-group v-model="selectedPlatforms">
          <el-checkbox v-for="p in allPlatforms" :key="p.key" :label="p.key" border>
            {{ p.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>

      <el-form-item label="自动刷新">
        <el-switch v-model="autoRefresh" />
      </el-form-item>

      <el-form-item v-if="autoRefresh" label="刷新间隔">
        <el-select v-model="refreshInterval" style="width: 200px">
          <el-option label="30 秒" :value="30" />
          <el-option label="60 秒" :value="60" />
          <el-option label="5 分钟" :value="300" />
        </el-select>
      </el-form-item>

      <el-form-item label="缓存时间">
        <el-select v-model="cacheTime" style="width: 200px">
          <el-option label="1 分钟" :value="60" />
          <el-option label="5 分钟" :value="300" />
          <el-option label="15 分钟" :value="900" />
        </el-select>
      </el-form-item>

      <el-form-item label="话题过滤">
        <div class="filter-section">
          <div class="filter-group">
            <label class="filter-label">白名单关键词</label>
            <el-tag
              v-for="(tag, idx) in whitelist"
              :key="'w-' + idx"
              closable
              @close="removeWhitelist(idx)"
              style="margin: 2px"
            >{{ tag }}</el-tag>
            <el-input
              v-model="whitelistInput"
              size="small"
              placeholder="输入关键词后按回车"
              style="width: 200px"
              @keyup.enter="addWhitelist"
            />
          </div>
          <div class="filter-group">
            <label class="filter-label">黑名单关键词</label>
            <el-tag
              v-for="(tag, idx) in blacklist"
              :key="'b-' + idx"
              closable
              type="danger"
              @close="removeBlacklist(idx)"
              style="margin: 2px"
            >{{ tag }}</el-tag>
            <el-input
              v-model="blacklistInput"
              size="small"
              placeholder="输入关键词后按回车"
              style="width: 200px"
              @keyup.enter="addBlacklist"
            />
          </div>
        </div>
      </el-form-item>

      <el-form-item label="接入状态">
        <div class="status-section">
          <el-tag v-if="apiReachable" type="success" effect="dark" size="large">
            <el-icon style="margin-right: 4px"><CircleCheck /></el-icon> 接入正常
          </el-tag>
          <el-tag v-else type="warning" effect="dark" size="large">
            <el-icon style="margin-right: 4px"><Warning /></el-icon> 降级到模拟数据
          </el-tag>
          <el-button size="small" :loading="checkingStatus" @click="checkApiStatus">测试连接</el-button>
        </div>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="saveConfig">保存配置</el-button>
        <el-button @click="resetConfig">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'HotTopicsConfigPage' });

import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { CircleCheck, Warning } from '@element-plus/icons-vue';
import http from '@/utils/http';
import PageHeader from '@shared/components/PageHeader.vue';

interface PlatformOption {
  key: string;
  label: string;
}

const allPlatforms: PlatformOption[] = [
  { key: 'weibo', label: '微博热搜' },
  { key: 'zhihu', label: '知乎热榜' },
  { key: 'baidu', label: '百度热搜' },
  { key: 'douyin', label: '抖音热点' },
  { key: 'bili', label: 'B站热门' },
  { key: 'toutiao', label: '今日头条' },
  { key: 'hupu', label: '虎扑热榜' },
  { key: '36kr', label: '36氪热榜' },
  { key: 'github', label: 'GitHub' },
];

const selectedPlatforms = ref(allPlatforms.map(p => p.key));
const autoRefresh = ref(true);
const refreshInterval = ref(60);
const cacheTime = ref(300);
const whitelist = ref<string[]>([]);
const blacklist = ref<string[]>([]);
const whitelistInput = ref('');
const blacklistInput = ref('');
const apiReachable = ref(true);
const checkingStatus = ref(false);

function addWhitelist(): void {
  const val = whitelistInput.value.trim();
  if (val && !whitelist.value.includes(val)) {
    whitelist.value.push(val);
  }
  whitelistInput.value = '';
}

function removeWhitelist(idx: number): void {
  whitelist.value.splice(idx, 1);
}

function addBlacklist(): void {
  const val = blacklistInput.value.trim();
  if (val && !blacklist.value.includes(val)) {
    blacklist.value.push(val);
  }
  blacklistInput.value = '';
}

function removeBlacklist(idx: number): void {
  blacklist.value.splice(idx, 1);
}

async function checkApiStatus(): Promise<void> {
  checkingStatus.value = true;
  try {
    await http.get('/hot-topics/platform', { timeout: 5000 });
    apiReachable.value = true;
    ElMessage.success('API 连接正常');
  } catch {
    apiReachable.value = false;
    ElMessage.warning('API 不可用，将使用模拟数据');
  } finally {
    checkingStatus.value = false;
  }
}

function saveConfig(): void {
  const config = {
    platforms: selectedPlatforms.value,
    autoRefresh: autoRefresh.value,
    refreshInterval: refreshInterval.value,
    cacheTime: cacheTime.value,
    whitelist: whitelist.value,
    blacklist: blacklist.value,
  };
  localStorage.setItem('hot_topics_config', JSON.stringify(config));
  ElMessage.success('配置已保存');
}

function resetConfig(): void {
  selectedPlatforms.value = allPlatforms.map(p => p.key);
  autoRefresh.value = true;
  refreshInterval.value = 60;
  cacheTime.value = 300;
  whitelist.value = [];
  blacklist.value = [];
  localStorage.removeItem('hot_topics_config');
  ElMessage.success('已重置');
}

function loadConfig(): void {
  try {
    const saved = localStorage.getItem('hot_topics_config');
    if (saved) {
      const config = JSON.parse(saved);
      selectedPlatforms.value = config.platforms || allPlatforms.map(p => p.key);
      autoRefresh.value = config.autoRefresh ?? true;
      refreshInterval.value = config.refreshInterval || 60;
      cacheTime.value = config.cacheTime || 300;
      whitelist.value = config.whitelist || [];
      blacklist.value = config.blacklist || [];
    }
  } catch {}
}

onMounted(() => {
  loadConfig();
  checkApiStatus();
});
</script>

<style scoped>
.hot-topics-config-page {
  max-width: 800px;
}

.config-form {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 24px 32px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 80px;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
