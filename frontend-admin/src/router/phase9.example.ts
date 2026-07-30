/**
 * Phase 9 路由配置示例
 * 
 * 使用说明：
 * 将此文件中的路由配置添加到 src/router/index.ts 中
 */

import AdminLayout from '@/layouts/AdminLayout.vue'

export const phase9Routes = [
  {
    path: '/prediction',
    component: AdminLayout,
    redirect: '/prediction/dashboard',
    meta: {
      title: '趋势预测',
      icon: 'TrendCharts',
      roles: ['admin', 'user']
    },
    children: [
      {
        path: 'dashboard',
        name: 'PredictionDashboard',
        component: () => import('@/views/prediction/index.vue'),
        meta: {
          title: '趋势预测看板',
          icon: 'TrendCharts'
        }
      }
    ]
  },
  {
    path: '/attribution',
    component: AdminLayout,
    redirect: '/attribution/detail',
    meta: {
      title: '归因分析',
      icon: 'Connection',
      roles: ['admin', 'user']
    },
    children: [
      {
        path: 'detail/:eventId?',
        name: 'AttributionDetail',
        component: () => import('@/views/attribution/detail.vue'),
        meta: {
          title: '归因分析详情',
          icon: 'Connection'
        }
      }
    ]
  }
]

/**
 * 集成步骤：
 * 
 * 1. 在 src/router/index.ts 中导入此配置：
 *    import { phase9Routes } from './phase9.example'
 * 
 * 2. 将 phase9Routes 添加到路由数组：
 *    const routes = [
 *      // ... 其他路由
 *      ...phase9Routes,
 *    ]
 * 
 * 3. 安装依赖：
 *    cd frontend-admin
 *    pnpm add echarts
 *    # marked 已在 Phase 8 安装
 * 
 * 4. 重启前端开发服务器
 */
