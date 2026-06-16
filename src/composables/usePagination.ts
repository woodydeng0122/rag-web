import { reactive } from 'vue'

export function usePagination() {
  const paginationConfig = reactive({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`,
    pageSizeOptions: ['10', '20', '50', '100'],
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
