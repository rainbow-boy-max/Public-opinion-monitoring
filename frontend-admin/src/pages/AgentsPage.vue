<template>
  <GlassCard title="AI 智能体管理" icon="🤖" subtitle="自定义大模型智能体，配置知识库后即可生产化对外服务">
    <template #extra>
      <el-button type="primary" :icon="Plus" @click="onCreate">创建智能体</el-button>
    </template>

    <div class="agent-grid">
      <article
        v-for="a in agents"
        :key="a.id"
        class="agent-card"
        :class="{ 'agent-card--disabled': a.status === 'disabled' }"
        @click="goDetail(a.id)"
      >
        <div class="agent-card__head">
          <div class="agent-card__avatar">{{ (a.name || '?').charAt(0) }}</div>
          <div class="agent-card__meta">
            <div class="agent-card__name">{{ a.name }}</div>
            <el-tag
              :type="a.status === 'enabled' ? 'success' : 'info'"
              size="small"
              effect="dark"
            >
              {{ a.status === 'enabled' ? '已启用' : '已禁用' }}
            </el-tag>
          </div>
        </div>
        <div class="agent-card__role">{{ a.roleDescription || '(无角色描述)' }}</div>
        <div class="agent-card__specs">
          <div class="spec">
            <div class="spec__label">主用模型</div>
            <div class="spec__value">{{ getModelLabel(a.primaryModelId) || '未配置' }}</div>
          </div>
          <div class="spec">
            <div class="spec__label">备用模型</div>
            <div class="spec__value">{{ a.fallbackModelIds?.length || 0 }} 个</div>
          </div>
          <div class="spec">
            <div class="spec__label">温度</div>
            <div class="spec__value">{{ a.temperature }}</div>
          </div>
          <div class="spec">
            <div class="spec__label">最大 Token</div>
            <div class="spec__value">{{ a.maxTokens }}</div>
          </div>
        </div>
        <div class="agent-card__footer">
          <el-tag v-if="a.kbEnabled === 1" type="primary" size="small" effect="dark">
            📚 知识库开启
          </el-tag>
          <el-tag v-else size="small" effect="dark" type="info">无知识库</el-tag>
          <el-button
            size="small"
            type="danger"
            @click.stop="onDelete(a)"
            style="margin-left: auto;"
          >
            删除
          </el-button>
        </div>
      </article>
    </div>

    <el-empty
      v-if="agents.length === 0"
      description="还没有智能体，点击右上角创建你的第一个 AI 智能体"
    />
  </GlassCard>
</template>

<script setup lang="ts">
defineOptions({ name: 'AgentsPage' });
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const router = useRouter();
const agents = ref<any[]>([]);
const models = ref<any[]>([]);

function getModelLabel(id: number): string {
  const m = models.value.find((x) => x.id === id);
  return m ? `${m.displayName} (${m.model})` : '';
}

async function load(): Promise<void> {
  try {
    agents.value = (await http.get('/agents', { params: { page: 1, pageSize: 50 } })).items;
  } catch (err) {
    console.error(err);
  }
  try {
    const r = await http.get('/admin/llm-models', { params: { page: 1, pageSize: 100 } });
    models.value = r.items;
  } catch (err) {
    console.error(err);
  }
}

function onCreate(): void {
  router.push({ name: 'agent-new' });
}

function goDetail(id: number): void {
  router.push(`/agents/${id}`);
}

async function onDelete(a: any): Promise<void> {
  await ElMessageBox.confirm(`确认删除智能体 "${a.name}"？`, '删除确认', { type: 'warning' });
  try {
    await http.delete(`/agents/${a.id}`);
    ElMessage.success('已删除');
    load();
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败');
  }
}

onMounted(load);
</script>

<style scoped>
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.agent-card {
  padding: 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.agent-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: 0 12px 40px rgba(0, 5, 30, 0.4), 0 0 24px rgba(94, 114, 228, 0.2);
}

.agent-card--disabled {
  opacity: 0.6;
}

.agent-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.agent-card__avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--gradient-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(94, 114, 228, 0.4);
}

.agent-card__meta {
  flex: 1;
  min-width: 0;
}

.agent-card__name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.agent-card__role {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 14px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agent-card__specs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.spec {
  padding: 8px 10px;
  background: rgba(15, 19, 47, 0.4);
  border-radius: var(--radius-sm);
}

.spec__label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.spec__value {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  margin-top: 2px;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-card__footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}
</style>
