/**
 * 报告管理路由配置示例
 * 
 * 使用说明：
 * 1. 将此文件中的路由配置复制到 src/router/index.ts 中
 * 2. 确保已导入 Layout 组件
 * 3. 将路由对象添加到 routes 数组中
 * 4. 根据项目实际情况调整路径和权限
 */

import AdminLayout from '@/layouts/AdminLayout.vue'

export const reportRoutes = {
  path: '/reports',
  component: AdminLayout,
  redirect: '/reports/list',
  meta: {
    title: '报告管理',
    icon: 'Document',
    roles: ['admin', 'user'] // 根据实际需求调整权限
  },
  children: [
    {
      path: 'list',
      name: 'ReportList',
      component: () => import('@/views/reports/index.vue'),
      meta: {
        title: '报告列表',
        icon: 'List'
      }
    },
    {
      path: 'create',
      name: 'ReportCreate',
      component: () => import('@/views/reports/create.vue'),
      meta: {
        title: '创建报告',
        icon: 'Plus',
        hidden: true // 不在侧边栏显示
      }
    },
    {
      path: 'detail/:id',
      name: 'ReportDetail',
      component: () => import('@/views/reports/detail.vue'),
      meta: {
        title: '报告详情',
        icon: 'View',
        hidden: true // 不在侧边栏显示
      }
    }
  ]
}

/**
 * 集成步骤：
 * 
 * 1. 在 src/router/index.ts 中导入此路由配置：
 *    import { reportRoutes } from './reports.example'
 * 
 * 2. 将 reportRoutes 添加到路由数组：
 *    const routes = [
 *      // ... 其他路由
 *      reportRoutes,
 *    ]
 * 
 * 3. 如果使用独立的菜单配置文件，添加菜单项：
 *    {
 *      path: '/reports',
 *      title: '报告管理',
 *      icon: 'Document',
 *      children: [
 *        {
 *          path: '/reports/list',
 *          title: '报告列表',
 *          icon: 'List'
 *        }
 *      ]
 *    }
 * 
 * 4. 重启前端开发服务器
 */
