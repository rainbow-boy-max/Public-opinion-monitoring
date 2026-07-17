<template>
  <div class="config-page">
    <GlassCard title="电商平台监控配置" icon="🛒" subtitle="配置需要监控的电商平台及其关键词">
      <el-form :model="configForm" label-width="120px">
        <el-form-item label="平台">
          <el-select v-model="configForm.platform" placeholder="选择平台">
            <el-option label="京东" value="jd" />
            <el-option label="淘宝" value="taobao" />
            <el-option label="拼多多" value="pdd" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="configForm.keywords" placeholder='输入关键词，多个用逗号分隔，例如："智能手表,蓝牙耳机"' />
        </el-form-item>
        <el-form-item label="商品 ID">
          <el-input v-model="configForm.productIds" placeholder="商品 ID，多个用逗号分隔（选填）" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onAddConfig">添加配置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-if="configs.length > 0" :data="configs" stripe style="margin-top: 16px">
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">
            <el-tag :type="platformTagType(row.platform)">{{ platformLabel(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="keywords" label="关键词" />
        <el-table-column prop="productIds" label="商品 ID" />
        <el-table-column prop="isActive" label="状态" width="80">
          <template #default="{ row }">
            <el-switch :model-value="!!row.isActive" @change="(v) => onToggleConfig(row.id, v)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button type="danger" link @click="onDeleteConfig(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </GlassCard>

    <GlassCard title="监控统计概览" icon="📊" subtitle="聚合数据">
      <div v-if="statsLoading" v-loading="true" style="min-height: 100px" />
      <div v-else class="stats-grid">
        <StatCard title="总评论数" :value="stats.totalReviews" color="#5E72E4" />
        <StatCard title="正面评价" :value="stats.positiveCount" color="#22C55E" />
        <StatCard title="负面评价" :value="stats.negativeCount" color="#EF4444" />
        <StatCard title="负面率" :value="stats.negativeRatio + '%'" color="#F59E0B" />
      </div>
    </GlassCard>

    <GlassCard title="评论列表" icon="💬" subtitle="实时评论数据">
      <div class="toolbar">
        <el-select v-model="reviewFilter.platform" placeholder="平台筛选" clearable style="width: 140px" @change="loadReviews">
          <el-option label="京东" value="jd" />
          <el-option label="淘宝" value="taobao" />
          <el-option label="拼多多" value="pdd" />
        </el-select>
        <el-select v-model="reviewFilter.sentiment" placeholder="情感筛选" clearable style="width: 140px" @change="loadReviews">
          <el-option label="正面" value="positive" />
          <el-option label="负面" value="negative" />
          <el-option label="中性" value="neutral" />
        </el-select>
      </div>
      <el-table :data="reviews" stripe v-loading="reviewsLoading">
        <el-table-column label="平台" width="80">
          <template #default="{ row }">
            <el-tag :type="platformTagType(row.platform)" size="small">{{ platformLabel(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="productName" label="商品" width="140" />
        <el-table-column label="评分" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.rating >= 4 ? '#22C55E' : row.rating >= 3 ? '#F59E0B' : '#EF4444' }">{{ '★'.repeat(row.rating) }}{{ '☆'.repeat(5 - row.rating) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="情感" width="80">
          <template #default="{ row }">
            <el-tag :type="sentimentTagType(row.sentiment)" size="small">{{ sentimentLabel(row.sentiment) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="author" label="作者" width="100" />
        <el-table-column prop="date" label="日期" width="100" />
      </el-table>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import StatCard from '@shared/components/StatCard.vue';

const configs = ref<any[]>([]);
const configForm = reactive({ platform: 'jd', keywords: '', productIds: '' });
const saving = ref(false);
const stats = ref<any>({ totalReviews: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0, negativeRatio: 0, trendingProducts: [] });
const statsLoading = ref(false);
const reviews = ref<any[]>([]);
const reviewsLoading = ref(false);
const reviewFilter = reactive({ platform: '', sentiment: '' });

function platformLabel(p: string): string {
  return { jd: '京东', taobao: '淘宝', pdd: '拼多多' }[p] || p;
}
function platformTagType(p: string): string {
  return { jd: 'danger', taobao: 'warning', pdd: 'success' }[p] || '';
}
function sentimentLabel(s: string): string {
  return { positive: '正面', negative: '负面', neutral: '中性' }[s] || s;
}
function sentimentTagType(s: string): string {
  return { positive: 'success', negative: 'danger', neutral: 'info' }[s] || '';
}

async function loadConfigs(): Promise<void> {
  try {
    configs.value = await http.get('/ecommerce/configs');
  } catch { /* ignore */ }
}

async function loadStats(): Promise<void> {
  statsLoading.value = true;
  try {
    stats.value = await http.get('/ecommerce/stats');
  } catch { /* ignore */ } finally { statsLoading.value = false; }
}

async function loadReviews(): Promise<void> {
  reviewsLoading.value = true;
  try {
    reviews.value = await http.get('/ecommerce/reviews', { params: { platform: reviewFilter.platform || undefined, sentiment: reviewFilter.sentiment || undefined } });
  } catch { /* ignore */ } finally { reviewsLoading.value = false; }
}

async function onAddConfig(): Promise<void> {
  if (!configForm.keywords) { ElMessage.warning('请输入关键词'); return; }
  saving.value = true;
  try {
    const keywords = configForm.keywords.includes(',') ? JSON.stringify(configForm.keywords.split(',').map(s => s.trim())) : configForm.keywords;
    await http.post('/ecommerce/configs', { platform: configForm.platform, keywords, productIds: configForm.productIds });
    ElMessage.success('配置已添加');
    configForm.keywords = '';
    configForm.productIds = '';
    loadConfigs();
  } catch { /* ignore */ } finally { saving.value = false; }
}

async function onToggleConfig(id: number, active: boolean): Promise<void> {
  try {
    await http.put(`/ecommerce/configs/${id}`, { isActive: active });
    loadConfigs();
  } catch { /* ignore */ }
}

async function onDeleteConfig(id: number): Promise<void> {
  try {
    await ElMessageBox.confirm('确定删除此配置？', '确认');
    await http.delete(`/ecommerce/configs/${id}`);
    ElMessage.success('已删除');
    loadConfigs();
  } catch { /* ignore */ }
}

onMounted(() => { loadConfigs(); loadStats(); loadReviews(); });
</script>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.toolbar { margin-bottom: 16px; display: flex; gap: 12px; }
</style>
