<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { showToast } from 'vant'
import { usePositionStore } from '@/stores/position'
import PositionList from '@/components/PositionList.vue'
import AddPositionDialog from './AddPositionDialog.vue'

const positionStore = usePositionStore()
const positionList = computed(() => positionStore.positionList)
const positionLoading = computed(() => positionStore.loading)
const showAddDialog = ref(false)

// 获取持股列表
const fetchPositions = async () => {
  try {
    await positionStore.fetchPositions()
  } catch (err) {
    showToast('获取持股列表失败')
  }
}

// 打开录入持股对话框
const openAddDialog = () => {
  showAddDialog.value = true
}

// 添加成功后刷新列表
const handleAddSuccess = () => {
  fetchPositions()
}

// 减仓成功后刷新列表
const handleReduceSuccess = () => {
  fetchPositions()
}

// 暴露刷新方法供父组件调用
const refresh = async () => {
  await fetchPositions()
}

onMounted(() => {
  fetchPositions()
})

defineExpose({
  refresh
})
</script>

<template>
  <div class="position-section">
    <div class="section-header">
      <h3>持股信息</h3>
      <van-button 
        type="primary" 
        size="small"
        icon="add-o"
        @click="openAddDialog"
      >
        录入持股
      </van-button>
    </div>
    
    <div v-if="positionLoading" class="loading">
      <van-loading size="24px" />
      <span>加载中...</span>
    </div>
    
    <div v-else-if="positionList.length === 0" class="empty">
      <p>暂无持股数据</p>
    </div>
    
    <PositionList 
      v-else 
      :position-list="positionList"
      @reduce-success="handleReduceSuccess"
    />
    
    <!-- 录入持股对话框 -->
    <AddPositionDialog 
      v-model:visible="showAddDialog"
      @success="handleAddSuccess"
    />
  </div>
</template>

<style scoped lang="less">
.position-section {
  margin-top: 20px;
  padding: 16px;
  background-color: #f9fafb;
  border-radius: 8px;
  min-height: 300px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #6b7280;
}
</style>
