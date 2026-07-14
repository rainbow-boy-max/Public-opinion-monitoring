<template>
  <GlassCard title="AI 知识库" icon="📚" subtitle="独立知识库模块 · AI 自动分类 · AI 打分 · AI 增强">
    <template #extra>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">创建知识库</el-button>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </template>

    <div class="toolbar">
      <el-input
        v-model="searchText"
        placeholder="搜索知识库名称或描述"
        clearable
        style="width: 280px"
        @keyup.enter="loadData"
      >
        <template #prefix>🔍</template>
      </el-input>
      <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px; margin-left: 8px">
        <el-option label="草稿" value="draft" />
        <el-option label="处理中" value="processing" />
        <el-option label="已就绪" value="ready" />
        <el-option label="已禁用" value="disabled" />
      </el-select>
      <el-button type="primary" style="margin-left: 8px" @click="loadData">查询</el-button>
    </div>

    <div class="kb-grid">
      <article
        v-for="kb in kbs"
        :key="kb.id"
        class="kb-card"
        @click="goDetail(kb.id)"
      >
        <div class="kb-card__head">
          <div class="kb-card__icon" :style="{ background: domainColor(kb.domain) }">
            <span>{{ domainIcon(kb.domain) }}</span>
          </div>
          <div class="kb-card__meta">
            <div class="kb-card__name">{{ kb.name }}</div>
            <el-tag :type="statusType(kb.status)" effect="dark" size="small">
              {{ statusLabel(kb.status) }}
            </el-tag>
          </div>
          <el-tooltip v-if="kb.aiScore !== null" :content="`AI 评分 ${kb.aiScore} / 100`" placement="top">
            <div class="kb-card__score">{{ Math.round(kb.aiScore) }}</div>
          </el-tooltip>
        </div>
        <div class="kb-card__desc">{{ kb.description || '暂无描述' }}</div>
        <div v-if="kb.aiSummary" class="kb-card__ai-summary">
          <span class="ai-tag">AI</span>
          {{ kb.aiSummary }}
        </div>
        <div class="kb-card__tags">
          <el-tag
            v-for="t in (kb.tags || []).slice(0, 5)"
            :key="t"
            size="small"
            effect="dark"
            type="info"
            style="margin-right: 4px"
          >
            {{ t }}
          </el-tag>
        </div>
        <div class="kb-card__footer">
          <span>📁 {{ kb.fileCount }} 个文件</span>
          <span>·</span>
          <span>📊 {{ kb.chunkCount }} 个分块</span>
          <span class="card-action" @click.stop="goDetail(kb.id)">查看详情 →</span>
        </div>
      </article>
    </div>

    <el-empty v-if="!loading && kbs.length === 0" description="还没有知识库，点击右上角创建第一个">
      <el-button type="primary" @click="openCreateDialog">创建知识库</el-button>
    </el-empty>
  </GlassCard>

  <!-- 创建知识库 -->
  <el-dialog v-model="createVisible" title="创建 AI 知识库" width="640">
    <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
      <el-form-item label="知识库名称" prop="name">
        <el-input v-model="createForm.name" placeholder="如：舆情危机公关术语库" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="说明本知识库的用途" />
      </el-form-item>
      <el-form-item label="行业领域">
        <el-select v-model="createForm.domain" style="width: 100%">
          <el-option label="通用 (general)" value="general" />
          <el-option label="科技 (technology)" value="technology" />
          <el-option label="金融 (finance)" value="finance" />
          <el-option label="医疗 (medical)" value="medical" />
          <el-option label="法律 (legal)" value="legal" />
          <el-option label="教育 (education)" value="education" />
          <el-option label="媒体 (media)" value="media" />
        </el-select>
      </el-form-item>
      <el-form-item label="标签">
        <el-input
          v-model="createForm.tagsText"
          placeholder="多个标签用逗号分隔，如：舆情,公关,危机"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createVisible = false">取消</el-button>
      <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineOptions({ name: 'KnowledgeBasesPage' });
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface KbItem {
  id: number;
  name: string;
  description: string | null;
  domain: string | null;
  tags: string[] | null;
  fileCount: number;
  chunkCount: number;
  totalChars: string | number;
  aiScore: number | null;
  aiSummary: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const router = useRouter();
const kbs = ref<KbItem[]>([]);
const loading = ref(false);
const searchText = ref('');
const statusFilter = ref('');

const createVisible = ref(false);
const creating = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({
  name: '',
  description: '',
  domain: 'media',
  tagsText: '',
});
const createRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};

function statusLabel(s: string): string {
  return ({ draft: '草稿', processing: '处理中', ready: '已就绪', disabled: '已禁用' } as Record<string, string>)[s] || s;
}

function statusType(s: string): 'info' | 'warning' | 'success' | 'danger' {
  return ({ draft: 'info', processing: 'warning', ready: 'success', disabled: 'danger' } as any)[s] || 'info';
}

function domainIcon(d: string | null): string {
  const m: Record<string, string> = {
    technology: '💻',
    finance: '💰',
    medical: '🏥',
    legal: '⚖️',
    education: '📚',
    media: '📺',
    general: '🌐',
  };
  return m[d || 'general'] || '📁';
}

function domainColor(d: string | null): string {
  const m: Record<string, string> = {
    technology: 'linear-gradient(135deg, #5E72E4, #7C3AED)',
    finance: 'linear-gradient(135deg, #10B981, #059669)',
    medical: 'linear-gradient(135deg, #EF4444, #DC2626)',
    legal: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    education: 'linear-gradient(135deg, #F59E0B, #D97706)',
    media: 'linear-gradient(135deg, #EC4899, #BE185D)',
    general: 'linear-gradient(135deg, #6B7280, #4B5563)',
  };
  return m[d || 'general'];
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const res = await http.get('/admin/knowledge', {
      params: {
        page: 1,
        pageSize: 50,
        status: statusFilter.value || undefined,
        q: searchText.value || undefined,
      },
    });
    kbs.value = res.items || [];
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function goDetail(id: number): void {
  router.push(`/knowledge/${id}`);
}

function openCreateDialog(): void {
  Object.assign(createForm, {
    name: '',
    description: '',
    domain: 'media',
    tagsText: '',
  });
  createVisible.value = true;
}

async function onCreate(): Promise<void> {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return;
    creating.value = true;
    try {
      const tags = createForm.tagsText
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      await http.post('/admin/knowledge', {
        name: createForm.name,
        description: createForm.description || undefined,
        domain: createForm.domain || undefined,
        tags,
      });
      ElMessage.success('创建成功，请上传文档激活');
      createVisible.value = false;
      loadData();
    } catch (err: any) {
      ElMessage.error(err?.message || '创建失败');
    } finally {
      creating.value = false;
    }
  });
}

onMounted(loadData);
</script>

<style scoped>
.toolbar {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.kb-card {
  padding: 18px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-normal);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kb-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: 0 12px 40px rgba(0, 5, 30, 0.4), 0 0 24px rgba(94, 114, 228, 0.15);
}

.kb-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.kb-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.kb-card__meta {
  flex: 1;
  min-width: 0;
}

.kb-card__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kb-card__score {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--gradient-cool);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
}

.kb-card__desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}

.kb-card__ai-summary {
  font-size: 12px;
  color: var(--text-tertiary);
  background: rgba(94, 114, 228, 0.08);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: flex-start;
  gap: 6px;
  line-height: 1.5;
}

.ai-tag {
  background: var(--gradient-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}

.kb-card__tags {
  min-height: 24px;
}

.kb-card__footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-tertiary);
}

.card-action {
  margin-left: auto;
  color: var(--color-primary-light);
  font-weight: 500;
}
</style>
