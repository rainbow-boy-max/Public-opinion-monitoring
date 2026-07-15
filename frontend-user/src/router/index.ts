import { createRouter, createWebHistory } from 'vue-router';
import { useUserAuthStore } from '@/store/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      component: () => import('@/pages/RegisterPage.vue'),
      meta: { public: true },
    },
    {
      path: '/verify',
      component: () => import('@/pages/RealNameVerifyPage.vue'),
      meta: { requiresAuth: true, requiresVerification: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/UserLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: 'dashboard',
          component: () => import('@/pages/DashboardPage.vue'),
        },
        {
          path: 'tasks',
          component: () => import('@/pages/MonitorTasksPage.vue'),
        },
        {
          path: 'tasks/:id',
          component: () => import('@/pages/MonitorTaskDetailPage.vue'),
        },
        {
          path: 'webhooks',
          component: () => import('@/pages/WebhooksPage.vue'),
        },
        {
          path: 'realtime',
          component: () => import('@/pages/RealtimeScreenPage.vue'),
        },
        {
          path: 'pr',
          component: () => import('@/pages/PrReportsPage.vue'),
        },
        {
          path: 'profile',
          component: () => import('@/pages/ProfilePage.vue'),
        },
        {
          path: 'alert',
          component: () => import('@/pages/AlertPage.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const auth = useUserAuthStore();
  if (to.meta.public) {
    next();
    return;
  }
  if (!auth.token) {
    next('/login');
    return;
  }
  if (auth.user?.authStatus !== 'verified' && to.path !== '/verify') {
    next('/verify');
    return;
  }
  next();
});

export default router;
