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
      itemSelectedBg: 'rgba(22, 119, 255, 0.12)',
      itemSelectedColor: '#1677ff',
      itemHoverBg: 'rgba(255, 255, 255, 0.08)',
      itemHoverColor: '#fff',
    },
  },
}
</script>

<style>
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
