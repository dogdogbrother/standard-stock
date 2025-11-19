<script setup lang="ts">
import { useRouter } from 'vue-router'
import { formatNumber } from '@/utils/format'

interface Props {
  loading: boolean
  totalAssets: number
  todayProfit: number
  todayProfitRate: number
  totalMarketValue: number
  availableMoney: number
  showTradingData: boolean
}

defineProps<Props>()

const router = useRouter()

// 格式化金额显示（整数不显示小数）
const formatAmount = (amount: number): string => {
  if (Number.isInteger(amount)) {
    return amount.toString()
  }
  return formatNumber(amount, 2).toString()
}

const goToWatchlist = () => {
  router.push('/app/watchlist')
}
</script>

<template>
  <div class="top-card" @click="goToWatchlist">
    <div v-if="loading" class="loading">
      <van-loading size="24px" color="#ffffff" />
    </div>
    <div v-else class="asset-info">
      <div class="label">总资产</div>
      <div class="amount">¥{{ formatNumber(totalAssets, 2) }}</div>
      
      <div class="asset-detail">
        <div class="detail-item">
          <span class="detail-label">今日收益</span>
          <span 
            v-if="!showTradingData"
            class="detail-value"
          >
            -
          </span>
          <span 
            v-else
            class="detail-value"
            :class="{
              'profit-up': todayProfit > 0,
              'profit-down': todayProfit < 0
            }"
          >
            {{ todayProfit > 0 ? '+' : '' }}{{ formatAmount(todayProfit) }}<span class="profit-rate">({{ todayProfitRate > 0 ? '+' : '' }}{{ formatNumber(todayProfitRate, 2) }}%)</span>
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">总市值</span>
          <span class="detail-value">{{ Math.round(totalMarketValue) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">可用资金</span>
          <span class="detail-value">{{ formatNumber(availableMoney, 2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.top-card {
  width: 100%;
  padding: 24px 16px;
  // iOS PWA 适配：为顶部状态栏预留空间，让渐变背景延伸到状态栏
  padding-top: max(24px, calc(24px + env(safe-area-inset-top)));
  min-height: 180px;
  background-image: linear-gradient(to bottom, #1989fa, #0291fc, #0098fe, #00a0ff, #00a7ff, #00b0ff, #00b9ff, #00c1fe, #00ccf9, #00d6ea, #00ded5, #00e4ba);
  cursor: pointer;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.asset-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.label {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.amount {
  font-size: 36px;
  font-weight: 700;
  color: #ffffff;
}

.asset-detail {
  display: flex;
  gap: 24px;
  margin-top: 4px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: #ffffff;
}

.detail-value {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  
  &.profit-up {
    color: #ffebee;
  }
  
  &.profit-down {
    color: #e8f5e9;
  }
}

.profit-rate {
  font-size: 14px;
}
</style>

