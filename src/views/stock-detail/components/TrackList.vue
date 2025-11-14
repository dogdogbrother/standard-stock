<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

interface Props {
  stockCode: string
  invt: string
}

interface TrackRecord {
  id: number
  stock: string
  invt: string
  name: string
  money: number
  price: number
  num: number
  track_type: 'increase' | 'reduce'
  created_at: string
}

const props = defineProps<Props>()

const loading = ref(false)
const trackList = ref<TrackRecord[]>([])

// 格式化日期（只显示年月日）
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 格式化金额（分转元）
const formatMoney = (money: number) => {
  return (money / 100).toFixed(2)
}

// 格式化价格（分转元）
const formatPrice = (price: number) => {
  const value = price / 100
  if (value % 1 === 0) return value.toString()
  const fixed = value.toFixed(3)
  return fixed.replace(/\.?0+$/, '')
}

// 计算价格差额（价格差 * 数量，不显示正负号）
const calculatePriceDiff = (currentPrice: number, prevPrice: number | null, num: number) => {
  if (prevPrice === null) return null
  const diff = (currentPrice - prevPrice) * num
  return Math.abs(diff).toFixed(2) // 使用绝对值，不显示正负号
}

// 获取操作记录
const fetchTrackList = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('track')
      .select('*')
      .eq('stock', props.stockCode)
      .eq('invt', props.invt)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('获取操作记录失败:', error)
      return
    }
    
    trackList.value = data || []
  } catch (err) {
    console.error('获取操作记录失败:', err)
  } finally {
    loading.value = false
  }
}

// 获取上一次操作的价格
const getPrevPrice = (index: number) => {
  if (index >= trackList.value.length - 1) return null
  const prevRecord = trackList.value[index + 1] // 因为是倒序，所以下一个索引是上一次操作
  return prevRecord ? prevRecord.price / 100 : null
}

onMounted(() => {
  fetchTrackList()
})
</script>

<template>
  <div class="track-list">
    <div class="track-header">
      <h3>操作记录</h3>
      <span class="count">共 {{ trackList.length }} 条</span>
    </div>
    
    <div v-if="loading" class="loading-wrapper">
      <van-loading size="24px" />
    </div>
    
    <div v-else-if="trackList.length === 0" class="empty-wrapper">
      <van-empty description="暂无操作记录" />
    </div>
    
    <div v-else class="track-items">
      <div 
        v-for="(track, index) in trackList" 
        :key="track.id"
        class="track-item"
      >
        <div class="track-main">
          <div class="track-left">
            <div class="track-type">
              {{ track.track_type === 'increase' ? '买入' : '卖出' }}
              <span v-if="getPrevPrice(index) !== null" class="price-diff">
                ¥{{ calculatePriceDiff(track.price / 100, getPrevPrice(index), track.num) }}
              </span>
            </div>
            <div class="track-time">{{ formatDate(track.created_at) }}</div>
          </div>
          
          <div class="track-right">
            <div class="track-price">
              <span class="label">价格:</span>
              <span class="value">{{ formatPrice(track.price) }}</span>
            </div>
            <div class="track-num">
              <span class="label">数量:</span>
              <span class="value">{{ track.num }}股</span>
            </div>
            <div class="track-money">
              <span class="label">金额:</span>
              <span class="value">
                ¥{{ formatMoney(track.money) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.track-list {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.track-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
  
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #111827;
  }
  
  .count {
    font-size: 12px;
    color: #9ca3af;
  }
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 0;
}

.empty-wrapper {
  padding: 20px 0;
}

.track-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.track-item {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 10px;
  transition: all 0.2s;
  
  &:active {
    background-color: #f9fafb;
  }
}

.track-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.track-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.track-type {
  font-size: 14px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 4px;
  text-align: center;
  color: #111827;
  background-color: #f3f4f6;
  display: flex;
  flex-direction: column;
  gap: 2px;
  
  .price-diff {
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
  }
}

.track-time {
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
}

.track-right {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  text-align: right;
}

.track-price,
.track-num,
.track-money {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  
  .label {
    font-size: 12px;
    color: #6b7280;
  }
  
  .value {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
  }
}
</style>

