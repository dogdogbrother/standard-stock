<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWatchlistStore, type StockDetail } from '@/stores/watchlist'
import { usePositionStore } from '@/stores/position'
import SearchBar from './components/SearchBar.vue'

const router = useRouter()
const watchlistStore = useWatchlistStore()
const positionStore = usePositionStore()
const refreshing = ref(false) // 下拉刷新状态
const sortOrder = ref<'default' | 'asc' | 'desc'>('default') // default: 默认, asc: 升序, desc: 降序
const initialLoaded = ref(false) // 是否已完成首次加载

// 格式化操作日期为 MM-DD
const formatTrackDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

// 计算最近操作相对于最新价的涨跌幅
const calculateTrackChange = (stock: StockDetail): number => {
  if (!stock.lastTrack) return 0
  
  const trackPrice = stock.lastTrack.price / 100 // 操作时的价格（单位：元）
  const currentPrice = typeof stock.price === 'string' ? parseFloat(stock.price) : stock.price
  
  if (!trackPrice || !currentPrice) return 0
  
  return ((currentPrice - trackPrice) / trackPrice) * 100
}

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

// 下拉刷新
const onRefresh = async () => {
  refreshing.value = true
  await watchlistStore.refreshWatchlist()
  refreshing.value = false
  // 重置排序状态
  sortOrder.value = 'default'
}

const goToStockDetail = (stock: StockDetail) => {
  router.push(`/stock/${stock.invt}/${stock.code}`)
}

// 切换排序
const toggleSort = () => {
  if (sortOrder.value === 'default') {
    sortOrder.value = 'desc' // 第一次点击：降序（从大到小）
  } else if (sortOrder.value === 'desc') {
    sortOrder.value = 'asc' // 第二次点击：升序（从小到大）
  } else {
    sortOrder.value = 'default' // 第三次点击：恢复默认
  }
  
  watchlistStore.sortStockList(sortOrder.value)
}

onMounted(async () => {
  // 如果 position store 没有数据，先加载持仓数据（为判断持仓股提供缓存）
  if (positionStore.positionList.length === 0) {
    await positionStore.fetchPositions()
  }
  
  // 加载自选列表
  await watchlistStore.fetchWatchlist()
  
  // 标记首次加载完成
  initialLoaded.value = true
})
</script>

<template>
  <div class="watchlist-page">
    <SearchBar />
    
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="watchlistStore.loading || !initialLoaded" class="loading-state">
        <van-loading size="24px" />
        <span>加载中...</span>
      </div>
      
      <div v-else-if="watchlistStore.error" class="error-state">
        <van-icon name="warning-o" />
        <p>{{ watchlistStore.error }}</p>
      </div>
      
      <div v-else-if="watchlistStore.stockList.length > 0" class="stock-container">
        <div class="stock-header">
          <div class="header-name">名称/代码</div>
          <div class="header-price">最新</div>
          <div class="header-change" @click="toggleSort">
            <span>涨幅</span>
            <span class="sort-icon" :class="sortOrder">
              <van-icon v-if="sortOrder === 'desc'" name="arrow-down" />
              <van-icon v-else-if="sortOrder === 'asc'" name="arrow-up" />
              <van-icon v-else name="exchange" />
            </span>
          </div>
        </div>
        
        <div class="stock-list">
          <div 
            v-for="stock in watchlistStore.stockList" 
            :key="`${stock.invt}${stock.code}`"
            class="stock-item"
            @click="goToStockDetail(stock)"
          >
            <div class="stock-main">
              <div class="stock-info">
                <div class="stock-name">
                  {{ stock.name }}
                  <span v-if="watchlistStore.isInPosition(stock)" class="position-badge">持</span>
                  <span v-if="stock.dividend" class="dividend-badge">息{{ stock.dividend.num }}%</span>
                </div>
                <div class="stock-code">{{ stock.invt.toUpperCase() }}{{ stock.code }}</div>
              </div>
              <div class="stock-price">
                <div class="price">{{ stock.price }}</div>
              </div>
              <div class="stock-change">
                <div v-if="!showTradingData" class="change neutral">
                  -
                </div>
                <div 
                  v-else
                  class="change" 
                  :class="{
                    'positive': stock.change > 0,
                    'negative': stock.change < 0,
                    'neutral': stock.change === 0
                  }"
                >
                  {{ stock.change > 0 ? '+' : '' }}{{ stock.changePercent.toFixed(2) }}%
                </div>
              </div>
            </div>
            <div v-if="stock.lastTrack" class="stock-track">
              操作{{ stock.trackCount }}次 {{ formatTrackDate(stock.lastTrack.created_at) }} {{ (stock.lastTrack.price / 100).toFixed(2) }}{{ 
                stock.lastTrack.track_type === 'increase' ? '买入' : 
                stock.lastTrack.track_type === 'clear' ? '清仓' : '卖出' 
              }}{{ stock.lastTrack.num }}股
              <span 
                class="track-change"
                :class="{
                  'positive': calculateTrackChange(stock) > 0,
                  'negative': calculateTrackChange(stock) < 0
                }"
              >
                {{ calculateTrackChange(stock) > 0 ? '+' : '' }}{{ calculateTrackChange(stock).toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <van-icon name="star-o" class="icon" />
        <h3>暂无自选股票</h3>
        <p>点击上方搜索框添加自选</p>
      </div>
    </van-pull-refresh>
  </div>
</template>

<style scoped lang="less">
.watchlist-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
}

:deep(.van-pull-refresh) {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  padding-bottom: 20px; // 增加底部间距
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: #6b7280;
}

.error-state {
  color: #ef4444;
}

.empty-state {
  .icon {
    font-size: 48px;
    color: @primary-color;
    margin-bottom: 8px;
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 4px;
  }

  p {
    font-size: 14px;
    color: #6b7280;
  }
}

.stock-container {
  display: flex;
  flex-direction: column;
}

.stock-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: #fafafa;
  border-radius: 8px 8px 0 0;
  margin-bottom: 8px;
}

.header-name {
  flex: 1;
  font-size: 14px;
  color: #9ca3af;
  font-weight: 500;
}

.header-price {
  width: 80px;
  text-align: right;
  font-size: 14px;
  color: #9ca3af;
  font-weight: 500;
  padding-right: 16px;
}

.header-change {
  width: 80px;
  text-align: right;
  font-size: 14px;
  color: #9ca3af;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  
  &:active {
    opacity: 0.7;
  }
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  
  &.desc {
    color: #3b82f6;
  }
  
  &.asc {
    color: #3b82f6;
  }
  
  &.default {
    color: #d1d5db;
  }
}

.stock-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px; // 列表底部间距
}

.stock-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 8px;
  background-color: #ffffff;
  border: 1px solid #f1f3f5;
  cursor: pointer;
  transition: all 0.2s ease;

  &:active {
    background-color: #f9fafb;
  }
}

.stock-main {
  display: flex;
  align-items: center;
}

.stock-info {
  flex: 1;
  text-align: left;
}

.stock-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.position-badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 500;
  color: #ffffff;
  background-color: #3b82f6;
  border-radius: 4px;
  line-height: 1;
}

.dividend-badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 500;
  color: #ffffff;
  background-color: #10b981;
  border-radius: 4px;
  line-height: 1;
  margin-left: 4px;
}

.stock-code {
  font-size: 12px;
  color: #9ca3af;
}

.stock-track {
  padding-top: 10px;
  font-size: 11px;
  color: #6b7280;
  line-height: 1.4;
}

.track-change {
  font-weight: 600;
  margin-left: 2px;
  
  &.positive {
    color: #ef4444;
  }
  
  &.negative {
    color: #10b981;
  }
}

.stock-price {
  width: 80px;
  text-align: right;
  padding-right: 16px;
}

.price {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.stock-change {
  width: 80px;
  text-align: right;
}

.change {
  font-size: 14px;
  font-weight: 600;
  display: inline-block;
  
  &.positive {
    color: #ef4444;
  }
  
  &.negative {
    color: #10b981;
  }
  
  &.neutral {
    color: #6b7280;
  }
}
</style>

