<template>
  <div class="ecommerce-page">
    <div class="page-header">
      <h1 class="page-title">电商口碑监测</h1>
      <p class="page-subtitle">多平台商品评论监控与情感分析</p>
    </div>

    <div class="ecommerce-stats">
      <StatCard
        v-for="card in statCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :icon="card.icon"
        :icon-bg="card.bg"
        :glow="card.glow"
      />
    </div>

    <GlassCard title="平台筛选" icon="🛒" subtitle="按电商平台查看评论">
      <div class="platform-tabs">
        <div
          v-for="p in platforms"
          :key="p.key"
          class="platform-tab"
          :class="{ 'platform-tab--active': activePlatform === p.key }"
          @click="activePlatform = p.key"
        >
          <span class="platform-tab__dot" :style="{ background: p.color }" />
          <span>{{ p.label }}</span>
          <span class="platform-tab__count">{{ p.count }}</span>
        </div>
      </div>
    </GlassCard>

    <GlassCard title="评论列表" icon="💬" subtitle="最新商品评论">
      <template #extra>
        <el-select v-model="sentimentFilter" placeholder="情感筛选" clearable style="width: 130px" size="small" @change="filterReviews">
          <el-option label="正面" value="positive" />
          <el-option label="负面" value="negative" />
          <el-option label="中性" value="neutral" />
        </el-select>
      </template>

      <div v-if="loading" v-loading="true" style="min-height: 200px" />

      <div v-else-if="reviews.length === 0 && !useMock" class="empty-state">
        <div class="empty-state__icon">📋</div>
        <h3 class="empty-state__title">暂无评论数据</h3>
        <p class="empty-state__desc">请先创建电商平台监控任务，系统将自动采集评论数据</p>
        <el-button type="primary" @click="$router.push('/tasks')">前往创建监控任务</el-button>
      </div>

      <div v-else class="review-list">
        <div v-for="item in displayedReviews" :key="item.id" class="review-item">
          <div class="review-item__platform">
            <PlatformTag :platform="item.platform" :label="platformLabel(item.platform)" />
          </div>
          <div class="review-item__body">
            <div class="review-item__top">
              <span class="review-item__product">{{ item.productName }}</span>
              <span class="review-item__stars" :style="{ color: starColor(item.rating) }">
                {{ '★'.repeat(item.rating) }}{{ '☆'.repeat(5 - item.rating) }}
              </span>
              <SentimentBadge :type="item.sentiment" />
            </div>
            <p class="review-item__content">{{ item.content }}</p>
            <div class="review-item__meta">
              <span class="review-item__author">{{ item.author }}</span>
              <span class="review-item__date">{{ formatDate(item.date) }}</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import StatCard from '@shared/components/StatCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';
import SentimentBadge from '@shared/components/SentimentBadge.vue';

interface Review {
  id: number;
  platform: string;
  productName: string;
  rating: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  content: string;
  author: string;
  date: string;
}

interface PlatformStat {
  key: string;
  label: string;
  color: string;
  count: number;
}

const loading = ref(false);
const useMock = ref(false);
const reviews = ref<Review[]>([]);
const activePlatform = ref('all');
const sentimentFilter = ref('');

const platforms = ref<PlatformStat[]>([
  { key: 'all', label: '全部', color: '#5E72E4', count: 0 },
  { key: 'jd', label: '京东', color: '#EF4444', count: 0 },
  { key: 'taobao', label: '淘宝', color: '#F59E0B', count: 0 },
  { key: 'pdd', label: '拼多多', color: '#22C55E', count: 0 },
]);

const statCards = ref([
  { label: '总评论数', value: '0', icon: '💬', bg: 'var(--gradient-primary)', glow: 'rgba(94, 114, 228, 0.4)' },
  { label: '正面评价', value: '0', icon: '👍', bg: 'linear-gradient(135deg, #22C55E, #16A34A)', glow: 'rgba(34, 197, 94, 0.4)' },
  { label: '负面评价', value: '0', icon: '👎', bg: 'linear-gradient(135deg, #EF4444, #DC2626)', glow: 'rgba(239, 68, 68, 0.4)' },
  { label: '中性评价', value: '0', icon: '😐', bg: 'linear-gradient(135deg, #6B7280, #4B5563)', glow: 'rgba(107, 114, 128, 0.4)' },
]);

const mockReviews: Review[] = [
  { id: 1, platform: 'jd', productName: '智能手表 Pro Max', rating: 5, sentiment: 'positive', content: '非常满意，功能强大，续航持久，颜值在线！', author: '数码爱好者', date: '2026-07-16' },
  { id: 2, platform: 'taobao', productName: '蓝牙降噪耳机', rating: 2, sentiment: 'negative', content: '降噪效果一般，佩戴久了耳朵疼，不值这个价。', author: '音乐迷', date: '2026-07-15' },
  { id: 3, platform: 'pdd', productName: '无线充电器', rating: 4, sentiment: 'positive', content: '充电速度很快，价格实惠，就是发热有点明显。', author: '科技控', date: '2026-07-14' },
  { id: 4, platform: 'jd', productName: '笔记本电脑支架', rating: 3, sentiment: 'neutral', content: '做工还行，高度调节范围可以更大些。', author: '打工人', date: '2026-07-13' },
  { id: 5, platform: 'taobao', productName: '机械键盘', rating: 5, sentiment: 'positive', content: '手感极佳，RGB灯效漂亮，物超所值！', author: '程序猿', date: '2026-07-12' },
  { id: 6, platform: 'pdd', productName: '便携式充电宝', rating: 1, sentiment: 'negative', content: '容量虚标，充电速度慢，退货了。', author: '旅行者', date: '2026-07-11' },
  { id: 7, platform: 'jd', productName: '智能音箱', rating: 4, sentiment: 'positive', content: '语音识别准确，音质不错，智能家居控制方便。', author: '家居达人', date: '2026-07-10' },
  { id: 8, platform: 'taobao', productName: '运动手环', rating: 3, sentiment: 'neutral', content: '基础功能都有，心率监测不太准。', author: '跑步爱好者', date: '2026-07-09' },
];

function platformLabel(p: string): string {
  return { jd: '京东', taobao: '淘宝', pdd: '拼多多' }[p] || p;
}

function starColor(rating: number): string {
  if (rating >= 4) return '#22C55E';
  if (rating >= 3) return '#F59E0B';
  return '#EF4444';
}

function formatDate(s: string): string {
  if (!s) return '';
  return s;
}

const displayedReviews = computed(() => {
  let filtered = reviews.value;
  if (activePlatform.value !== 'all') {
    filtered = filtered.filter(r => r.platform === activePlatform.value);
  }
  if (sentimentFilter.value) {
    filtered = filtered.filter(r => r.sentiment === sentimentFilter.value);
  }
  return filtered;
});

function filterReviews(): void {
  // reactivity handles display
}

function updateStats(): void {
  const total = reviews.value.length;
  const positive = reviews.value.filter(r => r.sentiment === 'positive').length;
  const negative = reviews.value.filter(r => r.sentiment === 'negative').length;
  const neutral = reviews.value.filter(r => r.sentiment === 'neutral').length;
  statCards.value[0].value = String(total);
  statCards.value[1].value = String(positive);
  statCards.value[2].value = String(negative);
  statCards.value[3].value = String(neutral);

  const jdCount = reviews.value.filter(r => r.platform === 'jd').length;
  const tbCount = reviews.value.filter(r => r.platform === 'taobao').length;
  const pddCount = reviews.value.filter(r => r.platform === 'pdd').length;
  platforms.value[0].count = total;
  platforms.value[1].count = jdCount;
  platforms.value[2].count = tbCount;
  platforms.value[3].count = pddCount;
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const data = await http.get('/ecommerce/reviews');
    if (data && Array.isArray(data) && data.length > 0) {
      reviews.value = data;
      useMock.value = false;
    } else {
      reviews.value = mockReviews;
      useMock.value = true;
    }
  } catch {
    reviews.value = mockReviews;
    useMock.value = true;
  } finally {
    loading.value = false;
    updateStats();
  }
}

onMounted(loadData);
</script>

<style scoped>
.ecommerce-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  margin-bottom: 4px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 6px 0 0 0;
}

.ecommerce-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.platform-tabs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.platform-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 14px;
  color: var(--text-secondary);
}

.platform-tab:hover {
  border-color: var(--border-strong);
  background: rgba(94, 114, 228, 0.08);
}

.platform-tab--active {
  background: var(--gradient-primary) !important;
  color: #fff !important;
  border-color: transparent !important;
  box-shadow: 0 4px 16px rgba(94, 114, 228, 0.35);
}

.platform-tab__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.platform-tab--active .platform-tab__dot {
  background: #fff !important;
}

.platform-tab__count {
  font-size: 12px;
  opacity: 0.7;
  margin-left: 4px;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.review-item {
  display: flex;
  gap: 14px;
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.review-item:hover {
  border-color: var(--border-strong);
  box-shadow: 0 4px 16px rgba(0, 5, 30, 0.2);
}

.review-item__platform {
  flex-shrink: 0;
  min-width: 60px;
}

.review-item__body {
  flex: 1;
  min-width: 0;
}

.review-item__top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.review-item__product {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.review-item__stars {
  font-size: 14px;
  letter-spacing: 1px;
}

.review-item__content {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 8px 0;
}

.review-item__meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 60px 20px;
  gap: 12px;
}

.empty-state__icon {
  font-size: 48px;
  filter: drop-shadow(0 0 12px rgba(94, 114, 228, 0.3));
}

.empty-state__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.empty-state__desc {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0;
  max-width: 400px;
  line-height: 1.6;
}
</style>
