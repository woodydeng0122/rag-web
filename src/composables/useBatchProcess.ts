import { ref } from 'vue'
import { message, Modal as AModal } from 'ant-design-vue'
import { batchExecute } from '@/utils/batch'

export interface BatchProcessOptions<T = any> {
  /** 选中的 ID 列表 */
  selectedRowKeys: () => string[]
  /** 更新选中 ID 列表 */
  setSelectedRowKeys: (keys: string[]) => void
  /** 判断某个 ID 是否可处理，返回 false 的会被跳过 */
  canProcess: (id: string) => boolean
  /** 对单个 ID 执行的异步操作 */
  action: (id: string) => Promise<T>
  /** 显示标签，默认"批量处理" */
  label?: string
  /** 不可处理项的描述，默认"已处理" */
  skipLabel?: string
  /** 每批完成后回调，参数为 (当前批次 action 返回结果列表, 当前批次成功的 ID 列表) */
  onBatchComplete?: (batchResults: T[], batchSucceededIds: string[]) => void
}

export function useBatchProcess<T = any>(options: BatchProcessOptions<T>) {
  const batchProcessing = ref(false)

  function handleBatchProcess() {
    const {
      selectedRowKeys: getKeys,
      setSelectedRowKeys,
      canProcess,
      action,
      label = '批量处理',
      skipLabel = '已处理',
      onBatchComplete,
    } = options

    const keys = getKeys()
    const skipIds = keys.filter(id => !canProcess(id))
    const processableIds = keys.filter(id => canProcess(id))

    if (processableIds.length === 0) {
      message.info(`选中的项均已${skipLabel}`)
      return
    }

    const skipHint = skipIds.length > 0 ? `（跳过 ${skipIds.length} 个${skipLabel}项）` : ''
    AModal.confirm({
      title: label,
      content: `确定要处理选中的 ${processableIds.length} 项吗？${skipHint}`,
      onOk() {
        batchProcessing.value = true
        const totalProcessable = processableIds.length

        void (async () => {
          const succeeded = await batchExecute(
            processableIds,
            action,
            {
              label,
              onProgress: (remaining, batchResults, batchSucceededIds) => {
                const completedCount = totalProcessable - remaining
                const completedIds = processableIds.slice(0, completedCount)
                setSelectedRowKeys(getKeys().filter(k => !completedIds.includes(k)))
                onBatchComplete?.(batchResults, batchSucceededIds)
              },
            },
          )
          setSelectedRowKeys(getKeys().filter(k => !succeeded.includes(k)))
          batchProcessing.value = false
        })()
      },
    })
  }

  return { batchProcessing, handleBatchProcess }
}
