import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export { dayjs }

export function formatTime(dateStr: string, fallbackFormat = 'YYYY-MM-DD HH:mm') {
  if (!dateStr) return '--'
  return dayjs(dateStr).fromNow()
}

export function formatFullTime(dateStr: string) {
  if (!dateStr) return '--'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss')
}
