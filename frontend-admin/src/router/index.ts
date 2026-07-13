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
          path: 'config/aliyun-sms',
          component: () => import('@/pages/AliyunSmsConfigPage.vue'),
        },
        {
          path: 'config/aliyun-verify',
          component: () => import('@/pages/AliyunVerifyConfigPage.vue'),
        },
        {
          path: 'system-logs',
          component: () => import('@/pages/SystemLogsPage.vue'),
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
