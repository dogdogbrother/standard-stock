<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { showToast } from 'vant'
import { usePositionStore } from '@/stores/position'
import PositionList from '@/components/PositionList.vue'
import TrackHistoryButton from '@/components/TrackHistoryButton.vue'
import AddPositionDialog from './AddPositionDialog.vue'

defineProps<{
  refreshing?: boolean
}>()

const emit = defineEmits<{
  'position-changed': []
}>()

const positionStore = usePositionStore()
const positionList = computed(() => positionStore.positionList)
const positionLoading = computed(() => positionStore.loading)
const showAddDialog = ref(false)

const sortOrder = ref<'default' | 'desc' | 'asc'>('default')

// 计算盈亏金额
const getProfitAmount = (position: any): number => {
  if (position.currentPrice === undefined) return 0
  return (position.currentPrice - position.cost) * position.quantity
}

// 排序后的持仓列表
const sortedPositionList = computed(() => {
  const list = [...positionStore.positionList]
  
  if (sortOrder.value === 'desc') {
    // 降序：盈亏从大到小
    return list.sort((a, b) => getProfitAmount(b) - getProfitAmount(a))
  } else if (sortOrder.value === 'asc') {
    // 升序：盈亏从小到大
    return list.sort((a, b) => getProfitAmount(a) - getProfitAmount(b))
  }
  
  // 默认顺序
  return list
})

// 切换排序
const toggleSort = () => {
  if (sortOrder.value === 'default') {
    sortOrder.value = 'desc' // 第一次点击：降序
  } else if (sortOrder.value === 'desc') {
    sortOrder.value = 'asc' // 第二次点击：升序
  } else {
    sortOrder.value = 'default' // 第三次点击：恢复默认
  }
}

// 获取持股列表
const fetchPositions = async (force = false, silent = false) => {
  try {
    // 如果已有缓存且不是强制刷新，则不重复请求
    if (!force && positionStore.positionList.length > 0) {
      return
    }
    await positionStore.fetchPositions(silent)
  } catch (err) {
    showToast('获取持股列表失败')
  }
}

// 打开录入持股对话框
const openAddDialog = () => {
  showAddDialog.value = true
}

// 添加成功后刷新列表
const handleAddSuccess = async () => {
  // AddPositionDialog 直接操作数据库，需要刷新 store 缓存
  await positionStore.fetchPositions()
  // 通知父组件刷新资金信息
  emit('position-changed')
}

// 减仓成功后刷新列表
const handleReduceSuccess = () => {
  // PositionList 的减仓操作已经通过 store 完成，store 内部会刷新
  // 只需要通知父组件刷新资金信息
  emit('position-changed')
}

// 暴露刷新方法供父组件调用（下拉刷新时使用）
const refresh = async () => {
  await fetchPositions(true, true) // 强制刷新，静默模式
}

onMounted(() => {
  // 只在缓存为空时才请求
  fetchPositions(false)
})

defineExpose({
  refresh
})
</script>

<template>
  <div class="position-section">
    <div class="section-header">
      <div class="header-left">
        <h3 @click="toggleSort">
          持股信息
          <span class="sort-icon" :class="sortOrder">
            <van-icon v-if="sortOrder === 'desc'" name="arrow-down" />
            <van-icon v-else-if="sortOrder === 'asc'" name="arrow-up" />
            <van-icon v-else name="exchange" />
          </span>
        </h3>
        <TrackHistoryButton />
      </div>
      <van-button 
        type="primary" 
        size="small"
        icon="add-o"
        @click="openAddDialog"
      >
        录入持股
      </van-button>
    </div>
    
    <div v-if="positionLoading && !refreshing" class="loading">
      <van-loading size="24px" />
      <span>加载中...</span>
    </div>
    
    <div v-else-if="positionList.length === 0 && !positionLoading" class="empty">
      <p>暂无持股数据</p>
    </div>
    
    <PositionList 
      v-else-if="positionList.length > 0"
      :position-list="sortedPositionList"
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
  min-height: 224px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: #9ca3af;
  
  &.desc {
    color: #ef4444;
  }
  
  &.asc {
    color: #10b981;
  }
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
