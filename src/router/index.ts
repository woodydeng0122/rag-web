import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import BasicLayout from '@/layouts/BasicLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true },
  },
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
        path: 'golden',
        name: 'Golden',
        component: () => import('@/views/Golden.vue'),
        meta: { title: '黄金数据集' },
      },
      {
        path: 'projects/:id/evaluation',
        name: 'ProjectEvaluation',
        component: () => import('@/views/EvaluationHistory.vue'),
        meta: { title: '评估历史' },
      },
      {
        path: 'qa',
        name: 'QA',
        component: () => import('@/views/QA.vue'),
        meta: { title: '智能问答' },
      },
      {
        path: 'embed-models',
        name: 'EmbedModels',
        component: () => import('@/views/EmbedModelConfig.vue'),
        meta: { title: '模型配置' },
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/UserList.vue'),
        meta: { title: '用户管理' },
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

const TOKEN_KEY = 'rag_access_token'

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem(TOKEN_KEY)

  if (to.meta.public) {
    // 已登录访问登录页，跳转首页
    if (token && to.name === 'Login') {
      next({ path: '/dashboard' })
    } else {
      next()
    }
  } else {
    // 未登录访问受保护页面，跳转登录页
    if (!token) {
      next({ path: '/login', query: { redirect: to.fullPath } })
    } else {
      next()
    }
  }
})
