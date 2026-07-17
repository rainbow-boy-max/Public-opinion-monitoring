<template>
  <div class="report-templates-page">
    <GlassCard title="报告模板市场" subtitle="选择预设模板或自定义配置，快速生成舆情报告">
      <template #extra>
        <el-button v-if="isAdmin" type="primary" :icon="Plus" size="small" @click="openCreateDialog">新建模板</el-button>
      </template>

      <div class="template-grid">
        <article
          v-for="tpl in templates"
          :key="tpl.id"
          class="template-card"
          :class="{ 'template-card--preset': tpl.isPreset }"
        >
          <div class="template-card__head">
            <span class="template-card__icon">{{ tpl.icon || '📄' }}</span>
            <el-tag
              :type="tpl.isPreset ? 'info' : 'warning'"
              size="small"
              effect="plain"
            >
              {{ tpl.isPreset ? '预设' : '自定义' }}
            </el-tag>
          </div>
          <h3 class="template-card__name">{{ tpl.name }}</h3>
          <p class="template-card__desc">{{ tpl.description }}</p>
          <div class="template-card__tags">
            <el-tag
              v-for="tag in parseTags(tpl)"
              :key="tag"
              :type="tagType(tag)"
              size="small"
            >
              {{ tag }}
            </el-tag>
          </div>
          <div class="template-card__actions">
            <el-button size="small" type="primary" @click="openGenerateDialog(tpl)">使用</el-button>
            <template v-if="!tpl.isPreset && isAdmin">
              <el-button size="small" @click="openEditDialog(tpl)">编辑</el-button>
              <el-button size="small" type="danger" @click="onDelete(tpl)">删除</el-button>
            </template>
          </div>
        </article>
      </div>

      <el-empty v-if="!loading && templates.length === 0" description="暂无模板" />
    </GlassCard>

    <el-dialog v-model="generateVisible" title="生成报告" width="560">
      <el-form :model="generateForm" label-width="100px">
        <el-form-item label="选择模板">
          <el-tag type="info">{{ generateForm.templateName }}</el-tag>
        </el-form-item>
        <el-form-item label="任务 ID">
          <el-select v-model="generateForm.taskIds" multiple placeholder="选择监控任务" style="width: 100%">
            <el-option v-for="t in monitorTasks" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="generateForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateVisible = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="onGenerate">生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" :title="editingTemplate ? '编辑模板' : '新建模板'" width="600">
      <el-form ref="formRef" :model="templateForm" :rules="formRules" label-width="100px">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model="templateForm.name" placeholder="例如：每日电商舆情报告" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="templateForm.description" type="textarea" :rows="3" placeholder="模板用途说明" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="templateForm.icon" placeholder="📄（选填）" />
        </el-form-item>
        <el-form-item label="报告类型" prop="config">
          <el-select v-model="templateForm.type" placeholder="选择报告类型" style="width: 100%">
            <el-option label="日报" value="daily" />
            <el-option label="周报" value="weekly" />
            <el-option label="事件专报" value="event" />
            <el-option label="竞品对标" value="competitor" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSaveTemplate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface ReportTemplate {
  id: number;
  name: string;
  description: string;
  icon?: string;
  type?: string;
  config?: string;
  isPreset?: boolean;
}

interface MonitorTask {
  id: number;
  name: string;
}

defineOptions({ name: 'AdminReportTemplatesPage' });

const loading = ref(false);
const templates = ref<ReportTemplate[]>([]);
const isAdmin = ref(true);
const monitorTasks = ref<MonitorTask[]>([]);

const presetTemplates: ReportTemplate[] = [
  { id: -1, name: '日报', description: '每日舆情数据汇总，涵盖声量趋势、情感分布和热门话题', icon: '📅', type: 'daily', isPreset: true },
  { id: -2, name: '周报', description: '每周舆情综合分析，包含竞品动态、传播路径和重点事件回顾', icon: '📊', type: 'weekly', isPreset: true },
  { id: -3, name: '事件专报', description: '针对特定事件的深度分析报告，包含事件脉络、传播路径和舆论影响评估', icon: '📋', type: 'event', isPreset: true },
  { id: -4, name: '竞品对标', description: '多品牌/多产品横向对比分析，覆盖声量、情感、渠道分布等维度', icon: '⚖️', type: 'competitor', isPreset: true },
  { id: -5, name: '自定义报告', description: '自由组合数据模块，按需定制报告内容和呈现方式', icon: '📝', type: 'custom', isPreset: true },
];

const generateVisible = ref(false);
const generating = ref(false);
const generateForm = reactive({
  templateId: 0,
  templateName: '',
  taskIds: [] as number[],
  dateRange: null as [Date, Date] | null,
});

const editVisible = ref(false);
const saving = ref(false);
const editingTemplate = ref<ReportTemplate | null>(null);
const formRef = ref<FormInstance>();
const templateForm = reactive({
  name: '',
  description: '',
  icon: '',
  type: 'daily' as string,
});

const formRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入描述', trigger: 'blur' }],
};

function parseTags(tpl: ReportTemplate): string[] {
  const tags: string[] = [];
  if (tpl.type) {
    const labelMap: Record<string, string> = {
      daily: '日报', weekly: '周报', event: '事件专报',
      competitor: '竞品对标', custom: '自定义',
    };
    tags.push(labelMap[tpl.type] || tpl.type);
  }
  return tags;
}

function tagType(tag: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, any> = {
    '日报': 'primary', '周报': 'success', '事件专报': 'warning',
    '竞品对标': 'danger', '自定义': 'info',
  };
  return map[tag] || 'info';
}

function openGenerateDialog(tpl: ReportTemplate): void {
  generateForm.templateId = tpl.id;
  generateForm.templateName = tpl.name;
  generateForm.taskIds = [];
  generateForm.dateRange = null;
  generateVisible.value = true;
  loadMonitorTasks();
}

async function loadMonitorTasks(): Promise<void> {
  try {
    monitorTasks.value = await http.get('/monitor-tasks');
  } catch {
    monitorTasks.value = [];
  }
}

async function onGenerate(): Promise<void> {
  if (generateForm.taskIds.length === 0) {
    ElMessage.warning('请至少选择一个监控任务');
    return;
  }
  generating.value = true;
  try {
    await http.post('/report-templates/generate', {
      templateId: generateForm.templateId,
      taskIds: generateForm.taskIds,
      startDate: generateForm.dateRange?.[0]?.toISOString(),
      endDate: generateForm.dateRange?.[1]?.toISOString(),
    });
    ElMessage.success('报告生成任务已提交');
    generateVisible.value = false;
  } catch (err: any) {
    ElMessage.error(err?.message || '生成失败');
  } finally {
    generating.value = false;
  }
}

function openCreateDialog(): void {
  editingTemplate.value = null;
  templateForm.name = '';
  templateForm.description = '';
  templateForm.icon = '';
  templateForm.type = 'daily';
  editVisible.value = true;
}

function openEditDialog(tpl: ReportTemplate): void {
  editingTemplate.value = tpl;
  templateForm.name = tpl.name;
  templateForm.description = tpl.description;
  templateForm.icon = tpl.icon || '';
  templateForm.type = tpl.type || 'daily';
  editVisible.value = true;
}

async function onSaveTemplate(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      const payload = {
        name: templateForm.name,
        description: templateForm.description,
        icon: templateForm.icon || undefined,
        type: templateForm.type,
      };
      if (editingTemplate.value) {
        await http.put(`/report-templates/${editingTemplate.value.id}`, payload);
        ElMessage.success('更新成功');
      } else {
        await http.post('/report-templates', payload);
        ElMessage.success('创建成功');
      }
      editVisible.value = false;
      await loadTemplates();
    } catch (err: any) {
      ElMessage.error(err?.message || '操作失败');
    } finally {
      saving.value = false;
    }
  });
}

async function onDelete(tpl: ReportTemplate): Promise<void> {
  await ElMessageBox.confirm(`确认删除模板 "${tpl.name}"?`, '操作确认', { type: 'warning' });
  try {
    await http.delete(`/report-templates/${tpl.id}`);
    ElMessage.success('已删除');
    await loadTemplates();
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败');
  }
}

async function loadTemplates(): Promise<void> {
  loading.value = true;
  try {
    const custom = await http.get('/report-templates');
    if (Array.isArray(custom)) {
      templates.value = [...presetTemplates, ...custom];
    } else {
      templates.value = presetTemplates;
    }
  } catch {
    templates.value = presetTemplates;
  } finally {
    loading.value = false;
  }
}

onMounted(loadTemplates);
</script>

<style scoped>
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.template-card {
  padding: 20px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
}

.template-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: 0 8px 30px rgba(0, 5, 30, 0.3);
}

.template-card--preset {
  border-left: 3px solid var(--color-primary);
}

.template-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.template-card__icon {
  font-size: 36px;
  line-height: 1;
  filter: drop-shadow(0 0 8px rgba(94, 114, 228, 0.3));
}

.template-card__name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px 0;
}

.template-card__desc {
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.6;
  margin: 0 0 12px 0;
  flex: 1;
}

.template-card__tags {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.template-card__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
