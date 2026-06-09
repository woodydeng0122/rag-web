import { ref } from 'vue'
import { message } from 'ant-design-vue'

export interface CrudModalOptions<T> {
  defaultForm: () => T
  createApi: (form: T) => Promise<any>
  updateApi: (id: string, form: Partial<T>) => Promise<any>
  successMessage?: { create?: string; update?: string }
  errorMessage?: { create?: string; update?: string }
  afterSubmit?: () => Promise<void>
}

export function useCrudModal<T>(options: CrudModalOptions<T>) {
  const modalVisible = ref(false)
  const submitLoading = ref(false)
  const isEdit = ref(false)
  const editingId = ref('')
  const formState = ref<T>(options.defaultForm())

  function openCreate() {
    isEdit.value = false
    editingId.value = ''
    formState.value = options.defaultForm()
    modalVisible.value = true
  }

  function openEdit(id: string, form: Partial<T>) {
    isEdit.value = true
    editingId.value = id
    formState.value = { ...options.defaultForm(), ...form }
    modalVisible.value = true
  }

  async function handleSubmit(validate?: (form: T) => string | null) {
    if (validate) {
      const error = validate(formState.value)
      if (error) {
        message.warning(error)
        return
      }
    }

    submitLoading.value = true
    try {
      if (isEdit.value) {
        await options.updateApi(editingId.value, formState.value)
        message.success(options.successMessage?.update ?? '更新成功')
      } else {
        await options.createApi(formState.value)
        message.success(options.successMessage?.create ?? '创建成功')
      }
      modalVisible.value = false
      await options.afterSubmit?.()
    } catch {
      message.error(
        isEdit.value
          ? (options.errorMessage?.update ?? '更新失败')
          : (options.errorMessage?.create ?? '创建失败')
      )
    } finally {
      submitLoading.value = false
    }
  }

  return {
    modalVisible,
    submitLoading,
    isEdit,
    editingId,
    formState,
    openCreate,
    openEdit,
    handleSubmit,
  }
}
