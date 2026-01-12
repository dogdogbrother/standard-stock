<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { Position } from '@/stores/position'
import { formatNumber } from '@/utils/format'

interface Props {
  positionList: Position[]
  showReduceButton?: boolean // 是否显示减仓按钮，默认为 true
}

const props = withDefaults(defineProps<Props>(), {
  showReduceButton: true
})

const emit = defineEmits<{
  reduce: [position: Position]
}>()

const router = useRouter()

// 判断是否是交易时间（工作日 9:30 之后）
const isTradingTime = (): boolean => {
  const now = new Date()
  const day = now.getDay() // 0=周日, 1-5=周一至周五, 6=周六
  
  // 周末直接返回 false
  if (day === 0 || day === 6) {
    return false
  }
  
  // 工作日判断时间
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const currentTime = hours * 60 + minutes
  
  // 9:30 = 570分钟
  const tradingStart = 9 * 60 + 30 // 570
  
  return currentTime >= tradingStart
}

// 判断是否显示交易数据
const showTradingData = isTradingTime()

// 跳转到股票详情页
const goToStockDetail = (position: Position) => {
  router.push(`/stock/${position.invt}/${position.stock}`)
}

// 处理减仓按钮点击
const handleReduce = (position: Position) => {
  emit('reduce', position)
}

// 计算盈亏金额
const getProfitAmount = (position: Position): number => {
  if (position.currentPrice === undefined) return 0
  return (position.currentPrice - position.cost) * position.quantity
}

// 计算盈亏比例
const getProfitPercent = (position: Position): number => {
  if (position.currentPrice === undefined || position.cost === 0) return 0
  return ((position.currentPrice - position.cost) / position.cost) * 100
}

// 计算市值（现价 × 持股数）
const getMarketValue = (position: Position): number => {
  if (position.currentPrice === undefined) return 0
  return position.currentPrice * position.quantity
}
</script>

<template>
  <div class="position-list">
    <div 
      v-for="position in positionList" 
      :key="position.id" 
      class="position-item"
      @click="goToStockDetail(position)"
    >
      <div class="position-header">
        <div class="stock-info">
          <span class="position-name">{{ position.name }}</span>
          <span class="position-stock">{{ position.stock }}</span>
        </div>
        <div class="price-info">
          <span 
            v-if="position.currentPrice !== undefined" 
            class="current-price"
          >
            {{ formatNumber(position.currentPrice, 3) }}
          </span>
          <span v-else class="current-price loading-text">--</span>
          
          <span 
            v-if="!showTradingData"
            class="change-percent"
          >
            -
          </span>
          <span 
            v-else-if="position.changePercent !== undefined"
            class="change-percent"
            :class="{
              'price-up': position.changePercent > 0,
              'price-down': position.changePercent < 0
            }"
          >
            {{ position.changePercent > 0 ? '+' : '' }}{{ formatNumber(position.changePercent, 2) }}%
          </span>
          <span v-else class="change-percent loading-text">--</span>
        </div>
      </div>
      <div class="position-details">
        <span v-if="position.currentPrice !== undefined" class="market-value">
          ¥{{ formatNumber(getMarketValue(position), 2) }}
        </span>
        <span class="detail-item">
          <span class="label">成本:</span>
          <span class="value">{{ formatNumber(position.cost, 3) }}</span>
        </span>
        <span class="detail-item">
          <span class="label">持股:</span>
          <span class="value">{{ position.quantity }}</span>
        </span>
      </div>
      
      <!-- 盈亏信息和减仓按钮 -->
      <div class="profit-loss-row">
        <div v-if="position.currentPrice !== undefined" class="profit-loss">
          <span class="label">盈亏:</span>
          <span 
            class="value"
            :class="{
              'price-up': getProfitAmount(position) > 0,
              'price-down': getProfitAmount(position) < 0
            }"
          >
            ¥{{ formatNumber(getProfitAmount(position), 2) }}
            ({{ getProfitPercent(position) > 0 ? '+' : '' }}{{ formatNumber(getProfitPercent(position), 2) }}%)
          </span>
        </div>
        <van-button 
          v-if="props.showReduceButton"
          type="warning" 
          size="mini"
          @click.stop="handleReduce(position)"
        >
          减仓
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.position-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.position-item {
  padding: 16px;
  background-color: #ffffff;
  border-radius: 8px;
  border-left: 3px solid #1989fa;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: #f9fafb;
  }
  
  &:active {
    transform: scale(0.98);
  }
}

.position-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.stock-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.position-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.position-stock {
  font-size: 12px;
  color: #969799;
}

.price-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-price {
  font-size: 16px;
  font-weight: 600;
}

.change-percent {
  font-size: 14px;
  font-weight: 500;
}

.position-details {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
}

.market-value {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 4px;
  
  .label {
    color: #6b7280;
  }
  
  .value {
    color: #111827;
    font-weight: 500;
  }
}

.price-up {
  color: #ef4444 !important;
}

.price-down {
  color: #10b981 !important;
}

.loading-text {
  color: #9ca3af;
}

.profit-loss-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.profit-loss {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  
  .label {
    color: #6b7280;
  }
  
  .value {
    font-weight: 600;
  }
}
</style>

