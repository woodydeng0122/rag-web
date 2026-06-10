import { message } from 'ant-design-vue'

export interface BatchOptions<T = any> {
  concurrency?: number
  label?: string
  onProgress?: (remaining: number, batchResults: T[], batchSucceededIds: string[]) => void
}

/**
 * 批量执行异步操作，按并发数分批 Promise.allSettled
 * @param ids 待处理的 ID 列表
 * @param action 对每个 ID 执行的异步操作
 * @param options 配置项
 * @returns 成功的 ID 列表
 */
export async function batchExecute<T = any>(
  ids: string[],
  action: (id: string) => Promise<T>,
  options: BatchOptions<T> = {},
): Promise<string[]> {
  const { concurrency = 2, onProgress } = options
  const remaining = [...ids]
  let successCount = 0
  let failCount = 0
  const succeeded: string[] = []

  while (remaining.length > 0) {
    const batch = remaining.splice(0, concurrency)
    const results = await Promise.allSettled(batch.map(id => action(id)))
    const batchResults: T[] = []
    const batchSucceededIds: string[] = []
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        successCount++
        succeeded.push(batch[i])
        batchResults.push(results[i].value)
        batchSucceededIds.push(batch[i])
      } else {
        failCount++
      }
    }
    onProgress?.(remaining.length, batchResults, batchSucceededIds)
  }

  const label = options.label ?? '操作'
  if (failCount > 0) {
    message.warning(`${label}完成：${successCount} 条成功，${failCount} 条失败`)
  } else {
    message.success(`${label}完成：${successCount} 条成功`)
  }

  return succeeded
}
