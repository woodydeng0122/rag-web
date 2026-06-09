<template>
  <div class="layout-root">
    <!-- 全局启动 Loading — 骨架屏匹配最终布局形态 -->
    <div v-if="activeProjectStore.appLoading" class="app-loading">
      <div class="app-loading__sider">
        <div class="app-loading__logo">
          <a-skeleton-avatar :size="28" shape="square" active />
          <a-skeleton-input :style="{ width: '80px' }" active size="small" />
        </div>
        <div class="app-loading__menu">
          <a-skeleton v-for="i in 4" :key="i" :paragraph="{ rows: 0 }" active />
        </div>
      </div>
      <div class="app-loading__main">
        <div class="app-loading__header">
          <a-skeleton-input :style="{ width: '120px' }" active size="small" />
          <a-skeleton-button active size="small" />
          <a-skeleton-avatar :size="24" active />
        </div>
        <div class="app-loading__content">
          <a-skeleton active :paragraph="{ rows: 4 }" />
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
          background: '#001529',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
        }"
      >
        <div class="logo" @click="router.push('/dashboard')">
          <div class="logo-icon">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
              <rect width="32" height="32" rx="8" fill="var(--ant-color-primary)" />
              <path d="M10 11h12M10 16h8M10 21h10" stroke="var(--ant-color-text-light-solid)" stroke-width="2" stroke-linecap="round" />
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
          overflow: 'hidden',
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
            <home-outlined v-if="activeProjectStore.activeProject" class="header-project-icon" />
            <span v-if="activeProjectStore.activeProject" class="active-project-name">
              {{ activeProjectStore.activeProject.name }}
            </span>
            <span v-else class="no-active-project">未选择项目</span>
          </div>
          <div class="header-right">

            <a-button @click="handleRefresh" style="margin-right: 8px">
              <template #icon><reload-outlined /></template>
              刷新
            </a-button>
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
  BarChartOutlined,
  HomeOutlined,
  MessageOutlined,
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
    if (path.includes('/evaluation')) {
      selectedKeys.value = ['/evaluation']
    } else {
      const base = path.split('/').slice(0, 2).join('/') || '/dashboard'
      selectedKeys.value = [base === '/' ? '/dashboard' : base]
    }
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
    key: '/golden',
    icon: () => h(TrophyOutlined),
    label: '黄金数据集',
  },
  {
    key: '/evaluation',
    icon: () => h(BarChartOutlined),
    label: '评估历史',
  },
  {
    key: '/qa',
    icon: () => h(MessageOutlined),
    label: '智能问答',
  },
  {
    key: '/embed-models',
    icon: () => h(RobotOutlined),
    label: '模型配置',
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

  if (path.startsWith('/golden')) {
    crumbs.push({ key: 'golden', title: '黄金数据集' })
  } else if (path.startsWith('/qa')) {
    crumbs.push({ key: 'qa', title: '智能问答' })
  } else if (path.startsWith('/embed-models')) {
    crumbs.push({ key: 'embed-models', title: '模型配置' })
  } else if (path.startsWith('/documents')) {
    crumbs.push({ key: 'documents', title: '文档管理' })
  } else if (path.startsWith('/projects') && path.includes('/evaluation')) {
    crumbs.push({ key: 'projects', title: '项目管理', link: '/projects' })
    crumbs.push({ key: 'evaluation', title: '评估历史' })
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
  if (key === '/evaluation') {
    const pid = activeProjectStore.activeProjectId
    if (pid) {
      router.push(`/projects/${pid}/evaluation`)
    } else {
      router.push('/projects')
    }
  } else {
    router.push(key)
  }
}

function handleRefresh() {
  pageStore.triggerRefresh()
}
</script>

<style scoped>
.layout-root {
  min-height: 100dvh;
  overflow-x: hidden;
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
  background: var(--ant-color-bg-layout);
}
.app-loading__header {
  height: 56px;
  background: var(--ant-color-bg-container);
  border-bottom: 1px solid var(--ant-color-border-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
}
.app-loading__content {
  padding: 24px 32px;
  flex: 1;
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
.side-menu :deep(.ant-menu-item-selected) {
  background: rgba(22, 119, 255, 0.18) !important;
  color: var(--ant-color-text-light-solid) !important;
  box-shadow: inset 3px 0 0 var(--ant-color-primary);
  transition: box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1), background 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.side-menu :deep(.ant-menu-item-selected .anticon) {
  color: var(--ant-color-text-light-solid) !important;
}

.trigger {
  font-size: 16px;
  color: var(--ant-color-text-secondary);
  cursor: pointer;
  transition: color 0.2s;
  flex-shrink: 0;
}
.trigger:hover {
  color: var(--ant-color-text);
}

.site-header {
  background: var(--ant-color-bg-container);
  border-bottom: 1px solid var(--ant-color-border-secondary);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  line-height: 56px;
  position: relative;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.header-center:hover {
  opacity: 0.7;
}
.header-project-icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--ant-color-primary);
}
.active-project-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ant-color-primary);
}
.no-active-project {
  font-size: 13px;
  color: var(--ant-color-text-quaternary);
}
.header-right {
  display: flex;
  align-items: center;
}
.header-right :deep(.anticon) {
  font-size: 16px;
  color: var(--ant-color-text-secondary);
  cursor: pointer;
  transition: color 0.2s;
}
.header-right :deep(.anticon):hover {
  color: var(--ant-color-text);
}
.header-breadcrumb {
  font-size: 14px;
}
.header-breadcrumb :deep(.ant-breadcrumb-link) {
  color: var(--ant-color-text-secondary);
}
.header-breadcrumb :deep(.ant-breadcrumb-separator) {
  color: var(--ant-color-border);
}

.site-content {
  padding: 24px 32px;
  flex: 1;
  background: var(--ant-color-bg-layout);
}
</style>
