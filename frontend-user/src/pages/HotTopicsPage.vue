<template>
  <div class="hot-topics-page">
    <PageHeader title="热点话题发现" subtitle="实时上升热点追踪" />
    <p class="page-guide">查看各大平台实时热搜榜单和基于监控任务的热点发现</p>

    <el-tabs v-model="activeTab" class="hot-topics-tabs">
      <el-tab-pane label="平台热点" name="platform">
        <div class="platform-status-bar">
          <span v-if="platformUpdatedAt" class="platform-updated-at">
            <el-icon><Clock /></el-icon> 最后更新: {{ formatPlatformTime(platformUpdatedAt) }}
          </span>
          <span class="platform-refresh-indicator" :class="{ 'is-refreshing': platformRefreshCountdown > 0 }">
            <el-icon><Refresh /></el-icon> {{ platformRefreshCountdown }}s 后自动刷新
          </span>
          <el-tag v-if="platformDegraded" type="warning" size="small" effect="dark">降级到模拟数据</el-tag>
          <el-button size="small" :icon="Refresh" :loading="platformLoading" @click="fetchPlatformTopics" />
        </div>
        <div v-if="!platformLoading && Object.keys(platformTopics).length === 0" class="platform-empty">
          <el-empty description="暂无平台热点数据" />
        </div>
        <div v-loading="platformLoading" class="platform-hot-topics">
          <div v-for="(platformData, key) in platformTopics" :key="key" class="platform-section glass-card">
            <div class="platform-section__header">
              <PlatformTag :platform="key as string" :label="platformData.name" />
              <span class="platform-section__time">{{ platformData.topics.length }} 条热点</span>
            </div>
            <div class="platform-topic-list">
              <a
                v-for="topic in platformData.topics"
                :key="topic.rank"
                :href="topic.url"
                target="_blank"
                class="platform-topic-item"
              >
                <div class="platform-topic__rank-group">
                  <span class="value-label">排名</span>
                  <span class="platform-topic__rank" :class="{ 'is-top3': topic.rank <= 3 }">{{ topic.rank }}</span>
                </div>
                <span class="platform-topic__title">{{ topic.title }}</span>
                <span class="platform-topic__category" v-if="topic.category">{{ topic.category }}</span>
                <div class="platform-topic__hot-group">
                  <span class="value-label">热度值</span>
                  <div class="platform-topic__hot-row">
                    <div class="platform-topic__hot-bar-wrapper">
                      <div class="platform-topic__hot-bar" :style="{ width: (topic.hot / 100000) + '%' }" />
                    </div>
                    <div class="platform-topic__hot-value">
                      <span class="value-label">热度</span>
                      <span class="platform-topic__hot">{{ formatHot(topic.hot) }}</span>
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="任务热点" name="tasks">
        <template #label>
          <span>
            任务热点
            <el-tag v-if="demoMode" type="warning" effect="dark" size="small" style="margin-left:4px">演示</el-tag>
          </span>
        </template>

        <EmptyStateGuide
          v-if="topics.length === 0 && !loading"
          icon="🔥"
          title="暂无热点数据"
          description="热点话题基于监控任务数据通过1小时滑动窗口算法实时检测，请先创建监控任务"
          primary-action="前往创建监控任务"
          secondary-action="加载示例数据"
          @primary="router.push('/tasks')"
          @secondary="loadMock"
        />

        <div v-if="topics.length > 0" class="task-topics-controls">
          <el-select v-model="timeWindow" size="small" style="width: 100px" @change="fetchTopics">
            <el-option label="1 小时" :value="1" />
            <el-option label="6 小时" :value="6" />
            <el-option label="12 小时" :value="12" />
            <el-option label="24 小时" :value="24" />
          </el-select>
          <el-input-number v-model="minMentions" :min="1" :max="10000" size="small" style="width: 100px" @change="fetchTopics" />
          <el-switch v-model="autoRefresh" active-text="自动刷新" size="small" />
          <el-button size="small" :icon="Refresh" :loading="loading" @click="fetchTopics" />
        </div>

        <div class="topic-grid">
          <article
            v-for="topic in topics"
            :key="topic.id"
            class="topic-card glass-card"
            :class="{ 'topic-card--expanded': expandedId === topic.id }"
            @click="toggleDetail(topic.id)"
          >
            <div class="topic-card__header">
              <div class="topic-card__score">{{ topic.score.toFixed(0) }}</div>
              <div class="topic-card__title-area">
                <div class="topic-card__title">{{ topic.title }}</div>
                <div class="topic-card__keywords">
                  <span v-for="kw in topic.keywords.slice(0, 3)" :key="kw" class="topic-card__keyword">{{ kw }}</span>
                </div>
              </div>
              <div class="topic-card__growth" :class="topic.growthRate >= 0 ? 'is-up' : 'is-down'">
                <svg v-if="topic.growthRate >= 0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                <span>{{ Math.abs(topic.growthRate).toFixed(1) }}%</span>
              </div>
            </div>

            <div class="topic-card__body">
              <div class="topic-card__sparkline">
                <svg :width="sparkW" :height="sparkH" viewBox="0 0 80 28">
                  <polyline
                    :points="sparklinePoints(topic.hourlyVolume)"
                    fill="none"
                    :stroke="topic.growthRate >= 0 ? '#F87171' : '#34D399'"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <div class="topic-card__volume">
                <span class="value-label">热度</span>
                <span>{{ formatVolume(topic.volume) }}</span>
              </div>
              <div class="topic-card__platforms">
                <PlatformTag
                  v-for="p in topic.platforms.slice(0, 4)"
                  :key="p"
                  :platform="p"
                  :label="p === 'weixin' ? '微信' : p === 'weibo' ? '微博' : p === 'douyin' ? '抖音' : p === 'xiaohongshu' ? '小红书' : p === 'kuaishou' ? '快手' : p === 'baijiahao' ? '百家号' : p"
                />
              </div>
            </div>

            <div class="topic-card__sentiment">
              <div class="sentiment-bar">
                <span class="sentiment-bar__segment sentiment-bar__positive" :style="{ width: topic.sentiment.positive + '%' }" />
                <span class="sentiment-bar__segment sentiment-bar__neutral" :style="{ width: topic.sentiment.neutral + '%' }" />
                <span class="sentiment-bar__segment sentiment-bar__negative" :style="{ width: topic.sentiment.negative + '%' }" />
              </div>
              <div class="sentiment-labels">
                <span class="sentiment-label sentiment-label--pos">{{ topic.sentiment.positive.toFixed(0) }}%</span>
                <span class="sentiment-label sentiment-label--neu">{{ topic.sentiment.neutral.toFixed(0) }}%</span>
                <span class="sentiment-label sentiment-label--neg">{{ topic.sentiment.negative.toFixed(0) }}%</span>
              </div>
            </div>

            <div class="topic-card__footer">
              <span class="topic-card__article-label">热门文章</span>
              <span class="topic-card__article-title">{{ topic.topArticle.title }}</span>
            </div>

            <div v-if="expandedId === topic.id" class="topic-detail">
              <div class="topic-detail__charts">
                <GlassCard title="24h 趋势" icon="📈" bare>
                  <div ref="trendChartRefs" :data-id="topic.id" style="height: 200px" />
                </GlassCard>
                <GlassCard title="情感分布" icon="🎭" bare>
                  <div ref="sentimentChartRefs" :data-id="topic.id" style="height: 200px" />
                </GlassCard>
                <GlassCard title="平台分布" icon="🌐" bare>
                  <div ref="platformChartRefs" :data-id="topic.id" style="height: 200px" />
                </GlassCard>
              </div>
              <GlassCard title="相关文章" icon="📰" subtitle="按时间排序">
                <div v-if="topic.articles && topic.articles.length" class="topic-detail__articles">
                  <div v-for="art in topic.articles" :key="art.title" class="article-row">
                    <PlatformTag :platform="art.platform" :label="art.platform === 'weixin' ? '微信' : art.platform === 'weibo' ? '微博' : art.platform === 'douyin' ? '抖音' : art.platform === 'xiaohongshu' ? '小红书' : art.platform" />
                    <a :href="art.url" target="_blank" class="article-row__title">{{ art.title }}</a>
                    <SentimentBadge :type="(art.sentiment as 'positive' | 'negative' | 'neutral')" />
                    <span class="article-row__time">{{ formatTime(art.publishedAt) }}</span>
                  </div>
                </div>
                <el-empty v-else description="暂无相关文章" />
              </GlassCard>
            </div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import http from '@/utils/http';
import PageHeader from '@shared/components/PageHeader.vue';
import GlassCard from '@shared/components/GlassCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';
import SentimentBadge from '@shared/components/SentimentBadge.vue';
import { Refresh, Clock } from '@element-plus/icons-vue';
import EmptyStateGuide from '@/components/EmptyStateGuide.vue';

interface Article {
  title: string;
  platform: string;
  url: string;
  publishedAt: string;
  sentiment: string;
}

interface HotTopic {
  id: number;
  title: string;
  keywords: string[];
  score: number;
  growthRate: number;
  volume: number;
  hourlyVolume: number[];
  platforms: string[];
  sentiment: { positive: number; negative: number; neutral: number };
  topArticle: { title: string; url?: string };
  articles: Article[];
}

const timeWindow = ref(1);
const minMentions = ref(10);
const autoRefresh = ref(false);
const loading = ref(false);
const demoMode = ref(false);
const topics = ref<HotTopic[]>([]);
const expandedId = ref<number | null>(null);
const activeTab = ref('platform');
const platformTopics = ref<Record<string, { name: string; topics: any[] }>>({});
const platformLoading = ref(false);
const platformUpdatedAt = ref('');
const platformRefreshCountdown = ref(60);
const platformDegraded = ref(false);
const router = useRouter();
const sparkW = 80;
const sparkH = 28;

let refreshTimer: number | null = null;

function sparklinePoints(data: number[]): string {
  if (!data || data.length < 2) return '';
  const w = 80;
  const h = 28;
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);
  return data.map((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 4) - 2;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function formatVolume(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + 'w';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(v);
}

function formatHot(v: number): string {
  if (v >= 100000000) return (v / 100000000).toFixed(1) + '亿';
  if (v >= 10000) return (v / 10000).toFixed(0) + '万';
  return String(v);
}

function formatTime(s?: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatPlatformTime(s?: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const trendChartRefs = ref<HTMLElement[]>([]);
const sentimentChartRefs = ref<HTMLElement[]>([]);
const platformChartRefs = ref<HTMLElement[]>([]);
const chartInstances: echarts.ECharts[] = [];

function setTrendRef(el: any): void { if (el) trendChartRefs.value.push(el); }
function setSentimentRef(el: any): void { if (el) sentimentChartRefs.value.push(el); }
function setPlatformRef(el: any): void { if (el) platformChartRefs.value.push(el); }

function buildMockTopics(): HotTopic[] {
  return [
    {
      id: 1, title: '某知名品牌产品召回事件', keywords: ['召回', '质量问题', '消费者维权'],
      score: 95.2, growthRate: 32.5, volume: 128000, hourlyVolume: [320, 480, 560, 720, 890, 1020, 1150, 980, 870, 750, 620, 540, 480, 510, 580, 690, 810, 940, 1060, 1120, 980, 850, 720, 610],
      platforms: ['weibo', 'weixin', 'douyin', 'baijiahao'], sentiment: { positive: 12, negative: 68, neutral: 20 },
      topArticle: { title: 'XX品牌宣布召回15万件产品，消费者可全额退款' },
      articles: [
        { title: 'XX品牌产品召回细节公布', platform: 'weibo', url: '#', publishedAt: new Date(Date.now() - 3600000).toISOString(), sentiment: 'negative' },
        { title: '专家解读：召回事件背后的行业标准', platform: 'weixin', url: '#', publishedAt: new Date(Date.now() - 7200000).toISOString(), sentiment: 'neutral' },
        { title: '消费者维权群已超5000人', platform: 'douyin', url: '#', publishedAt: new Date(Date.now() - 1800000).toISOString(), sentiment: 'negative' },
      ],
    },
    {
      id: 2, title: '热门AI工具发布引发行业震动', keywords: ['AI', '大模型', '技术革新'],
      score: 92.8, growthRate: 45.2, volume: 256000, hourlyVolume: [120, 340, 580, 920, 1340, 1820, 2150, 2460, 2320, 1980, 1650, 1420, 1280, 1350, 1580, 1860, 2200, 2580, 2850, 3020, 2780, 2450, 2100, 1820],
      platforms: ['weixin', 'weibo', 'xiaohongshu', 'baijiahao'], sentiment: { positive: 72, negative: 8, neutral: 20 },
      topArticle: { title: '重磅！国内AI公司发布新一代大模型，性能超越GPT' },
      articles: [
        { title: 'AI新模型发布会全程回顾', platform: 'weixin', url: '#', publishedAt: new Date(Date.now() - 1800000).toISOString(), sentiment: 'positive' },
        { title: '实测：新AI工具写代码能力惊人', platform: 'xiaohongshu', url: '#', publishedAt: new Date(Date.now() - 3600000).toISOString(), sentiment: 'positive' },
        { title: '行业专家评价：这是中国AI的里程碑', platform: 'baijiahao', url: '#', publishedAt: new Date(Date.now() - 5400000).toISOString(), sentiment: 'positive' },
      ],
    },
    {
      id: 3, title: '某市交通新政今日实施', keywords: ['交通', '限行', '城市管理'],
      score: 88.5, growthRate: -5.8, volume: 85000, hourlyVolume: [2100, 1850, 1520, 1280, 980, 750, 620, 580, 520, 480, 450, 420, 380, 360, 340, 320, 310, 300, 290, 280, 270, 260, 250, 240],
      platforms: ['weibo', 'douyin', 'kuaishou'], sentiment: { positive: 25, negative: 45, neutral: 30 },
      topArticle: { title: '新规首日：主干道拥堵明显缓解' },
      articles: [
        { title: '市民热议交通新规：有人叫好有人吐槽', platform: 'weibo', url: '#', publishedAt: new Date(Date.now() - 2400000).toISOString(), sentiment: 'negative' },
        { title: '交通局回应新规质疑：数据说话', platform: 'douyin', url: '#', publishedAt: new Date(Date.now() - 4800000).toISOString(), sentiment: 'neutral' },
      ],
    },
    {
      id: 4, title: '知名艺人离婚风波持续发酵', keywords: ['离婚', '明星', '娱乐圈'],
      score: 86.3, growthRate: 18.2, volume: 356000, hourlyVolume: [450, 890, 1560, 2340, 3120, 3980, 4520, 4860, 4520, 3980, 3420, 2980, 2650, 2820, 3150, 3560, 4120, 4680, 5120, 4860, 4320, 3850, 3420, 2980],
      platforms: ['weibo', 'douyin', 'xiaohongshu', 'kuaishou'], sentiment: { positive: 5, negative: 55, neutral: 40 },
      topArticle: { title: 'XX与XX正式宣布离婚，双方发布联合声明' },
      articles: [
        { title: '离婚声明全文曝光', platform: 'weibo', url: '#', publishedAt: new Date(Date.now() - 1200000).toISOString(), sentiment: 'neutral' },
        { title: '回顾两人十年感情路', platform: 'xiaohongshu', url: '#', publishedAt: new Date(Date.now() - 3600000).toISOString(), sentiment: 'neutral' },
        { title: '业内人士爆料：财产分割已达成', platform: 'douyin', url: '#', publishedAt: new Date(Date.now() - 6000000).toISOString(), sentiment: 'negative' },
      ],
    },
    {
      id: 5, title: '中国电竞战队勇夺世界冠军', keywords: ['电竞', '夺冠', '英雄联盟'],
      score: 84.7, growthRate: 62.3, volume: 520000, hourlyVolume: [80, 120, 280, 560, 1020, 1860, 3200, 5200, 7800, 10200, 12500, 14200, 15600, 16800, 17500, 18200, 18800, 19200, 18500, 17200, 15800, 14200, 12500, 10800],
      platforms: ['weibo', 'douyin', 'kuaishou', 'baijiahao'], sentiment: { positive: 88, negative: 2, neutral: 10 },
      topArticle: { title: '历史性时刻！中国战队3:0横扫对手夺冠' },
      articles: [
        { title: '总决赛MVP采访：我们证明了自己', platform: 'weibo', url: '#', publishedAt: new Date(Date.now() - 600000).toISOString(), sentiment: 'positive' },
        { title: '夺冠瞬间：全国高校宿舍沸腾', platform: 'douyin', url: '#', publishedAt: new Date(Date.now() - 1800000).toISOString(), sentiment: 'positive' },
        { title: '电竞产业规模有望突破千亿', platform: 'baijiahao', url: '#', publishedAt: new Date(Date.now() - 5400000).toISOString(), sentiment: 'positive' },
      ],
    },
    {
      id: 6, title: '某地突发暴雨引发洪涝灾害', keywords: ['暴雨', '洪灾', '救援'],
      score: 82.1, growthRate: 28.6, volume: 420000, hourlyVolume: [50, 180, 420, 890, 1560, 2450, 3680, 5200, 6800, 8200, 9200, 9800, 10200, 10500, 10800, 11200, 11500, 11800, 11200, 10500, 9800, 9200, 8500, 7800],
      platforms: ['weibo', 'douyin', 'kuaishou', 'weixin'], sentiment: { positive: 35, negative: 42, neutral: 23 },
      topArticle: { title: '紧急救援：消防官兵连夜转移被困群众' },
      articles: [
        { title: '实拍：暴雨淹没街道，车辆被冲走', platform: 'douyin', url: '#', publishedAt: new Date(Date.now() - 900000).toISOString(), sentiment: 'negative' },
        { title: '救援进展：已安全转移5000余人', platform: 'weixin', url: '#', publishedAt: new Date(Date.now() - 3600000).toISOString(), sentiment: 'positive' },
      ],
    },
    {
      id: 7, title: '旗舰手机发布会亮点汇总', keywords: ['手机', '发布会', '科技'],
      score: 79.4, growthRate: 12.1, volume: 198000, hourlyVolume: [180, 350, 620, 980, 1350, 1720, 2100, 2480, 2350, 2120, 1880, 1650, 1480, 1520, 1680, 1850, 2050, 2280, 2450, 2380, 2150, 1920, 1720, 1550],
      platforms: ['weibo', 'weixin', 'xiaohongshu', 'baijiahao'], sentiment: { positive: 65, negative: 15, neutral: 20 },
      topArticle: { title: 'XX旗舰发布：骁龙8Gen4+2亿像素' },
      articles: [
        { title: '真机上手体验：性能提升巨大', platform: 'xiaohongshu', url: '#', publishedAt: new Date(Date.now() - 2400000).toISOString(), sentiment: 'positive' },
        { title: '售价公布：起售价4999元', platform: 'weibo', url: '#', publishedAt: new Date(Date.now() - 4800000).toISOString(), sentiment: 'neutral' },
      ],
    },
    {
      id: 8, title: '食品安全再曝黑幕：某品牌使用过期原料', keywords: ['食品安全', '曝光', '维权'],
      score: 77.8, growthRate: -2.3, volume: 92000, hourlyVolume: [1200, 980, 760, 620, 520, 480, 420, 380, 350, 320, 300, 280, 260, 250, 240, 230, 220, 210, 200, 190, 180, 170, 160, 150],
      platforms: ['weibo', 'douyin', 'weixin'], sentiment: { positive: 8, negative: 78, neutral: 14 },
      topArticle: { title: '市场监管总局介入调查过期原料事件' },
      articles: [
        { title: '暗访视频曝光：冷库堆积大量过期食材', platform: 'douyin', url: '#', publishedAt: new Date(Date.now() - 1800000).toISOString(), sentiment: 'negative' },
        { title: '消费者索赔指南', platform: 'weixin', url: '#', publishedAt: new Date(Date.now() - 5400000).toISOString(), sentiment: 'neutral' },
      ],
    },
    {
      id: 9, title: '某互联网公司宣布裁员30%', keywords: ['裁员', '互联网', '就业'],
      score: 75.1, growthRate: 8.4, volume: 165000, hourlyVolume: [280, 520, 860, 1250, 1680, 2150, 2560, 2820, 2650, 2380, 2120, 1850, 1620, 1580, 1650, 1820, 2050, 2320, 2580, 2480, 2250, 2020, 1820, 1650],
      platforms: ['weibo', 'weixin', 'baijiahao', 'xiaohongshu'], sentiment: { positive: 10, negative: 65, neutral: 25 },
      topArticle: { title: 'XX公司确认裁员30%，涉及多个业务线' },
      articles: [
        { title: '被裁员工讲述心路历程', platform: 'xiaohongshu', url: '#', publishedAt: new Date(Date.now() - 1200000).toISOString(), sentiment: 'negative' },
        { title: '行业分析：互联网裁员潮何时见底', platform: 'baijiahao', url: '#', publishedAt: new Date(Date.now() - 4200000).toISOString(), sentiment: 'neutral' },
      ],
    },
    {
      id: 10, title: '年度票房黑马：低成本电影逆袭', keywords: ['电影', '票房', '黑马'],
      score: 72.6, growthRate: 35.7, volume: 72000, hourlyVolume: [45, 80, 150, 280, 450, 680, 920, 1250, 1580, 1820, 2100, 2350, 2580, 2450, 2320, 2180, 2050, 1920, 1800, 1680, 1550, 1420, 1280, 1150],
      platforms: ['weibo', 'xiaohongshu', 'douyin'], sentiment: { positive: 82, negative: 5, neutral: 13 },
      topArticle: { title: '成本仅300万，票房突破5亿！年度黑马诞生' },
      articles: [
        { title: '导演专访：坚持梦想终有回报', platform: 'weibo', url: '#', publishedAt: new Date(Date.now() - 3600000).toISOString(), sentiment: 'positive' },
        { title: '观众口碑爆棚：年度最佳华语片', platform: 'xiaohongshu', url: '#', publishedAt: new Date(Date.now() - 6000000).toISOString(), sentiment: 'positive' },
      ],
    },
  ];
}

async function fetchPlatformTopics(): Promise<void> {
  platformLoading.value = true;
  platformDegraded.value = false;
  try {
    const data = await http.get('/hot-topics/platform');
    platformTopics.value = data.platforms || {};
    platformUpdatedAt.value = data.updatedAt || '';
    platformDegraded.value = false;
  } catch {
    platformTopics.value = buildMockPlatformTopics();
    platformUpdatedAt.value = new Date().toISOString();
    platformDegraded.value = true;
  } finally {
    platformLoading.value = false;
    platformRefreshCountdown.value = 60;
  }
}

function buildMockPlatformTopics(): Record<string, { name: string; topics: any[] }> {
  return {
    weibo: { name: '微博热搜', topics: [
      { rank: 1, title: '官方回应网传医保缴费年限延长', hot: 8520000, url: '#', category: '社会' },
      { rank: 2, title: '多家银行下调存款利率', hot: 7680000, url: '#', category: '财经' },
      { rank: 3, title: '知名男星被曝新恋情', hot: 7210000, url: '#', category: '娱乐' },
      { rank: 4, title: '全国多个城市出现雾霾天气', hot: 6950000, url: '#', category: '社会' },
      { rank: 5, title: '2026年高考报名人数再创新高', hot: 6580000, url: '#', category: '教育' },
    ]},
    douyin: { name: '抖音热点', topics: [
      { rank: 1, title: '挑战全网最丝滑转身', hot: 9250000, url: '#' },
      { rank: 2, title: '街头采访：你月薪多少', hot: 8720000, url: '#' },
      { rank: 3, title: '美食探店本期打卡重庆', hot: 8350000, url: '#' },
      { rank: 4, title: '宠物犬救落水儿童全过程', hot: 7980000, url: '#' },
      { rank: 5, title: '素人翻唱惊艳全场', hot: 7560000, url: '#' },
    ]},
    baidu: { name: '百度热搜', topics: [
      { rank: 1, title: '2026年春运购票日历公布', hot: 9800000, url: '#', category: '社会' },
      { rank: 2, title: 'A股三大指数集体收涨', hot: 9100000, url: '#', category: '财经' },
      { rank: 3, title: '较强冷空气来袭多地降温', hot: 8750000, url: '#', category: '天气' },
      { rank: 4, title: '中国空间站最新实验成果', hot: 8320000, url: '#', category: '科技' },
      { rank: 5, title: '国际油价大幅下跌', hot: 7950000, url: '#', category: '财经' },
    ]},
    zhihu: { name: '知乎热榜', topics: [
      { rank: 1, title: '2026年做什么行业最有前景？', hot: 12500000, url: '#', category: '职场' },
      { rank: 2, title: '如何评价最近大火的国产AI应用？', hot: 11200000, url: '#', category: '科技' },
      { rank: 3, title: '房价持续下跌，现在该买房还是观望？', hot: 10800000, url: '#', category: '房产' },
      { rank: 4, title: '30岁转行来得及吗？真实经历分享', hot: 9850000, url: '#', category: '职场' },
      { rank: 5, title: '《三体》动画版口碑两极分化', hot: 9200000, url: '#', category: '文化' },
    ]},
    bili: { name: 'B站热门', topics: [
      { rank: 1, title: '2026年B站百大UP主颁奖典礼', hot: 9200000, url: '#', category: '娱乐' },
      { rank: 2, title: '硬核科普：芯片是如何制造的', hot: 8800000, url: '#', category: '科技' },
      { rank: 3, title: '全站最详细的AI绘画教程', hot: 8500000, url: '#', category: '科技' },
      { rank: 4, title: 'UP主挑战24小时不碰手机', hot: 8200000, url: '#', category: '生活' },
      { rank: 5, title: '2026年度最佳动画番剧推荐', hot: 7900000, url: '#', category: '动漫' },
    ]},
    toutiao: { name: '今日头条', topics: [
      { rank: 1, title: '专家解读2026年经济走势', hot: 9100000, url: '#', category: '财经' },
      { rank: 2, title: '国际局势最新动态分析', hot: 8700000, url: '#', category: '时政' },
      { rank: 3, title: '多地出台楼市新政', hot: 8400000, url: '#', category: '房产' },
      { rank: 4, title: '科技巨头发布新一代芯片', hot: 8100000, url: '#', category: '科技' },
      { rank: 5, title: '2026年就业形势分析报告', hot: 7800000, url: '#', category: '职场' },
    ]},
    hupu: { name: '虎扑热榜', topics: [
      { rank: 1, title: 'CBA总决赛精彩回顾', hot: 8800000, url: '#', category: '体育' },
      { rank: 2, title: 'NBA交易市场最新动态', hot: 8500000, url: '#', category: '体育' },
      { rank: 3, title: '欧冠淘汰赛对阵出炉', hot: 8200000, url: '#', category: '体育' },
      { rank: 4, title: '国足最新世界排名公布', hot: 7900000, url: '#', category: '体育' },
      { rank: 5, title: '电竞LPL春季赛战况', hot: 7600000, url: '#', category: '电竞' },
    ]},
    '36kr': { name: '36氪热榜', topics: [
      { rank: 1, title: '2026年创投圈十大趋势预测', hot: 7200000, url: '#', category: '创投' },
      { rank: 2, title: 'AI大模型创业公司融资盘点', hot: 6900000, url: '#', category: '科技' },
      { rank: 3, title: '出海企业面临的挑战与机遇', hot: 6600000, url: '#', category: '商业' },
      { rank: 4, title: '新能源赛道估值重构', hot: 6300000, url: '#', category: '财经' },
      { rank: 5, title: 'SaaS行业年度报告发布', hot: 6000000, url: '#', category: '科技' },
    ]},
    github: { name: 'GitHub', topics: [
      { rank: 1, title: 'torvalds/linux: Linux kernel', hot: 8500, url: '#', category: '系统' },
      { rank: 2, title: 'microsoft/vscode: Visual Studio Code', hot: 8200, url: '#', category: '工具' },
      { rank: 3, title: 'facebook/react: A declarative UI library', hot: 7900, url: '#', category: '前端' },
      { rank: 4, title: 'pallets/flask: The Python micro framework', hot: 7600, url: '#', category: 'Python' },
      { rank: 5, title: 'rust-lang/rust: Empowering everyone', hot: 7300, url: '#', category: '语言' },
    ]},
  };
}

async function fetchTopics(): Promise<void> {
  loading.value = true;
  try {
    const data = await http.get('/hot-topics', { params: { timeWindow: timeWindow.value, minMentions: minMentions.value } });
    topics.value = (data as any[]).map((t: any) => ({
      id: t.id,
      title: t.title,
      keywords: t.keywords || [],
      score: t.score,
      growthRate: t.growthRate,
      volume: t.volume,
      hourlyVolume: t.hourlyVolume || [],
      platforms: t.platforms || [],
      sentiment: t.sentiment || { positive: 33, negative: 33, neutral: 34 },
      topArticle: t.topArticle || { title: '' },
      articles: t.articles || [],
    }));
    demoMode.value = false;
  } catch {
    demoMode.value = true;
    topics.value = buildMockTopics();
  } finally {
    loading.value = false;
  }
}

function toggleDetail(id: number): void {
  expandedId.value = expandedId.value === id ? null : id;
  nextTick(() => renderDetailCharts(id));
}

function loadMock(): void {
  topics.value = buildMockTopics();
  demoMode.value = true;
}

function renderDetailCharts(id: number): void {
  const topic = topics.value.find(t => t.id === id);
  if (!topic) return;

  const trendEls = document.querySelectorAll(`[data-id="${id}"]`);
  trendEls.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const role = el.closest('[class*="topic-detail__charts"]')?.querySelector('[class*="trend"]') ? 'trend' :
                 el.closest('[class*="sentiment"]') ? 'sentiment' : 'platform';
    const chart = echarts.init(el);

    if (el.parentElement?.previousElementSibling?.textContent?.includes('24h')) {
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
        grid: { left: 40, right: 10, top: 20, bottom: 20 },
        xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i}:00`), axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } }, axisLabel: { color: '#9DA8E5', fontSize: 10 } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } }, axisLabel: { color: '#9DA8E5', fontSize: 10 } },
        series: [{ type: 'line', smooth: true, data: topic.hourlyVolume, symbol: 'none', lineStyle: { width: 2, color: '#5E72E4' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(94,114,228,0.3)' }, { offset: 1, color: 'rgba(94,114,228,0.02)' }]) } }],
      });
    } else if (el.parentElement?.previousElementSibling?.textContent?.includes('情感')) {
      const { positive, negative, neutral } = topic.sentiment;
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
        series: [{
          type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
          data: [
            { name: '正面', value: positive, itemStyle: { color: '#34D399' } },
            { name: '负面', value: negative, itemStyle: { color: '#F87171' } },
            { name: '中性', value: neutral, itemStyle: { color: '#94A3B8' } },
          ],
          label: { color: '#9DA8E5', fontSize: 11 },
          labelLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } },
        }],
      });
    } else if (el.parentElement?.previousElementSibling?.textContent?.includes('平台')) {
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
        grid: { left: 40, right: 10, top: 20, bottom: 20 },
        xAxis: { type: 'category', data: topic.platforms, axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } }, axisLabel: { color: '#9DA8E5', fontSize: 10 } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } }, axisLabel: { color: '#9DA8E5', fontSize: 10 } },
        series: [{
          type: 'bar', data: topic.platforms.map((_, i) => ({
            value: Math.round(topic.volume / topic.platforms.length * (1 + i * 0.3)),
            itemStyle: { color: ['#FF5C5C', '#10B981', '#EC4899', '#F59E0B', '#3B82F6', '#8B5CF6'][i % 6] },
          })),
          barWidth: '60%',
        }],
      });
    }

    chartInstances.push(chart);
  });
}

onMounted(() => {
  fetchPlatformTopics();
  fetchTopics();
  platformRefreshCountdown.value = 60;
  const platformTimer = window.setInterval(() => {
    if (platformRefreshCountdown.value <= 1) {
      fetchPlatformTopics();
    } else {
      platformRefreshCountdown.value--;
    }
  }, 1000);
  refreshTimer = platformTimer;
});

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer);
  chartInstances.forEach(c => { try { c.dispose(); } catch {} });
});
</script>

<style scoped>
.page-guide {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
  margin-bottom: 16px;
  line-height: 1.5;
}
.hot-topics-page {
  animation: fade-in 300ms ease-out;
}

.hot-topics-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  transition: all var(--transition-normal);
  animation: fade-in 250ms ease-out both;
}

.topic-card {
  cursor: pointer;
  padding: 20px;
  transition: all var(--transition-fast);
}

.topic-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: 0 12px 40px rgba(0, 5, 30, 0.55), 0 0 24px rgba(94, 114, 228, 0.15);
}

.topic-card--expanded {
  grid-column: 1 / -1;
}

.topic-card__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.topic-card__score {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--gradient-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(94, 114, 228, 0.35);
}

.topic-card__title-area {
  flex: 1;
  min-width: 0;
}

.topic-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-card__keywords {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.topic-card__keyword {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 8px;
  background: rgba(94, 114, 228, 0.12);
  color: var(--color-primary-light);
}

.topic-card__growth {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
}

.topic-card__growth.is-up {
  color: #F87171;
  background: rgba(239, 68, 68, 0.1);
}

.topic-card__growth.is-down {
  color: #34D399;
  background: rgba(16, 185, 129, 0.1);
}

.topic-card__body {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}

.topic-card__sparkline {
  flex-shrink: 0;
  opacity: 0.8;
}

.topic-card__volume {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.topic-card__platforms {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-end;
}

.topic-card__sentiment {
  margin-bottom: 10px;
}

.sentiment-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.15);
}

.sentiment-bar__segment {
  transition: width var(--transition-normal);
}

.sentiment-bar__positive { background: #34D399; }
.sentiment-bar__neutral { background: #94A3B8; }
.sentiment-bar__negative { background: #F87171; }

.sentiment-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}

.sentiment-label {
  font-size: 10px;
  font-weight: 500;
}

.sentiment-label--pos { color: #34D399; }
.sentiment-label--neu { color: #94A3B8; }
.sentiment-label--neg { color: #F87171; }

.topic-card__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
}

.topic-card__article-label {
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.topic-card__article-title {
  font-size: 12px;
  color: var(--color-primary-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-detail {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

.topic-detail__charts {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.topic-detail__articles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.article-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.article-row:last-child {
  border-bottom: none;
}

.article-row__title {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-row__title:hover {
  color: var(--color-primary-light);
}

.article-row__time {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .topic-grid {
    grid-template-columns: 1fr;
  }
  .topic-detail__charts {
    grid-template-columns: 1fr;
  }
}

.hot-topics-tabs {
  margin-top: 0;
}

.task-topics-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.platform-hot-topics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
}

.platform-status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--glass-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  flex-wrap: wrap;
}

.platform-updated-at {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.platform-refresh-indicator {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.platform-refresh-indicator.is-refreshing {
  color: var(--color-primary-light);
}

.platform-empty {
  padding: 60px 0;
}

.platform-section {
  padding: 16px;
}

.platform-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-subtle);
}

.platform-section__time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.platform-topic-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.platform-topic-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: background var(--transition-fast);
}

.platform-topic-item:hover {
  background: rgba(94, 114, 228, 0.08);
}

.platform-topic__rank {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  background: rgba(148, 163, 184, 0.1);
  border-radius: 4px;
}

.platform-topic__rank.is-top3 {
  background: var(--gradient-primary);
  color: #fff;
  box-shadow: 0 2px 6px rgba(94, 114, 228, 0.35);
}

.platform-topic__title {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 100px;
}

.platform-topic__category {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-tertiary);
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.1);
}

.platform-topic__hot-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.platform-topic__hot-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.platform-topic__hot-bar-wrapper {
  flex-shrink: 0;
  width: 80px;
  height: 4px;
  background: rgba(148, 163, 184, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.platform-topic__hot-bar {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: 2px;
  transition: width var(--transition-normal);
}

.platform-topic__hot-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.platform-topic__hot {
  flex-shrink: 0;
  width: 52px;
  text-align: right;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.value-label {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1;
}

.platform-topic__rank-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
</style>
