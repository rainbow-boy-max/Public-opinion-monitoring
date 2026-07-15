import { createRouter, createWebHistory } from 'vue-router';
import { useAdminAuthStore } from '@/store/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/change-password',
      component: () => import('@/pages/ChangePasswordPage.vue'),
      meta: { requiresPasswordChange: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      children: [
        {
          path: 'dashboard',
          component: () => import('@/pages/DashboardPage.vue'),
        },
        {
          path: 'users',
          component: () => import('@/pages/UserManagementPage.vue'),
        },
        {
          path: 'agents',
          component: () => import('@/pages/AgentsPage.vue'),
        },
        {
          path: 'agent-templates',
          component: () => import('@/pages/AgentTemplatesPage.vue'),
        },
        {
          path: 'agents/new',
          name: 'agent-new',
          component: () => import('@/pages/AgentDetailPage.vue'),
        },
        {
          path: 'agents/:id',
          component: () => import('@/pages/AgentDetailPage.vue'),
        },
        {
          path: 'llm-models',
          component: () => import('@/pages/LlmModelsManagementPage.vue'),
        },
        {
          path: 'knowledge',
          component: () => import('@/pages/KnowledgeBasesPage.vue'),
        },
        {
          path: 'knowledge/:id',
          component: () => import('@/pages/KnowledgeBaseDetailPage.vue'),
        },
        {
          path: 'sms-templates',
          component: () => import('@/pages/SmsTemplatesPage.vue'),
        },
        {
          path: 'config/aliyun-sms',
          component: () => import('@/pages/AliyunSmsConfigPage.vue'),
        },
        {
          path: 'config/aliyun-verify',
          component: () => import('@/pages/AliyunVerifyConfigPage.vue'),
        },
        {
          path: 'config/web-search',
          component: () => import('@/pages/WebSearchConfigPage.vue'),
        },
        {
          path: 'config/kb-scoring',
          component: () => import('@/pages/KbScoringConfigPage.vue'),
        },
        {
          path: 'config/tts',
          component: () => import('@/pages/TtsConfigPage.vue'),
        },
        {
          path: 'config/hot-topics',
          component: () => import('@/pages/HotTopicsConfigPage.vue'),
        },
        {
          path: 'system-logs',
          component: () => import('@/pages/SystemLogsPage.vue'),
        },
        {
          path: 'comparison',
          component: () => import('@/pages/ComparisonPage.vue'),
        },
        {
          path: 'competitor-tracking',
          component: () => import('@/pages/CompetitorTrackingPage.vue'),
        },
        {
          path: 'hot-topics',
          component: () => import('@/pages/HotTopicsPage.vue'),
        },
        {
          path: 'alert',
          component: () => import('@/pages/AlertCenterPage.vue'),
        },
        {
          path: 'keyword-extension',
          component: () => import('@/pages/KeywordExtensionPage.vue'),
        },
        {
          path: 'custom-dashboard',
          component: () => import('@/pages/CustomDashboardPage.vue'),
        },
        {
          path: 'short-video',
          component: () => import('@/pages/ShortVideoPage.vue'),
        },
        {
          path: 'sentiment',
          component: () => import('@/pages/SentimentConfigPage.vue'),
        },
        {
          path: 'work-orders',
          component: () => import('@/pages/WorkOrdersPage.vue'),
        },
        {
          path: 'brand-reputation',
          component: () => import('@/pages/BrandReputationPage.vue'),
        },
        {
          path: 'knowledge-graph',
          component: () => import('@/pages/KnowledgeGraphPage.vue'),
        },
        {
          path: 'config/knowledge-graph',
          component: () => import('@/pages/KnowledgeGraphConfigPage.vue'),
        },
        {
          path: 'tenants',
          component: () => import('@/pages/TenantsPage.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const auth = useAdminAuthStore();
  if (to.meta.public) {
    next();
    return;
  }
  if (!auth.token) {
    next('/login');
    return;
  }
  if (auth.user?.firstLogin && to.path !== '/change-password') {
    next('/change-password');
    return;
  }
  next();
});

export default router;
