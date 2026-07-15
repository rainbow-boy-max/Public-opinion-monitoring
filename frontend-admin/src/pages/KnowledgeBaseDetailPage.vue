<template>
  <div class="kb-detail" v-if="kb">
    <GlassCard :title="kb.name" :icon="domainIcon(kb.domain)" :subtitle="kb.description || 'AI 知识库详情'">
      <template #extra>
        <el-button @click="$router.push('/knowledge')">返回列表</el-button>
      </template>

      <el-tabs v-model="activeTab" class="kb-tabs">
        <!-- Tab 1: 总览 -->
        <el-tab-pane label="总览" name="overview">
          <div class="overview-grid">
            <StatCard
              label="文件数"
              :value="kb.fileCount"
              icon="📁"
              icon-bg="var(--gradient-primary)"
              glow="rgba(94, 114, 228, 0.3)"
            />
            <StatCard
              label="分块数"
              :value="kb.chunkCount"
              icon="📊"
              icon-bg="var(--gradient-cool)"
              glow="rgba(6, 182, 212, 0.3)"
            />
            <StatCard
              label="总字符数"
              :value="kb.totalChars"
              icon="🔤"
              icon-bg="var(--gradient-warm)"
              glow="rgba(245, 158, 11, 0.3)"
            />
            <StatCard
              label="AI 评分"
              :value="kb.aiScore !== null ? Math.round(kb.aiScore) : '—'"
              icon="⭐"
              icon-bg="linear-gradient(135deg, #10B981, #059669)"
              glow="rgba(16, 185, 129, 0.3)"
            />
          </div>

          <el-card shadow="never" class="meta-card" style="margin-top: 20px">
            <template #header>基本信息</template>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="名称">{{ kb.name }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="statusType(kb.status)">{{ statusLabel(kb.status) }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="行业领域">
                <code class="code-text">{{ kb.domain || '—' }}</code>
              </el-descriptions-item>
              <el-descriptions-item label="标签">
                <el-tag
                  v-for="t in kb.tags || []"
                  :key="t"
                  size="small"
                  effect="dark"
                  type="info"
                  style="margin-right: 4px"
                >{{ t }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="AI 摘要" :span="2">
                {{ kb.aiSummary || '（AI 尚未生成摘要）' }}
              </el-descriptions-item>
            </el-descriptions>
            <div style="margin-top: 16px; text-align: right">
              <el-button :icon="MagicStick" @click="onAutoClassify" :loading="autoClassifying">
                AI 重新分类与摘要
              </el-button>
              <el-button :icon="Refresh" @click="onRefreshStats" style="margin-left: 8px">
                刷新统计
              </el-button>
            </div>
          </el-card>
        </el-tab-pane>

        <!-- Tab 2: 文件管理 -->
        <el-tab-pane label="文件管理" name="files">
      <el-upload
        :show-file-list="false"
        :before-upload="beforeUpload"
        :http-request="onUpload"
        :data="{ kbId: kbId }"
        accept=".pdf,.docx,.pptx,.ppt,.txt,.md,.html"
        drag
        class="kb-uploader"
      >
        <div class="upload-zone">
          <div class="upload-icon">📤</div>
          <div class="upload-text">点击或拖拽文件到此处上传</div>
          <div class="upload-hint">支持 PDF / Word / PowerPoint / TXT / Markdown / HTML</div>
          <div class="upload-hint">上传后自动执行 AI 解析 · AI 打分 · AI 摘要 · 向量化</div>
          <div class="upload-hint">单文件最大 100MB</div>
        </div>
      </el-upload>

      <el-progress
        v-if="uploading"
        :percentage="uploadProgress"
        :status="uploadProgress === 100 ? 'success' : undefined"
        :stroke-width="8"
        style="margin: 12px 0"
      />

      <el-table :data="files" v-loading="loading" style="margin-top: 20px" stripe>
            <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip />
            <el-table-column prop="fileType" label="类型" width="80">
              <template #default="{ row }">
                <el-tag size="small">{{ row.fileType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="fileSize" label="大小" width="100">
              <template #default="{ row }">
                {{ formatBytes(row.fileSize) }}
              </template>
            </el-table-column>
            <el-table-column prop="chunkCount" label="分块" width="80" />
            <el-table-column prop="aiScore" label="AI 评分" width="100">
              <template #default="{ row }">
                <span v-if="row.aiScore !== null" :class="['ai-score', scoreLevel(row.aiScore)]">
                  {{ Math.round(row.aiScore) }}
                </span>
                <span v-else class="empty-text">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="fileStatusType(row.status)" effect="dark" size="small">
                  {{ fileStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="parsedSummary" label="AI 摘要" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.parsedSummary" class="summary-text">{{ row.parsedSummary }}</span>
                <span v-else class="empty-text">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="parsedAt" label="解析时间" width="160">
              <template #default="{ row }">
                <span class="mono" style="color: var(--text-tertiary)">
                  {{ row.parsedAt ? new Date(row.parsedAt).toLocaleString('zh-CN') : '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="onPreviewFile(row)">预览</el-button>
                <el-button size="small" type="danger" @click="onDeleteFile(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 文件预览/编辑 dialog -->
        <el-dialog
          v-model="previewVisible"
          :title="previewFile?.filename || '文件预览'"
          width="80%"
          top="5vh"
        >
          <div style="display: flex; gap: 12px; margin-bottom: 12px">
            <el-button
              v-if="previewFile?.status === 'ready'"
              :loading="savingContent"
              type="primary"
              @click="onSavePreview"
            >保存修改</el-button>
            <el-button @click="onRefreshPreview">刷新</el-button>
            <el-tag v-if="previewFile" style="margin-left: auto">
              {{ formatBytes(previewFile.fileSize) }}
            </el-tag>
          </div>
          <el-input
            v-if="previewFile"
            v-model="previewContent"
            type="textarea"
            :rows="20"
            style="font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; font-size: 13px;"
            placeholder="加载中..."
          />
        </el-dialog>

        <!-- Tab 3: AI 检索测试 -->
        <el-tab-pane label="AI 检索测试" name="search">
          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
            <template #title>RAG 检索测试</template>
            输入任意问题，系统会从知识库中按余弦相似度检索最相关的文档片段，可用于验证 AI 能否在对话中正确引用知识库内容。
          </el-alert>
          <el-input
            v-model="searchInput"
            type="textarea"
            :rows="3"
            placeholder="输入测试问题，如：舆情危机处理的黄金时间是多久？"
          />
          <div style="margin: 12px 0">
            <el-button type="primary" :icon="Search" :loading="searching" @click="onSearch">
              执行检索
            </el-button>
          </div>
          <div v-if="searchResults.length > 0" class="search-results">
            <article
              v-for="(r, i) in searchResults"
              :key="i"
              class="result-item"
            >
              <div class="result-item__head">
                <span class="result-item__rank">#{{ i + 1 }}</span>
                <span class="result-item__score">相似度 {{ (r.score * 100).toFixed(1) }}%</span>
                <span class="result-item__source">{{ r.source }}</span>
              </div>
              <div class="result-item__content">{{ r.content }}</div>
            </article>
          </div>
          <el-empty
            v-else-if="searchDone"
            description="没有检索到匹配内容，可尝试不同问题"
          />
        </el-tab-pane>
      </el-tabs>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'KnowledgeBaseDetailPage' });
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, ElProgress } from 'element-plus';
import { MagicStick, Refresh, Search, Download, EditPen } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import StatCard from '@shared/components/StatCard.vue';

const route = useRoute();
const router = useRouter();
const kbId = computed(() => Number(route.params.id) || 0);
const activeTab = ref('overview');

const kb = ref<any>(null);
const files = ref<any[]>([]);
const loading = ref(false);
const autoClassifying = ref(false);

const searchInput = ref('');
const searching = ref(false);
const searchDone = ref(false);
const searchResults = ref<any[]>([]);

const uploading = ref(false);
const uploadProgress = ref(0);
const previewVisible = ref(false);
const previewFile = ref<any>(null);
const previewContent = ref('');
const savingContent = ref(false);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return val < 10 ? val.toFixed(1) + ' ' + units[i] : Math.round(val) + ' ' + units[i];
}

function statusLabel(s: string): string {
  return ({ draft: '草稿', processing: '处理中', ready: '已就绪', disabled: '已禁用' } as Record<string, string>)[s] || s;
}

function statusType(s: string): 'info' | 'warning' | 'success' | 'danger' {
  return ({ draft: 'info', processing: 'warning', ready: 'success', disabled: 'danger' } as any)[s] || 'info';
}

function fileStatusLabel(s: string): string {
  return ({
    pending: '排队中', parsing: '解析中', parsed: '已解析',
    embedding: '向量化中', ready: '已就绪', failed: '失败',
  } as Record<string, string>)[s] || s;
}

function fileStatusType(s: string): 'info' | 'warning' | 'success' | 'danger' {
  return ({
    pending: 'info', parsing: 'warning', parsed: 'success',
    embedding: 'warning', ready: 'success', failed: 'danger',
  } as any)[s] || 'info';
}

function scoreLevel(s: number): string {
  if (s >= 80) return 'score--high';
  if (s >= 60) return 'score--mid';
  return 'score--low';
}

function domainIcon(d: string | null): string {
  const m: Record<string, string> = {
    technology: '💻', finance: '💰', medical: '🏥', legal: '⚖️',
    education: '📚', media: '📺', general: '🌐',
  };
  return m[d || 'general'] || '📚';
}

async function loadKb(): Promise<void> {
  if (!kbId.value) return;
  try {
    kb.value = await http.get(`/admin/knowledge/${kbId.value}`);
  } catch (err) {
    ElMessage.error('加载知识库失败');
    router.push('/knowledge');
  }
}

async function loadFiles(): Promise<void> {
  if (!kbId.value) return;
  loading.value = true;
  try {
    files.value = await http.get(`/admin/knowledge/${kbId.value}/files`);
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function beforeUpload(file: any): boolean {
  const allowed = ['pdf', 'docx', 'ppt', 'pptx', 'txt', 'md', 'html'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!allowed.includes(ext)) {
    ElMessage.warning(`不支持 .${ext} 格式`);
    return false;
  }
  if (file.size > 100 * 1024 * 1024) {
    ElMessage.warning('文件不能超过 100MB');
    return false;
  }
  return true;
}

async function onUpload(options: any): Promise<void> {
  const { file, onSuccess, onError } = options;
  const form = new FormData();
  form.append('file', file);
  // 显式传递 UTF-8 文件名，防止后端 latin-1 截断
  form.append('filename_utf8', file.name);
  uploading.value = true;
  uploadProgress.value = 0;
  try {
    const res = await http.post(`/admin/knowledge/${kbId.value}/upload`, form, {
      transformRequest: (data: any) => data,
      headers: { 'Content-Type': undefined },
      onUploadProgress: (e: any) => {
        if (e.total) uploadProgress.value = Math.round((e.loaded / e.total) * 100);
      },
    });
    await new Promise((r) => setTimeout(r, 300)); // 等进度条到 100%
    ElMessage.success(res.message || '上传成功');
    onSuccess(res);
    uploading.value = false;
    loadFiles();
    loadKb();
  } catch (err: any) {
    uploading.value = false;
    ElMessage.error(err?.message || '上传失败');
    onError(err);
  }
}

async function onDeleteFile(row: any): Promise<void> {
  await ElMessageBox.confirm(
    `确认删除文件 "${row.filename}"？该文件的所有分块也会被清除。`,
    '删除确认',
    { type: 'warning' },
  );
  try {
    await http.delete(`/admin/knowledge/${kbId.value}/files/${row.id}`);
    ElMessage.success('已删除');
    loadFiles();
    loadKb();
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败');
  }
}

async function onPreviewFile(row: any): Promise<void> {
  previewFile.value = row;
  previewContent.value = '';
  previewVisible.value = true;
  try {
    const res = await http.get(`/admin/knowledge/${kbId.value}/files/${row.id}/content`);
    previewContent.value = res.content || '';
  } catch (err: any) {
    previewContent.value = `// 加载失败: ${err?.message || '未知错误'}`;
  }
}

async function onSavePreview(): Promise<void> {
  if (!previewFile.value) return;
  savingContent.value = true;
  try {
    await http.put(`/admin/knowledge/${kbId.value}/files/${previewFile.value.id}/content`, {
      content: previewContent.value,
    });
    ElMessage.success('已保存');
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    savingContent.value = false;
  }
}

async function onRefreshPreview(): Promise<void> {
  if (!previewFile.value) return;
  try {
    const res = await http.get(`/admin/knowledge/${kbId.value}/files/${previewFile.value.id}/content`);
    previewContent.value = res.content || '';
  } catch (err: any) {
    ElMessage.error(err?.message || '刷新失败');
  }
}

async function onAutoClassify(): Promise<void> {
  autoClassifying.value = true;
  try {
    await http.post(`/admin/knowledge/${kbId.value}/auto-classify`);
    await loadKb();
    ElMessage.success('AI 已重新分类');
  } catch (err: any) {
    ElMessage.error(err?.message || 'AI 分类失败');
  } finally {
    autoClassifying.value = false;
  }
}

async function onRefreshStats(): Promise<void> {
  try {
    await http.post(`/admin/knowledge/${kbId.value}/refresh`);
    await loadKb();
    ElMessage.success('统计已刷新');
  } catch (err: any) {
    ElMessage.error(err?.message || '刷新失败');
  }
}

async function onSearch(): Promise<void> {
  if (!searchInput.value.trim()) {
    ElMessage.warning('请输入检索问题');
    return;
  }
  searching.value = true;
  searchDone.value = false;
  try {
    const res = await http.get('/admin/knowledge/search', {
      params: { q: searchInput.value, topK: 5 },
    });
    searchResults.value = res.filter((r: any) => r.kbId === kbId.value);
    searchDone.value = true;
  } catch (err: any) {
    ElMessage.error(err?.message || '检索失败');
    searchDone.value = true;
  } finally {
    searching.value = false;
  }
}

watch(kbId, () => {
  if (kbId.value) {
    loadKb();
    loadFiles();
  }
});

onMounted(() => {
  loadKb();
  loadFiles();
});
</script>

<style scoped>
.kb-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kb-tabs :deep(.el-tabs__nav-wrap::after) { background: transparent; }
.kb-tabs :deep(.el-tabs__item) { color: var(--text-secondary); }
.kb-tabs :deep(.el-tabs__item.is-active) { color: var(--color-primary-light); }

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.meta-card {
  background: var(--glass-bg) !important;
  border: 1px solid var(--glass-border) !important;
  border-radius: var(--radius-lg) !important;
}

.meta-card :deep(.el-card__header) {
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font-weight: 600;
}

.kb-uploader {
  width: 100%;
}

.kb-uploader :deep(.el-upload) {
  width: 100%;
}

.kb-uploader :deep(.el-upload-dragger) {
  background: rgba(15, 19, 47, 0.4) !important;
  border: 1px dashed var(--border-medium) !important;
  padding: 32px;
}

.kb-uploader :deep(.el-upload-dragger:hover) {
  border-color: var(--color-primary) !important;
  background: rgba(94, 114, 228, 0.06) !important;
}

.upload-zone { text-align: center; }

.upload-icon {
  font-size: 36px;
  margin-bottom: 12px;
  opacity: 0.7;
}

.upload-text {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.ai-score {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
}

.ai-score.score--high { color: var(--color-success); background: var(--color-success-bg); }
.ai-score.score--mid { color: var(--color-warning); background: var(--color-warning-bg); }
.ai-score.score--low { color: var(--color-danger); background: var(--color-danger-bg); }

.empty-text {
  color: var(--text-tertiary);
  font-size: 12px;
}

.summary-text {
  font-size: 12px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.code-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-primary-light);
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-item {
  padding: 14px 16px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-subtle);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-md);
}

.result-item__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
}

.result-item__rank {
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.result-item__score {
  color: var(--color-primary-light);
  font-weight: 600;
}

.result-item__source {
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
  margin-left: auto;
}

.result-item__content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
