<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>任务 #{{ taskId }} 舆情事件</span>
        <el-button @click="$router.push('/tasks')">返回列表</el-button>
      </div>
    </template>
    <el-table :data="events" v-loading="loading" stripe>
      <el-table-column label="平台" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ row.platform }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" show-overflow-tooltip>
        <template #default="{ row }">
          <a :href="row.url" target="_blank" style="color: #1890ff">{{ row.title }}</a>
        </template>
      </el-table-column>
      <el-table-column prop="author" label="作者" width="120" />
      <el-table-column prop="readCount" label="阅读" width="80" />
      <el-table-column prop="likeCount" label="点赞" width="80" />
      <el-table-column prop="commentCount" label="评论" width="80" />
      <el-table-column prop="sentiment" label="情感" width="80">
        <template #default="{ row }">
          <el-tag :type="sentimentTagType(row.sentiment)">
            {{ sentimentLabel(row.sentiment) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="matchedAt" label="匹配时间" width="180">
        <template #default="{ row }">
          {{ new Date(row.matchedAt).toLocaleString() }}
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50]"
      :total="total"
      layout="total, sizes, prev, pager, next"
      style="margin-top: 16px; justify-content: flex-end"
      @current-change="load"
      @size-change="load"
    />
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import http from '@/utils/http';

const route = useRoute();
const taskId = Number(route.params.id);
const events = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const res = await http.get(`/monitor-tasks/${taskId}/events`, {
      params: { page: page.value, pageSize: pageSize.value },
    });
    events.value = res.items;
    total.value = res.total;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function sentimentLabel(s: string): string {
  return ({ positive: '正面', negative: '负面', neutral: '中性' } as Record<string, string>)[s] || s;
}

function sentimentTagType(s: string): 'success' | 'danger' | 'info' {
  return ({ positive: 'success', negative: 'danger', neutral: 'info' } as any)[s] || 'info';
}

watch(() => route.params.id, () => load());
onMounted(load);
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
