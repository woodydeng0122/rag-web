import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

export { dayjs }

export function formatTime(dateStr: string, fallbackFormat = 'YYYY-MM-DD HH:mm') {
  if (!dateStr) return '--'
  const d = dayjs(dateStr)
  const now = dayjs()
  const diffMs = now.diff(d, 'millisecond')
  if (diffMs < 60 * 1000) return '刚刚'
  if (diffMs < 3600 * 1000) return `${Math.floor(diffMs / 60000)} 分钟前`
  if (diffMs < 24 * 3600 * 1000) return `${Math.floor(diffMs / 3600000)} 小时前`
  if (diffMs < 7 * 24 * 3600 * 1000) return `${Math.floor(diffMs / 86400000)} 天前`
  return d.format(fallbackFormat)
}

export function formatFullTime(dateStr: string) {
  if (!dateStr) return '--'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss')
}
