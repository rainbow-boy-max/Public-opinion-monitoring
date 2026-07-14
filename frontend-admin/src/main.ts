import { createApp } from 'vue';
import { createPinia } from 'pinia';
import {
  ElAlert,
  ElAside,
  ElButton,
  ElCard,
  ElCheckbox,
  ElCheckboxGroup,
  ElCollapse,
  ElCollapseItem,
  ElContainer,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElLink,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElRadio,
  ElRadioButton,
  ElRadioGroup,
  ElResult,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElTextarea,
  ElTimeline,
  ElTimelineItem,
  ElTooltip,
  ElUpload,
  ElMessage,
  ElMessageBox,
  ElNotification,
} from 'element-plus';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import '@shared/styles/theme.css';
import '@shared/styles/element-overrides.css';
import '@shared/styles/notification.css';
import App from './App.vue';
import router from './router';

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
  console.error('[admin app error]', info, err);
  const root = document.getElementById('app');
  if (root && !root.dataset.errorShown) {
    root.dataset.errorShown = '1';
    const msg =
      (err instanceof Error ? err.stack || err.message : String(err)) +
      '\n\ninfo: ' +
      info;
    root.innerHTML =
      '<pre style="padding:16px;background:#0a0e27;color:#f87171;white-space:pre-wrap;font-size:12px;line-height:1.4">App boot error:\n' +
      msg +
      '</pre>';
  }
};

window.addEventListener('error', (e) => {
  console.error('[admin window error]', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[admin unhandledrejection]', e.reason);
});

app.use(createPinia());
app.use(router);

// EP 2.14.3 实际命名为 ElTextarea 不存在；多行文本场景统一走 <el-input type="textarea">，
// 模板里没有 <el-textarea> 用法，无需注册。
const epComponents = [
  ElAlert,
  ElAside,
  ElButton,
  ElCard,
  ElCheckbox,
  ElCheckboxGroup,
  ElCollapse,
  ElCollapseItem,
  ElContainer,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElLink,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElRadio,
  ElRadioButton,
  ElRadioGroup,
  ElResult,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElTimeline,
  ElTimelineItem,
  ElTooltip,
  ElUpload,
];

for (const c of epComponents) {
  app.use(c);
}

// 兜底：按需注册 EP 2.14.3 子组件依赖（ElPopper / ElCollection / ElFocusTrap / ElAffix 等）
// 在 LlmModelsManagementPage el-tabs 切 tab 与 el-dropdown render 时若找不到子组件会触发
// TypeError: Cannot read properties of undefined (reading 'opaque')。
// 同步加载全量 EP 作兜底；保留按需循环以让 webpack manualChunks 把 vendor-element-plus 拆 chunk。
app.use(ElementPlus);

app.config.globalProperties.$message = ElMessage;
app.config.globalProperties.$notify = ElNotification;
app.config.globalProperties.$msgbox = ElMessageBox;

app.mount('#app');

// 性能埋点用 dynamic import + 失败保护，避免阻塞 mount
(async () => {
  try {
    const m = await import('./utils/perf-metrics');
    m.setPerfToken(localStorage.getItem('admin_token'));
    m.observePaint();
    router.beforeEach(() => m.startMark('route-switch'));
    router.afterEach(() => m.endMark('route-switch'));
  } catch (err) {
    console.warn('[admin perf-metrics skipped]', err);
  }
})();
