import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import BasicLayout from '@/layouts/BasicLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: BasicLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表盘' },
      },
      {
        path: 'projects',
        name: 'Projects',
        component: () => import('@/views/ProjectList.vue'),
        meta: { title: '项目管理' },
      },
      {
        path: 'projects/:id/documents',
        name: 'ProjectDocuments',
        component: () => import('@/views/DocumentList.vue'),
        meta: { title: '文档管理' },
      },
      {
        path: 'documents',
        name: 'Documents',
        component: () => import('@/views/DocumentList.vue'),
        meta: { title: '文档管理' },
      },
      {
        path: 'golden-dataset',
        name: 'GoldenDataset',
        component: () => import('@/views/GoldenDataset.vue'),
        meta: { title: '黄金数据集' },
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
