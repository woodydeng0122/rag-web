<template>
  <div class="layout-root">
    <!-- 全局启动 Loading — 骨架屏匹配最终布局形态 -->
    <div v-if="activeProjectStore.appLoading" class="app-loading">
      <div class="app-loading__sider">
        <div class="app-loading__logo">
          <div class="skeleton-block skeleton-shimmer" style="width:28px;height:28px;border-radius:8px"></div>
          <div class="skeleton-block skeleton-shimmer" style="width:80px;height:16px;border-radius:4px"></div>
        </div>
        <div class="app-loading__menu">
          <div v-for="i in 4" :key="i" class="skeleton-block skeleton-shimmer" style="height:40px;border-radius:8px"></div>
        </div>
      </div>
      <div class="app-loading__main">
        <div class="app-loading__header">
          <div class="skeleton-block skeleton-shimmer" style="width:120px;height:16px;border-radius:4px"></div>
          <div class="skeleton-block skeleton-shimmer" style="width:80px;height:18px;border-radius:4px"></div>
          <div class="skeleton-block skeleton-shimmer" style="width:24px;height:24px;border-radius:50%"></div>
        </div>
        <div class="app-loading__content">
          <div class="skeleton-block skeleton-shimmer" style="width:160px;height:20px;border-radius:4px;margin-bottom:20px"></div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
            <div v-for="i in 4" :key="i" class="skeleton-block skeleton-shimmer" style="height:160px;border-radius:8px"></div>
          </div>
        </div>
      </div>
    </div>

    <a-layout v-else class="layout">
      <a-layout-sider
        v-model:collapsed="collapsed"
        collapsible
        width="240"
        collapsed-width="72"
        :trigger="null"
        :style="{
          height: '100dvh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: 'var(--sider-bg)',
          borderRight: '1px solid var(--sider-border)',
          overflow: 'hidden',
        }"
      >
        <div class="logo" @click="router.push('/dashboard')">
          <div class="logo-icon">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
              <rect width="32" height="32" rx="8" fill="var(--logo-bg)" />
              <path d="M10 11h12M10 16h8M10 21h10" stroke="#fff" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <span v-show="!collapsed" class="logo-text">RAG 管理端</span>
        </div>

        <a-menu
          v-model:selectedKeys="selectedKeys"
          mode="inline"
          :items="menuItems"
          :inline-collapsed="collapsed"
          class="side-menu"
          @click="handleMenuClick"
        />
      </a-layout-sider>

      <a-layout
        :style="{
          marginLeft: collapsed ? '72px' : '240px',
          transition: 'margin-left 0.2s cubic-bezier(0.2, 0, 0, 1)',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }"
      >
        <a-layout-header
          class="site-header"
          :style="{
            paddingLeft: collapsed ? '24px' : '32px',
            paddingRight: '32px',
            transition: 'padding 0.2s cubic-bezier(0.2, 0, 0, 1)',
          }"
        >
          <div class="header-left">
            <menu-unfold-outlined
              v-if="collapsed"
              class="trigger"
              @click="collapsed = !collapsed"
            />
            <menu-fold-outlined
              v-else
              class="trigger"
              @click="collapsed = !collapsed"
            />
            <a-breadcrumb class="header-breadcrumb">
              <a-breadcrumb-item v-for="crumb in breadcrumbs" :key="crumb.key">
                <component
                  :is="crumb.link ? 'a' : 'span'"
                  :href="crumb.link || undefined"
                  @click.prevent="crumb.link && router.push(crumb.link!)"
                >
                  {{ crumb.title }}
                </component>
              </a-breadcrumb-item>
            </a-breadcrumb>
          </div>
          <div class="header-center" @click="router.push('/projects')">
            <span v-if="activeProjectStore.activeProject" class="active-project-name">
              {{ activeProjectStore.activeProject.name }}
            </span>
            <span v-else class="no-active-project">未选择项目</span>
          </div>
          <div class="header-right">
            <a-tooltip placement="bottom" title="刷新">
              <reload-outlined @click="handleRefresh" />
            </a-tooltip>
          </div>
        </a-layout-header>

        <a-layout-content class="site-content">
          <router-view />
        </a-layout-content>
      </a-layout>
    </a-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePageStore } from '@/store/page'
import { useActiveProjectStore } from '@/store/activeProject'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  ProjectOutlined,
  FileTextOutlined,
  TrophyOutlined,
  ReloadOutlined,
  RobotOutlined,
} from '@ant-design/icons-vue'
import type { MenuProps } from 'ant-design-vue'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const pageStore = usePageStore()
const activeProjectStore = useActiveProjectStore()

const selectedKeys = ref<string[]>(['/dashboard'])

// setup 阶段立即加载激活项目（不依赖 onMounted）
activeProjectStore.fetchActiveProject()

// Sync selectedKeys with current route
watch(
  () => route.path,
  (path) => {
    const base = path.split('/').slice(0, 2).join('/') || '/dashboard'
    selectedKeys.value = [base === '/' ? '/dashboard' : base]
  },
  { immediate: true },
)

const menuItems = computed<MenuProps['items']>(() => [
  {
    key: '/dashboard',
    icon: () => h(DashboardOutlined),
    label: '仪表盘',
  },
  {
    key: '/embed-models',
    icon: () => h(RobotOutlined),
    label: '模型配置',
  },
  {
    key: '/projects',
    icon: () => h(ProjectOutlined),
    label: '项目管理',
  },
  {
    key: '/documents',
    icon: () => h(FileTextOutlined),
    label: '文档管理',
  },
  {
    key: '/golden-dataset',
    icon: () => h(TrophyOutlined),
    label: '黄金数据集',
  },
])

interface BreadcrumbItem {
  key: string
  title: string
  link?: string
}

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const crumbs: BreadcrumbItem[] = []
  const path = route.path

  if (path.startsWith('/golden-dataset')) {
    crumbs.push({ key: 'golden-dataset', title: '黄金数据集' })
  } else if (path.startsWith('/embed-models')) {
    crumbs.push({ key: 'embed-models', title: '模型配置' })
  } else if (path.startsWith('/documents')) {
    crumbs.push({ key: 'documents', title: '文档管理' })
  } else if (path.startsWith('/projects')) {
    crumbs.push({ key: 'projects', title: '项目管理' })
  } else if (path.startsWith('/dashboard') || path === '/') {
    crumbs.push({ key: 'dashboard', title: '仪表盘' })
  } else {
    crumbs.push({ key: 'unknown', title: (route.meta.title as string) || '' })
  }

  return crumbs
})

function handleMenuClick({ key }: { key: string }) {
  router.push(key)
}

function handleRefresh() {
  pageStore.triggerRefresh()
}
</script>

<style scoped>
.layout-root {
  min-height: 100dvh;
}

/* 全局启动骨架屏 */
.app-loading {
  display: flex;
  min-height: 100dvh;
}
.app-loading__sider {
  width: 240px;
  flex-shrink: 0;
  background: #001529;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.app-loading__logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 4px 16px;
}
.app-loading__menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.app-loading__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}
.app-loading__header {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
}
.app-loading__content {
  padding: 24px 32px;
  flex: 1;
}

.skeleton-block {
  background: #e8e8e8;
}
.app-loading__sider .skeleton-block {
  background: rgba(255, 255, 255, 0.08);
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.55; }
  100% { opacity: 1; }
}
.skeleton-shimmer {
  animation: shimmer 1.8s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: none;
  }
}

/* Layout styles */
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.logo:hover {
  opacity: 0.85;
}
.logo-icon {
  flex-shrink: 0;
}
.logo-text {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.side-menu {
  background: transparent !important;
  border: none !important;
  padding: 8px;
  color: rgba(255, 255, 255, 0.75) !important;
}
.side-menu :deep(.ant-menu-item) {
  border-radius: 8px;
  margin-bottom: 2px;
  height: 40px;
  line-height: 40px;
  color: rgba(255, 255, 255, 0.75) !important;
}
.side-menu :deep(.ant-menu-item:hover) {
  background: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 1) !important;
}
.side-menu :deep(.ant-menu-item .anticon) {
  color: rgba(255, 255, 255, 0.75) !important;
}
.side-menu :deep(.ant-menu-item:hover .anticon) {
  color: rgba(255, 255, 255, 1) !important;
}

.trigger {
  font-size: 16px;
  color: #666;
  cursor: pointer;
  transition: color 0.2s;
  flex-shrink: 0;
}
.trigger:hover {
  color: #111;
}

.site-header {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  line-height: 56px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-center {
  cursor: pointer;
  transition: opacity 0.2s;
}
.header-center:hover {
  opacity: 0.7;
}
.active-project-name {
  font-size: 14px;
  font-weight: 600;
  color: #1677ff;
}
.no-active-project {
  font-size: 13px;
  color: #bbb;
}
.header-right {
  display: flex;
  align-items: center;
}
.header-right :deep(.anticon) {
  font-size: 16px;
  color: #666;
  cursor: pointer;
  transition: color 0.2s;
}
.header-right :deep(.anticon):hover {
  color: #111;
}
.header-breadcrumb {
  font-size: 14px;
}
.header-breadcrumb :deep(.ant-breadcrumb-link) {
  color: #666;
}
.header-breadcrumb :deep(.ant-breadcrumb-separator) {
  color: #d9d9d9;
}

.site-content {
  padding: 24px 32px;
  flex: 1;
  background: #fafafa;
}

:deep(.ant-menu-item-selected) {
  background: var(--menu-selected-bg) !important;
  color: var(--menu-selected-color) !important;
}
:deep(.ant-menu-item-selected .anticon) {
  color: var(--menu-selected-color) !important;
}
</style>

<style>
:root {
  --sider-bg: #001529;
  --sider-border: rgba(255, 255, 255, 0.06);
  --logo-bg: #1677ff;
  --menu-selected-bg: rgba(22, 119, 255, 0.12);
  --menu-selected-color: #1677ff;
}
</style>
