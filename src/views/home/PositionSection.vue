<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePositionStore } from '@/stores/position'
import PositionList from '@/components/PositionList.vue'
import TrackHistoryButton from '@/components/TrackHistoryButton.vue'

interface Props {
  refreshing: boolean
}

defineProps<Props>()

const positionStore = usePositionStore()
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
    sortOrder.value = 'desc' // 第一次点击：降序（从大到小）
  } else if (sortOrder.value === 'desc') {
    sortOrder.value = 'asc' // 第二次点击：升序（从小到大）
  } else {
    sortOrder.value = 'default' // 第三次点击：恢复默认
  }
}
</script>

<template>
  <div class="position-section">
    <div class="section-header">
      <div class="section-title" @click="toggleSort">
        持仓
        <span class="sort-icon" :class="sortOrder">
          <van-icon v-if="sortOrder === 'desc'" name="arrow-down" />
          <van-icon v-else-if="sortOrder === 'asc'" name="arrow-up" />
          <van-icon v-else name="exchange" />
        </span>
      </div>
      <TrackHistoryButton />
    </div>
    
    <div v-if="positionStore.loading && !refreshing" class="loading">
      <van-loading size="24px" />
      <span>加载中...</span>
    </div>
    
    <div v-else-if="positionStore.positionList.length === 0 && !positionStore.loading" class="empty">
      <p>暂无持仓数据</p>
    </div>
    
    <PositionList 
      v-else-if="positionStore.positionList.length > 0"
      :position-list="sortedPositionList"
      :show-reduce-button="false"
    />
  </div>
</template>

<style scoped lang="less">
.position-section {
  margin: 16px 16px 6px 16px;
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

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  cursor: pointer;
  user-select: none;
  
  &:active {
    opacity: 0.7;
  }
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
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

