<template>
  <a-layout class="layout">
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
</template>

<script setup lang="ts">
import { ref, computed, h, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePageStore } from '@/store/page'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  ProjectOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import type { MenuProps } from 'ant-design-vue'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const pageStore = usePageStore()

const selectedKeys = ref<string[]>(['/dashboard'])

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
    key: '/projects',
    icon: () => h(ProjectOutlined),
    label: '项目管理',
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

  // Always show dashboard or projects as first crumb
  if (path.startsWith('/projects/') && path.includes('/documents')) {
    const projectName = (route.query as any).name as string
    crumbs.push({ key: 'projects', title: '项目管理', link: '/projects' })
    if (projectName) {
      crumbs.push({ key: 'project', title: projectName, link: '/projects' })
    }
    crumbs.push({ key: 'documents', title: '文档列表' })
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
/* Layout-level CSS variables driven by AntDV theme */
:root {
  --sider-bg: #001529;
  --sider-border: rgba(255, 255, 255, 0.06);
  --logo-bg: #1677ff;
  --menu-selected-bg: rgba(22, 119, 255, 0.12);
  --menu-selected-color: #1677ff;
}
</style>
