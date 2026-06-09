import { reactive } from 'vue'

export function usePagination(options?: { pageSizeOptions?: string[] }) {
  const paginationConfig = reactive({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`,
    pageSizeOptions: options?.pageSizeOptions ?? ['10', '20', '50'],
    onChange: (page: number) => {
      paginationConfig.current = page
    },
    onShowSizeChange: (_current: number, size: number) => {
      paginationConfig.pageSize = size
      paginationConfig.current = 1
    },
  })

  return paginationConfig
}
