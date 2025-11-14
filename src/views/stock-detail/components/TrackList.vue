<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { supabase } from '@/lib/supabase'

interface Props {
  stockCode: string
  invt: string
  currentPrice?: number // 最新价格（元）
}

interface TrackRecord {
  id: number
  stock: string
  invt: string
  name: string
  money: number
  price: number
  num: number
  track_type: 'increase' | 'reduce' | 'clear'
  created_at: string
}

const props = defineProps<Props>()

const loading = ref(false)
const trackList = ref<TrackRecord[]>([])
const currentQuantity = ref<number>(0) // 当前持仓数量
const totalProfit = ref<number>(0) // 总盈亏（元）

// 格式化日期（只显示年月日）
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 格式化金额（分转元，去掉不必要的.00）
const formatMoney = (money: number) => {
  const value = money / 100
  if (value % 1 === 0) return value.toString()
  return value.toFixed(2)
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
  const diff = Math.abs((currentPrice - prevPrice) * num)
  if (diff % 1 === 0) return diff.toString()
  return diff.toFixed(2) // 使用绝对值，不显示正负号
}

// 获取当前持仓数量
const fetchCurrentQuantity = async () => {
  try {
    const { data, error } = await supabase
      .from('position')
      .select('quantity')
      .eq('stock', props.stockCode)
      .eq('invt', props.invt)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 表示没有找到记录
      console.error('获取持仓数量失败:', error)
      return
    }
    
    currentQuantity.value = data?.quantity || 0
  } catch (err) {
    console.error('获取持仓数量失败:', err)
  }
}

// 计算总盈亏
const calculateTotalProfit = () => {
  if (!props.currentPrice || trackList.value.length === 0) {
    totalProfit.value = 0
    return
  }
  
  // 计算总成本（买入总额 - 卖出总额）
  let totalBuyAmount = 0 // 买入总额
  let totalSellAmount = 0 // 卖出总额
  
  // 按时间正序计算，判断每条卖出操作后是否清仓
  const sortedTracks = [...trackList.value].reverse() // 转为正序
  let runningQuantity = 0
  
  sortedTracks.forEach((track, sortedIndex) => {
    const amount = track.money / 100 // 转换为元
    
    if (track.track_type === 'increase') {
      // 买入：支出
      totalBuyAmount += amount
      runningQuantity += track.num
    } else if (track.track_type === 'reduce' || track.track_type === 'clear') {
      // 卖出或清仓：收入
      totalSellAmount += amount
      runningQuantity -= track.num
    }
  })
  
  // 总成本 = 买入总额 - 卖出总额（正值表示净支出）
  const totalCost = totalBuyAmount - totalSellAmount
  
  // 当前持仓市值
  const currentMarketValue = currentQuantity.value * props.currentPrice
  
  // 总盈亏 = 当前持仓市值 - 总成本
  totalProfit.value = currentMarketValue - totalCost
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
    
    // 获取持仓数量并计算盈亏
    await fetchCurrentQuantity()
    calculateTotalProfit()
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

// 判断操作后持仓是否为0（用于判断是否显示为清仓）
const isClearPosition = (index: number) => {
  const track = trackList.value[index]
  // 只有卖出操作才可能清仓
  if (track.track_type !== 'reduce') return false
  
  // 按时间正序计算累计持仓（从最早到当前操作）
  // 因为 trackList 是倒序的，需要从后往前计算
  const sortedTracks = [...trackList.value].reverse() // 转为正序
  const currentIndex = sortedTracks.length - 1 - index // 当前操作在正序中的索引
  
  let quantity = 0
  for (let i = 0; i <= currentIndex; i++) {
    const t = sortedTracks[i]
    if (t.track_type === 'increase') {
      quantity += t.num
    } else if (t.track_type === 'reduce' || t.track_type === 'clear') {
      quantity -= t.num
    }
  }
  
  // 如果卖出后持仓为0，则显示为清仓
  return quantity === 0
}

const lastOperationDiff = computed(() => {
  if (!props.currentPrice || trackList.value.length === 0) return null
  const latestRecord = trackList.value[0]
  const latestPrice = latestRecord.price / 100
  if (latestPrice === 0) return null

  const diffPercent = ((props.currentPrice - latestPrice) / latestPrice) * 100
  const absPercent = Math.abs(diffPercent)
  const formattedPercent =
    absPercent % 1 === 0 ? absPercent.toString() : absPercent.toFixed(2).replace(/\.?0+$/, '')

  const isClear =
    latestRecord.track_type === 'clear' ||
    (latestRecord.track_type === 'reduce' && isClearPosition(0))

  const label =
    latestRecord.track_type === 'increase' ? '买入' : isClear ? '清仓' : '卖出'
  const percentValue = `${diffPercent >= 0 ? '+' : '-'}${formattedPercent}%`

  return {
    label,
    percent: percentValue
  }
})

// 监听价格变化，重新计算盈亏
watch(() => props.currentPrice, () => {
  if (trackList.value.length > 0) {
    calculateTotalProfit()
  }
})

onMounted(() => {
  fetchTrackList()
})
</script>

<template>
  <div v-if="loading || trackList.length > 0" class="track-list">
    <div class="track-header">
      <div class="header-left">
        <h3>操作记录</h3>
        <div 
          v-if="trackList.length > 0 && currentPrice" 
          class="total-profit-header"
        >
          <div class="profit-row">
            <span class="profit-label">总盈亏</span>
            <span class="profit-value">
              {{ totalProfit > 0 ? '+' : '' }}{{ totalProfit % 1 === 0 ? totalProfit.toString() : totalProfit.toFixed(2) }}
            </span>
          </div>
          <div v-if="lastOperationDiff" class="last-operation">
            距离上次{{ lastOperationDiff.label }}：
            <span 
              class="percent"
              :class="{
                'percent-positive': lastOperationDiff.percent.startsWith('+'),
                'percent-negative': lastOperationDiff.percent.startsWith('-')
              }"
            >
              {{ lastOperationDiff.percent }}
            </span>
          </div>
        </div>
      </div>
      <span class="count">共 {{ trackList.length }} 条</span>
    </div>
    
    <div v-if="loading" class="loading-wrapper">
      <van-loading size="24px" />
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
              {{ track.track_type === 'increase' ? '买入' : (track.track_type === 'clear' || isClearPosition(index)) ? '清仓' : '卖出' }}
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
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }
  
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #111827;
  }
  
  .total-profit-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    
    .profit-row {
      display: flex;
      align-items: center;
      gap: 4px;
      
      .profit-label {
        font-size: 12px;
        font-weight: 500;
        color: #111827;
      }
      
      .profit-value {
        font-size: 12px;
        font-weight: 600;
        color: #111827;
      }
    }
    
    .last-operation {
      font-size: 12px;
      color: #6b7280;
      
      .percent {
        font-weight: 600;
        margin-left: 2px;
        
        &.percent-positive {
          color: #ef4444;
        }
        
        &.percent-negative {
          color: #10b981;
        }
      }
    }
  }
  
  .count {
    font-size: 12px;
    color: #9ca3af;
    flex-shrink: 0;
  }
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 0;
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

