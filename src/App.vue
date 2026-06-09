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
    colorPrimary: '#1677ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
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
      itemSelectedBg: 'rgba(22, 119, 255, 0.38)',
      itemSelectedColor: '#fff',
      itemHoverBg: 'rgba(255, 255, 255, 0.08)',
      itemHoverColor: '#fff',
    },
  },
}
</script>

<style>
:root {
  /* Color - Primary */
  --ant-color-primary: #1677ff;
  --ant-color-primary-bg: #e6f4ff;
  --ant-color-primary-border: #91caff;
  /* Color - Success */
  --ant-color-success: #52c41a;
  --ant-color-success-bg: #f6ffed;
  --ant-color-success-border: #b7eb8f;
  /* Color - Warning */
  --ant-color-warning: #faad14;
  --ant-color-warning-bg: #fffbe6;
  --ant-color-warning-border: #ffe58f;
  /* Color - Error */
  --ant-color-error: #ff4d4f;
  --ant-color-error-bg: #fff2f0;
  --ant-color-error-border: #ffccc7;
  /* Color - Text */
  --ant-color-text: rgba(0, 0, 0, 0.88);
  --ant-color-text-secondary: rgba(0, 0, 0, 0.65);
  --ant-color-text-tertiary: rgba(0, 0, 0, 0.45);
  --ant-color-text-quaternary: rgba(0, 0, 0, 0.25);
  --ant-color-text-light-solid: #fff;
  /* Color - BG */
  --ant-color-bg-container: #ffffff;
  --ant-color-bg-layout: #f5f5f5;
  /* Color - Border */
  --ant-color-border: #d9d9d9;
  --ant-color-border-secondary: #f0f0f0;
  /* Color - Fill */
  --ant-color-fill-quaternary: rgba(0, 0, 0, 0.02);
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
