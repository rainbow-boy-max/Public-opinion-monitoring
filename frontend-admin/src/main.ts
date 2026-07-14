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
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import '@shared/styles/theme.css';
import '@shared/styles/element-overrides.css';
import '@shared/styles/notification.css';
import App from './App.vue';
import router from './router';
import { observePaint, setPerfToken, startMark, endMark } from './utils/perf-metrics';

const app = createApp(App);
app.use(createPinia());
app.use(router);

const components = [
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
];

for (const c of components) {
  app.use(c);
}

app.config.globalProperties.$message = ElMessage;
app.config.globalProperties.$notify = ElNotification;
app.config.globalProperties.$msgbox = ElMessageBox;

try {
  setPerfToken(localStorage.getItem('admin_token'));
} catch {
  /* ignore */
}

observePaint();

router.beforeEach(() => {
  startMark('route-switch');
});

router.afterEach(() => {
  endMark('route-switch');
});

app.mount('#app');
