<template>
  <a-config-provider :locale="locale" :theme="theme">
    <a-app>
      <router-view />
    </a-app>
  </a-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { theme as antdTheme } from 'ant-design-vue'

dayjs.locale('zh-cn')

const locale = ref(zhCN)
const theme = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#0891B2',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    borderRadius: 8,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    fontSize: 14,
    fontFamilyCode: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace",
  },
  components: {
    Menu: {
      itemBorderRadius: 8,
      itemMarginInline: 0,
      itemMarginBlock: 2,
      itemHeight: 40,
      itemSelectedBg: 'rgba(8, 145, 178, 0.08)',
      itemSelectedColor: '#0891B2',
      itemHoverBg: 'rgba(8, 145, 178, 0.04)',
      itemHoverColor: '#0891B2',
    },
  },
}
</script>

<style>
:root {
  /* Color - Primary (Cyan/Teal) */
  --ant-color-primary: #0891B2;
  --ant-color-primary-bg: #ECFEFF;
  --ant-color-primary-border: #67E8F9;
  /* Color - Success */
  --ant-color-success: #10B981;
  --ant-color-success-bg: #ECFDF5;
  --ant-color-success-border: #6EE7B7;
  /* Color - Warning */
  --ant-color-warning: #F59E0B;
  --ant-color-warning-bg: #FFFBEB;
  --ant-color-warning-border: #FCD34D;
  /* Color - Error */
  --ant-color-error: #EF4444;
  --ant-color-error-bg: #FEF2F2;
  --ant-color-error-border: #FCA5A5;
  /* Color - Text */
  --ant-color-text: rgba(22, 78, 99, 0.92);
  --ant-color-text-secondary: rgba(22, 78, 99, 0.62);
  --ant-color-text-tertiary: rgba(22, 78, 99, 0.40);
  --ant-color-text-quaternary: rgba(22, 78, 99, 0.22);
  --ant-color-text-light-solid: #fff;
  /* Color - BG */
  --ant-color-bg-container: #ffffff;
  --ant-color-bg-layout: #ffffff;
  /* Color - Border */
  --ant-color-border: #D1E7E9;
  --ant-color-border-secondary: #E5F2F3;
  /* Color - Fill */
  --ant-color-fill-quaternary: rgba(8, 145, 178, 0.03);
  /* Sidebar */
  --sidebar-bg: #FAFCFC;
  --sidebar-border: #E5F2F3;
  --sidebar-text: rgba(22, 78, 99, 0.72);
  --sidebar-text-hover: #0891B2;
  --sidebar-text-active: #0891B2;
  --sidebar-item-hover-bg: rgba(8, 145, 178, 0.06);
  --sidebar-item-active-bg: rgba(8, 145, 178, 0.10);
  /* Font */
  --ant-font-size: 14px;
  --ant-font-size-sm: 12px;
  --ant-font-family-code: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  /* Border Radius */
  --ant-border-radius: 8px;
  --ant-border-radius-sm: 4px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
}
</style>
