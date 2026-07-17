<template>
  <div class="export-config-page">
    <GlassCard title="导出配置" subtitle="全局导出格式与模板设置">
      <el-form label-width="160px" label-position="left">
        <el-form-item label="默认导出格式">
          <el-select v-model="defaultFormat" style="width: 240px">
            <el-option label="CSV" value="csv" />
            <el-option label="JSON" value="json" />
            <el-option label="Markdown" value="md" />
            <el-option label="PDF" value="pdf" />
            <el-option label="Word" value="docx" />
            <el-option label="Excel" value="xlsx" />
          </el-select>
          <div class="form-item-hint">全局导出对话框默认选中的格式</div>
        </el-form-item>

        <el-form-item label="包含表头">
          <el-switch v-model="includeHeader" />
          <div class="form-item-hint">CSV/Excel 导出时是否包含列名行</div>
        </el-form-item>

        <el-form-item label="日期格式">
          <el-select v-model="dateFormat" style="width: 240px">
            <el-option label="YYYY-MM-DD" value="YYYY-MM-DD" />
            <el-option label="YYYY/MM/DD" value="YYYY/MM/DD" />
            <el-option label="DD/MM/YYYY" value="DD/MM/YYYY" />
            <el-option label="MM/DD/YYYY" value="MM/DD/YYYY" />
          </el-select>
        </el-form-item>

        <el-form-item label="字符编码">
          <el-select v-model="encoding" style="width: 240px">
            <el-option label="UTF-8 (BOM)" value="utf8-bom" />
            <el-option label="UTF-8" value="utf8" />
            <el-option label="GBK" value="gbk" />
          </el-select>
        </el-form-item>

        <el-form-item label="文件命名规则">
          <el-input v-model="namingRule" placeholder="{type}_{date}" style="width: 360px" />
          <div class="form-item-hint">支持 {type}、{date}、{time}、{taskName} 变量</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="onSave">保存配置</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </GlassCard>

    <GlassCard title="导出模板" subtitle="预设的导出模板，一键应用">
      <el-table :data="templates" stripe size="small">
        <el-table-column prop="name" label="模板名称" width="180" />
        <el-table-column prop="format" label="格式" width="100" />
        <el-table-column prop="description" label="描述" min-width="240" show-overflow-tooltip />
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="applyTemplate(row)">应用</el-button>
            <el-button type="danger" link size="small" @click="deleteTemplate(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="template-actions">
        <el-button type="primary" plain size="small" @click="showAddTemplate = true">+ 新增模板</el-button>
      </div>
    </GlassCard>

    <GlassCard title="导出历史" subtitle="最近 30 条导出记录">
      <el-table :data="history" stripe size="small" v-loading="historyLoading">
        <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="format" label="格式" width="80" align="center" />
        <el-table-column prop="fileSize" label="大小" width="100" align="center">
          <template #default="{ row }">{{ formatSize(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column label="来源" width="100" align="center">
          <template #default="{ row }">{{ row.source || '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="导出时间" width="170" align="center">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </GlassCard>

    <el-dialog v-model="showAddTemplate" title="新增导出模板" width="500">
      <el-form :model="templateForm" label-width="100px">
        <el-form-item label="模板名称">
          <el-input v-model="templateForm.name" placeholder="例如：日报模板" />
        </el-form-item>
        <el-form-item label="导出格式">
          <el-select v-model="templateForm.format" style="width: 100%">
            <el-option label="CSV" value="csv" />
            <el-option label="JSON" value="json" />
            <el-option label="Markdown" value="md" />
            <el-option label="PDF" value="pdf" />
            <el-option label="Word" value="docx" />
            <el-option label="Excel" value="xlsx" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="templateForm.description" type="textarea" :rows="3" placeholder="模板用途说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddTemplate = false">取消</el-button>
        <el-button type="primary" @click="onAddTemplate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const defaultFormat = ref('csv');
const includeHeader = ref(true);
const dateFormat = ref('YYYY-MM-DD');
const encoding = ref('utf8-bom');
const namingRule = ref('{type}_{date}');

const templates = ref<Array<{ id: number; name: string; format: string; description: string }>>([]);
const history = ref<Array<{ filename: string; format: string; fileSize: number; source: string; createdAt: string; status: string }>>([]);
const historyLoading = ref(false);
const showAddTemplate = ref(false);
const templateForm = ref({ name: '', format: 'csv', description: '' });

function formatSize(bytes: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function onSave(): Promise<void> {
  try {
    await http.post('/export/config', {
      defaultFormat: defaultFormat.value,
      includeHeader: includeHeader.value,
      dateFormat: dateFormat.value,
      encoding: encoding.value,
      namingRule: namingRule.value,
    });
    ElMessage.success('配置已保存');
  } catch {
    ElMessage.error('保存失败');
  }
}

function onReset(): void {
  defaultFormat.value = 'csv';
  includeHeader.value = true;
  dateFormat.value = 'YYYY-MM-DD';
  encoding.value = 'utf8-bom';
  namingRule.value = '{type}_{date}';
  ElMessage.success('已重置为默认值');
}

async function loadTemplates(): Promise<void> {
  try {
    const res = await http.get('/export/templates');
    templates.value = res.items || [];
  } catch {
    templates.value = [
      { id: 1, name: '舆情日报', format: 'md', description: '每日舆情数据的 Markdown 格式报告' },
      { id: 2, name: '对比分析报告', format: 'pdf', description: '多维对比分析的 PDF 格式报告' },
      { id: 3, name: '事件数据表', format: 'xlsx', description: '舆情事件数据的 Excel 表格' },
    ];
  }
}

async function loadHistory(): Promise<void> {
  historyLoading.value = true;
  try {
    const res = await http.get('/export/history', { params: { page: 1, pageSize: 30 } });
    history.value = res.items || [];
  } catch {
    history.value = [];
  } finally {
    historyLoading.value = false;
  }
}

function applyTemplate(row: any): void {
  defaultFormat.value = row.format;
  ElMessage.success(`已应用模板「${row.name}」`);
}

async function deleteTemplate(row: any): Promise<void> {
  try {
    await http.delete(`/export/templates/${row.id}`);
    ElMessage.success('已删除');
    await loadTemplates();
  } catch {
    ElMessage.error('删除失败');
  }
}

async function onAddTemplate(): Promise<void> {
  if (!templateForm.value.name.trim()) {
    ElMessage.warning('请输入模板名称');
    return;
  }
  try {
    await http.post('/export/templates', templateForm.value);
    ElMessage.success('模板已创建');
    showAddTemplate.value = false;
    templateForm.value = { name: '', format: 'csv', description: '' };
    await loadTemplates();
  } catch {
    ElMessage.error('创建失败');
  }
}

onMounted(() => {
  loadTemplates();
  loadHistory();
});
</script>

<style scoped>
.export-config-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-item-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.template-actions {
  margin-top: 16px;
}
</style>
