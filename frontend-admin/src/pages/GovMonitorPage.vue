<template>
  <GlassCard title="官网监测配置" subtitle="政府官网变更监测与异常发现">
    <template #extra>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增站点</el-button>
      <el-button type="success" :icon="Promotion" :loading="checkingAll" @click="onCheckAll">全量检查</el-button>
      <el-button :icon="Refresh" :loading="loading" @click="onRefresh">刷新</el-button>
    </template>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="监测站点" name="sites">
        <div class="toolbar">
          <el-select v-model="siteFilters.status" placeholder="状态" clearable style="width: 120px" @change="loadSites">
            <el-option label="启用" value="active" />
            <el-option label="暂停" value="paused" />
          </el-select>
          <el-select v-model="siteFilters.siteType" placeholder="站点类型" clearable style="width: 140px" @change="loadSites">
            <el-option label="本单位" value="self" />
            <el-option label="上级单位" value="superior" />
            <el-option label="同级单位" value="peer" />
            <el-option label="政策法规" value="policy" />
          </el-select>
        </div>

        <el-table :data="sites" v-loading="loading" stripe>
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="siteName" label="站点名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="url" label="URL" min-width="200" show-overflow-tooltip />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ typeLabel(row.siteType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="频率" width="80">
            <template #default="{ row }">{{ row.checkFrequency }}min</template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                {{ row.status === 'active' ? '启用' : '暂停' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最后检查" width="170">
            <template #default="{ row }">{{ row.lastCheckedAt ? formatDateTime(row.lastCheckedAt) : '从未' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button text type="primary" size="small" :loading="checkingId === row.id" @click="onCheckSite(row)">检查</el-button>
              <el-button text type="warning" size="small" @click="openEditDialog(row)">编辑</el-button>
              <el-button text type="danger" size="small" @click="onDeleteSite(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="sitesTotal > 0" class="pagination-wrap">
          <el-pagination v-model:current-page="sitePage" v-model:page-size="sitePageSize" :total="sitesTotal" layout="total, prev, pager, next" small @change="loadSites" />
        </div>
      </el-tab-pane>

      <el-tab-pane name="changes">
        <template #label>
          变更记录
          <el-badge v-if="unreadCount > 0" :value="unreadCount" :max="99" class="tab-badge" />
        </template>

        <div class="toolbar">
          <el-select v-model="changeFilters.siteId" placeholder="选择站点" clearable filterable style="width: 200px" @change="loadChanges">
            <el-option v-for="s in allSites" :key="s.id" :label="s.siteName" :value="s.id" />
          </el-select>
          <el-select v-model="changeFilters.isRead" placeholder="读取状态" clearable style="width: 120px" @change="loadChanges">
            <el-option label="未读" :value="false" />
            <el-option label="已读" :value="true" />
          </el-select>
          <el-button type="primary" @click="onMarkAllRead">全部已读</el-button>
        </div>

        <el-table :data="changes" v-loading="changesLoading" stripe>
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="站点" width="140">
            <template #default="{ row }">{{ siteNameMap[row.siteId] || `#${row.siteId}` }}</template>
          </el-table-column>
          <el-table-column prop="title" label="变更标题" min-width="240" show-overflow-tooltip />
          <el-table-column label="链接" width="80">
            <template #default="{ row }">
              <el-link v-if="row.linkUrl" :href="row.linkUrl" target="_blank" type="primary" size="small">查看</el-link>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="row.changeType === 'new' ? 'success' : row.changeType === 'updated' ? 'warning' : 'danger'" size="small">
                {{ changeTypeLabel(row.changeType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="检测时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.detectedAt) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.isRead ? 'info' : 'danger'" size="small">{{ row.isRead ? '已读' : '未读' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button text type="primary" size="small" @click="openChangeDrawer(row)">详情</el-button>
              <el-button v-if="!row.isRead" text type="success" size="small" @click="onMarkRead(row)">已读</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="changesTotal > 0" class="pagination-wrap">
          <el-pagination v-model:current-page="changePage" v-model:page-size="changePageSize" :total="changesTotal" layout="total, prev, pager, next" small @change="loadChanges" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="siteDialogVisible" :title="editingSite ? '编辑站点' : '新增站点'" width="560" @closed="resetSiteForm">
      <el-form :model="siteForm" label-width="100px">
        <el-form-item label="站点名称" required>
          <el-input v-model="siteForm.siteName" placeholder="如：区政府门户网站" />
        </el-form-item>
        <el-form-item label="URL" required>
          <el-input v-model="siteForm.url" placeholder="https://www.example.gov.cn" />
        </el-form-item>
        <el-form-item label="站点类型">
          <el-radio-group v-model="siteForm.siteType">
            <el-radio value="self">本单位</el-radio>
            <el-radio value="superior">上级单位</el-radio>
            <el-radio value="peer">同级单位</el-radio>
            <el-radio value="policy">政策法规</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="CSS 选择器">
          <el-input v-model="siteForm.cssSelector" placeholder="如：.news-list（留空则抓取全页链接）" />
        </el-form-item>
        <el-form-item label="检查频率">
          <el-input-number v-model="siteForm.checkFrequency" :min="1" :max="1440" controls-position="right" />
          <span class="form-hint">分钟（1-1440）</span>
        </el-form-item>
        <el-form-item v-if="editingSite" label="状态">
          <el-radio-group v-model="siteForm.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="paused">暂停</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="siteDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSaveSite">{{ editingSite ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="changeDrawerVisible" title="变更详情" size="480px" direction="rtl">
      <div v-if="changeDetail" class="change-detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="变更 ID">#{{ changeDetail.id }}</el-descriptions-item>
          <el-descriptions-item label="站点">{{ siteNameMap[changeDetail.siteId] || `#${changeDetail.siteId}` }}</el-descriptions-item>
          <el-descriptions-item label="变更类型">
            <el-tag :type="changeDetail.changeType === 'new' ? 'success' : changeDetail.changeType === 'updated' ? 'warning' : 'danger'" size="small">
              {{ changeTypeLabel(changeDetail.changeType) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="检测时间">{{ formatDateTime(changeDetail.detectedAt) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="changeDetail.isRead ? 'info' : 'danger'" size="small">{{ changeDetail.isRead ? '已读' : '未读' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="内容指纹"><code>{{ changeDetail.contentHash }}</code></el-descriptions-item>
        </el-descriptions>
        <div class="change-detail__title">{{ changeDetail.title }}</div>
        <div v-if="changeDetail.snippet" class="change-detail__snippet">{{ changeDetail.snippet }}</div>
        <el-link v-if="changeDetail.linkUrl" :href="changeDetail.linkUrl" target="_blank" type="primary">查看原文链接</el-link>
      </div>
    </el-drawer>
  </GlassCard>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminGovMonitorPage' });
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Promotion } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const activeTab = ref('sites');
const loading = ref(false);
const changesLoading = ref(false);
const checkingAll = ref(false);
const checkingId = ref<number | null>(null);
const saving = ref(false);

const sites = ref<any[]>([]);
const allSites = ref<any[]>([]);
const sitesTotal = ref(0);
const sitePage = ref(1);
const sitePageSize = ref(20);
const siteFilters = reactive({ status: '', siteType: '' });

const changes = ref<any[]>([]);
const changesTotal = ref(0);
const changePage = ref(1);
const changePageSize = ref(20);
const changeFilters = reactive<{ siteId: number | ''; isRead: boolean | '' }>({ siteId: '', isRead: '' });

const siteNameMap = computed(() => {
  const m: Record<number, string> = {};
  for (const s of allSites.value) m[s.id] = s.siteName;
  return m;
});
const unreadCount = computed(() => changes.value.filter((c) => !c.isRead).length);

const siteDialogVisible = ref(false);
const editingSite = ref<any>(null);
const siteForm = reactive({
  siteName: '',
  url: '',
  siteType: 'self' as 'self' | 'superior' | 'peer' | 'policy',
  cssSelector: '',
  checkFrequency: 60,
  status: 'active' as 'active' | 'paused',
});

const changeDrawerVisible = ref(false);
const changeDetail = ref<any>(null);
function openChangeDrawer(row: any): void {
  changeDetail.value = row;
  changeDrawerVisible.value = true;
}

function typeLabel(t: string): string {
  return t === 'self' ? '本单位' : t === 'superior' ? '上级' : t === 'peer' ? '同级' : '政策';
}
function changeTypeLabel(t: string): string {
  return t === 'new' ? '新增' : t === 'updated' ? '更新' : '移除';
}
function formatDateTime(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function onRefresh(): void {
  loadSites();
  loadChanges();
}

async function loadSites(): Promise<void> {
  loading.value = true;
  try {
    const params: any = { page: sitePage.value, pageSize: sitePageSize.value };
    if (siteFilters.status) params.status = siteFilters.status;
    if (siteFilters.siteType) params.siteType = siteFilters.siteType;
    const res = await http.get('/gov/monitor/site', { params });
    const payload = (res && (res.data || res.items)) || [];
    sites.value = Array.isArray(payload) ? payload : [];
    sitesTotal.value = res?.total || 0;
  } catch {
    ElMessage.error('加载站点失败');
  } finally {
    loading.value = false;
  }
}

async function loadAllSites(): Promise<void> {
  try {
    const res = await http.get('/gov/monitor/site', { params: { page: 1, pageSize: 100 } });
    const payload = (res && (res.data || res.items)) || [];
    allSites.value = Array.isArray(payload) ? payload : [];
  } catch { /* ignore */ }
}

async function loadChanges(): Promise<void> {
  changesLoading.value = true;
  try {
    const params: any = { page: changePage.value, pageSize: changePageSize.value };
    if (changeFilters.siteId !== '') params.siteId = changeFilters.siteId;
    if (changeFilters.isRead !== '') params.isRead = changeFilters.isRead;
    const res = await http.get('/gov/monitor/change', { params });
    const payload = (res && (res.data || res.items)) || [];
    changes.value = Array.isArray(payload) ? payload : [];
    changesTotal.value = res?.total || 0;
  } catch {
    ElMessage.error('加载变更记录失败');
  } finally {
    changesLoading.value = false;
  }
}

function openCreateDialog(): void {
  editingSite.value = null;
  siteForm.siteName = '';
  siteForm.url = '';
  siteForm.siteType = 'self';
  siteForm.cssSelector = '';
  siteForm.checkFrequency = 60;
  siteForm.status = 'active';
  siteDialogVisible.value = true;
}

function openEditDialog(row: any): void {
  editingSite.value = row;
  siteForm.siteName = row.siteName;
  siteForm.url = row.url;
  siteForm.siteType = row.siteType;
  siteForm.cssSelector = row.cssSelector || '';
  siteForm.checkFrequency = row.checkFrequency;
  siteForm.status = row.status;
  siteDialogVisible.value = true;
}

function resetSiteForm(): void {
  editingSite.value = null;
}

async function onSaveSite(): Promise<void> {
  if (!siteForm.siteName || !siteForm.url) {
    ElMessage.warning('请填写站点名称和 URL');
    return;
  }
  saving.value = true;
  try {
    const payload: any = {
      siteName: siteForm.siteName,
      url: siteForm.url,
      siteType: siteForm.siteType,
      cssSelector: siteForm.cssSelector || undefined,
      checkFrequency: siteForm.checkFrequency,
    };
    if (editingSite.value) {
      payload.status = siteForm.status;
      await http.put(`/gov/monitor/site/${editingSite.value.id}`, payload);
      ElMessage.success('更新成功');
    } else {
      await http.post('/gov/monitor/site', payload);
      ElMessage.success('创建成功');
    }
    siteDialogVisible.value = false;
    await loadSites();
    await loadAllSites();
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

async function onDeleteSite(row: any): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除站点「${row.siteName}」？`, '确认', { type: 'warning' });
    await http.delete(`/gov/monitor/site/${row.id}`);
    ElMessage.success('已删除');
    await loadSites();
    await loadAllSites();
  } catch { /* ignore */ }
}

async function onCheckSite(row: any): Promise<void> {
  checkingId.value = row.id;
  try {
    const res = await http.post(`/gov/monitor/site/${row.id}/check`);
    ElMessage.success(res.message || '检查完成');
    await loadSites();
    if (activeTab.value === 'changes') await loadChanges();
  } catch {
    ElMessage.error('检查失败');
  } finally {
    checkingId.value = null;
  }
}

async function onCheckAll(): Promise<void> {
  checkingAll.value = true;
  try {
    const res = await http.post('/gov/monitor/check-all');
    ElMessage.success(res.message || '批量检查完成');
    await loadSites();
    await loadChanges();
  } catch {
    ElMessage.error('批量检查失败');
  } finally {
    checkingAll.value = false;
  }
}

async function onMarkRead(row: any): Promise<void> {
  try {
    await http.post(`/gov/monitor/change/${row.id}/read`);
    row.isRead = true;
  } catch {
    ElMessage.error('操作失败');
  }
}

async function onMarkAllRead(): Promise<void> {
  try {
    const siteId = changeFilters.siteId !== '' ? changeFilters.siteId : undefined;
    const res = await http.post('/gov/monitor/change/read-all', { siteId });
    ElMessage.success(res.message || '已全部标记为已读');
    await loadChanges();
  } catch {
    ElMessage.error('操作失败');
  }
}

onMounted(() => {
  loadSites();
  loadAllSites();
  loadChanges();
});
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
.form-hint { margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.tab-badge { margin-left: 4px; }
.change-detail { padding: 0 4px; }
.change-detail__title { font-weight: 600; margin: 12px 0 8px; font-size: 15px; color: var(--el-text-color-primary); }
.change-detail__snippet { color: var(--el-text-color-regular); line-height: 1.7; font-size: 13px; background: var(--el-fill-color-light); padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; white-space: pre-wrap; }
</style>
