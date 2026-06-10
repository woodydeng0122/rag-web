<template>
  <div>
    <PageToolbar title="用户管理">
      <a-button type="primary" @click="showCreateModal">
        <template #icon><plus-outlined /></template>
        新建用户
      </a-button>
    </PageToolbar>

    <a-table
      :columns="columns"
      :data-source="users"
      :loading="loading"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'created_at'">
          {{ record.created_at ? formatTime(record.created_at) : '-' }}
        </template>
        <template v-if="column.key === 'actions'">
          <a-space>
            <a-button size="small" @click="showEditModal(record)">修改密码</a-button>
            <a-popconfirm
              title="确定删除该用户？"
              ok-text="确定"
              cancel-text="取消"
              @confirm="handleDelete(record)"
            >
              <a-button size="small" danger :disabled="record.id === currentUserId">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新建用户 -->
    <a-modal
      v-model:open="createVisible"
      title="新建用户"
      @ok="handleCreate"
      :confirm-loading="createLoading"
    >
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="用户名" required>
          <a-input v-model:value="createForm.username" />
        </a-form-item>
        <a-form-item label="密码" required>
          <a-input-password v-model:value="createForm.password" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 修改密码 -->
    <a-modal
      v-model:open="editVisible"
      title="修改密码"
      @ok="handleUpdate"
      :confirm-loading="editLoading"
    >
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="新密码" required>
          <a-input-password v-model:value="editForm.password" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import PageToolbar from '@/components/PageToolbar.vue'
import { listUsers, createUser, updateUser, deleteUser, type UserInfo } from '@/api/user'
import { useUserStore } from '@/store/user'
import { formatRelativeTime } from '@/utils/time'

const userStore = useUserStore()
const currentUserId = computed(() => userStore.userInfo?.id || '')

const users = ref<UserInfo[]>([])
const loading = ref(false)

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  { title: '操作', key: 'actions', width: 200 },
]

// 新建
const createVisible = ref(false)
const createLoading = ref(false)
const createForm = ref({ username: '', password: '' })

function showCreateModal() {
  createForm.value = { username: '', password: '' }
  createVisible.value = true
}

async function handleCreate() {
  if (!createForm.value.username || !createForm.value.password) {
    message.warning('请填写用户名和密码')
    return
  }
  createLoading.value = true
  try {
    await createUser(createForm.value)
    message.success('创建成功')
    createVisible.value = false
    await fetchUsers()
  } finally {
    createLoading.value = false
  }
}

// 修改密码
const editVisible = ref(false)
const editLoading = ref(false)
const editForm = ref({ id: '', password: '' })

function showEditModal(record: UserInfo) {
  editForm.value = { id: record.id, password: '' }
  editVisible.value = true
}

async function handleUpdate() {
  if (!editForm.value.password) {
    message.warning('请输入新密码')
    return
  }
  editLoading.value = true
  try {
    await updateUser(editForm.value.id, { password: editForm.value.password })
    message.success('密码修改成功')
    editVisible.value = false
  } finally {
    editLoading.value = false
  }
}

// 删除
async function handleDelete(record: UserInfo) {
  await deleteUser(record.id)
  message.success('删除成功')
  await fetchUsers()
}

function formatTime(t: string): string {
  return formatRelativeTime(t)
}

async function fetchUsers() {
  loading.value = true
  try {
    users.value = await listUsers()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchUsers()
})
</script>
