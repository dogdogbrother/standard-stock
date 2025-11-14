<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

interface TrackRecord {
  id: number
  stock: string
  invt: string
  name: string
  price: number
  num: number
  money: number
  track_type: 'increase' | 'reduce' | 'clear'
  created_at: string
}

const showActionSheet = ref(false)
const loading = ref(false)
const trackList = ref<TrackRecord[]>([])
const trackDisplayTypes = ref<Record<number, 'increase' | 'reduce' | 'clear'>>({})

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatPrice = (price: number) => {
  const value = price / 100
  if (value % 1 === 0) return value.toString()
  return value.toFixed(3).replace(/\.?0+$/, '')
}

const formatMoney = (money: number) => {
  const value = money / 100
  if (value % 1 === 0) return value.toString()
  return value.toFixed(2).replace(/\.?0+$/, '')
}

const computeDisplayTypes = () => {
  const displayMap: Record<number, 'increase' | 'reduce' | 'clear'> = {}
  const sortedTracks = [...trackList.value].slice().reverse() // 正序
  const stockQuantityMap: Record<string, number> = {}
  
  sortedTracks.forEach((track) => {
    const stockKey = `${track.invt}-${track.stock}`
    if (!(stockKey in stockQuantityMap)) {
      stockQuantityMap[stockKey] = 0
    }
    
    if (track.track_type === 'increase') {
      stockQuantityMap[stockKey] += track.num
      displayMap[track.id] = 'increase'
    } else if (track.track_type === 'clear') {
      stockQuantityMap[stockKey] -= track.num
      displayMap[track.id] = 'clear'
    } else {
      stockQuantityMap[stockKey] -= track.num
      displayMap[track.id] = stockQuantityMap[stockKey] === 0 ? 'clear' : 'reduce'
    }
  })
  
  trackDisplayTypes.value = displayMap
}

const fetchTrackList = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('track')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('获取历史操作记录失败:', error)
      return
    }
    
    trackList.value = data || []
    computeDisplayTypes()
  } catch (err) {
    console.error('获取历史操作记录失败:', err)
  } finally {
    loading.value = false
  }
}

const openActionSheet = async () => {
  showActionSheet.value = true
  await fetchTrackList()
}

const getDisplayType = (track: TrackRecord) => {
  return trackDisplayTypes.value[track.id] || track.track_type
}

const getTypeLabel = (type: 'increase' | 'reduce' | 'clear') => {
  if (type === 'increase') return '买入'
  if (type === 'clear') return '清仓'
  return '卖出'
}

const getTypeClass = (type: 'increase' | 'reduce' | 'clear') => {
  if (type === 'increase') return 'type-buy'
  if (type === 'clear') return 'type-clear'
  return 'type-sell'
}
</script>

<template>
  <div class="history-button">
    <button class="history-btn" type="button" @click="openActionSheet">
      历史
    </button>
    
    <van-action-sheet
      v-model:show="showActionSheet"
      title="历史操作记录"
      :close-on-click-action="false"
      safe-area-inset-bottom
      class="history-action-sheet"
    >
      <div class="history-dialog-content">
        <div v-if="loading" class="dialog-loading">
          <van-loading size="24px" />
        </div>
        <div v-else-if="trackList.length === 0" class="dialog-empty">
          <van-empty description="暂无历史记录" />
        </div>
        <div v-else class="history-list">
          <div
            v-for="track in trackList"
            :key="track.id"
            class="history-item"
          >
            <div class="history-item-header">
              <span class="stock-name">{{ track.name }} ({{ track.invt.toUpperCase() }}{{ track.stock }})</span>
              <span class="type-tag" :class="getTypeClass(getDisplayType(track))">
                {{ getTypeLabel(getDisplayType(track)) }}
              </span>
            </div>
            <div class="history-item-body">
              <div class="info-row">
                <span class="label">价格</span>
                <span class="value">{{ formatPrice(track.price) }}</span>
              </div>
              <div class="info-row">
                <span class="label">数量</span>
                <span class="value">{{ track.num }}股</span>
              </div>
              <div class="info-row">
                <span class="label">金额</span>
                <span class="value">¥{{ formatMoney(track.money) }}</span>
              </div>
              <div class="info-row">
                <span class="label">时间</span>
                <span class="value">{{ formatDateTime(track.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </van-action-sheet>
  </div>
</template>

<style scoped lang="less">
.history-button {
  display: inline-flex;
}

.history-btn {
  border: 1px solid #3b82f6;
  background: transparent;
  padding: 2px 6px;
  font-size: 12px;
  color: #3b82f6;
  cursor: pointer;
  border-radius: 4px;
}

.history-dialog-content {
  max-height: calc(90vh - 60px);
  overflow-y: auto;
  padding: 0 10px;
}

.dialog-loading {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

:deep(.history-action-sheet .van-action-sheet__content) {
  max-height: 90vh;
  height: 90vh;
}

.dialog-empty {
  padding: 20px 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0;
}

.history-item {
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.stock-name {
  font-weight: 600;
  color: #111827;
}

.type-tag {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  
  &.type-buy {
    color: #52c41a;
    background-color: rgba(82, 196, 26, 0.1);
  }
  
  &.type-sell {
    color: #f53f3f;
    background-color: rgba(245, 63, 63, 0.1);
  }
  
  &.type-clear {
    color: #ff9800;
    background-color: rgba(255, 152, 0, 0.1);
  }
}

.history-item-body {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: flex-start;
  gap: 4px;
  font-size: 12px;
  
  .label {
    color: #6b7280;
  }
  
  .value {
    font-weight: 600;
    color: #111827;
  }
}

@media (max-width: 360px) {
  .history-item-body {
    grid-template-columns: 1fr;
  }
}
</style>

