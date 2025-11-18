<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useWatchlistStore } from '@/stores/watchlist'
import { usePositionStore } from '@/stores/position'
import KLineChart from './components/KLineChart.vue'
import CompanyInfo from './components/CompanyInfo.vue'
import DividendChart from './components/DividendChart.vue'
import RevenueChart from './components/RevenueChart.vue'
import ProfitChart from './components/ProfitChart.vue'
import TrackList from './components/TrackList.vue'
import { formatNumber } from '@/utils/format'

interface StockInfo {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  invt: string
  yesterdayPrice: number
  open: number
  high: number
  low: number
  volume: number
  turnover: number
}

const route = useRoute()
const router = useRouter()
const watchlistStore = useWatchlistStore()
const positionStore = usePositionStore()
const invt = ref(route.params.invt as string)
const stockCode = ref(route.params.stock as string)

const loading = ref(true)
const stockInfo = ref<StockInfo | null>(null)
const isInWatchlist = ref(false)
const isInPosition = ref(false)

// 检查用户是否登录
const parseCookies = () => {
  if (typeof document === 'undefined') {
    return {}
  }

  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .reduce<Record<string, string>>((acc, item) => {
      const separatorIndex = item.indexOf('=')
      if (separatorIndex === -1) {
        return acc
      }

      const key = item.slice(0, separatorIndex).trim()
      const value = item.slice(separatorIndex + 1)

      if (key) {
        acc[key] = decodeURIComponent(value)
      }

      return acc
    }, {})
}

const isLoggedIn = computed(() => {
  const cookies = parseCookies()
  return cookies['login'] === '19910415'
})

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

// 将 invt 转换为东方财富的市场代码
const convertInvtToMarket = (invt: string): string => {
  return invt === 'sz' ? '0' : '1' // sz -> 0, sh -> 1
}

// 获取股票详情
const fetchStockDetail = async () => {
  loading.value = true
  try {
    const secid = `${convertInvtToMarket(invt.value)}.${stockCode.value}`
    const fields = 'f18,f2,f3,f4,f12,f13,f14,f15,f16,f17,f5,f6'
    const apiUrl = import.meta.env.VITE_STOCK_DETAIL_API || 'https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-detail'
    const url = `${apiUrl}?secids=${encodeURIComponent(secid)}&fields=${encodeURIComponent(fields)}`
    
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error('获取股票详情失败')
    }
    
    const result = await response.json()
    
    if (result.data && result.data.diff && result.data.diff.length > 0) {
      const item = result.data.diff[0]
      stockInfo.value = {
        code: item.f12,
        name: item.f14,
        price: item.f2 ? item.f2 / 100 : 0,
        change: item.f4 ? item.f4 / 100 : 0,
        changePercent: item.f3 ? item.f3 / 100 : 0,
        invt: item.f13 === 0 ? 'sz' : 'sh',
        yesterdayPrice: item.f18 ? item.f18 / 100 : 0,
        open: item.f15 ? item.f15 / 100 : 0,
        high: item.f17 ? item.f17 / 100 : 0,
        low: item.f16 ? item.f16 / 100 : 0,
        volume: item.f5 ? item.f5 / 100 : 0,
        turnover: item.f6 ? item.f6 / 10000 : 0
      }
    }
  } catch (err) {
    showToast('获取股票详情失败')
  } finally {
    loading.value = false
  }
}

// 检查是否在自选列表中
const checkWatchlist = async () => {
  if (!isLoggedIn.value) return
  
  try {
    // 先从缓存中同步检查（立即返回，无延迟）
    isInWatchlist.value = watchlistStore.isInWatchlistCache(stockCode.value, invt.value as 'sh' | 'sz')
    
    // 如果缓存为空（首次进入详情页或刷新后），则从数据库查询
    if (watchlistStore.stockList.length === 0) {
      const result = await watchlistStore.checkInWatchlist(stockCode.value, invt.value as 'sh' | 'sz')
      isInWatchlist.value = result.isInWatchlist
    }
  } catch (err) {
  }
}

// 检查是否在持仓中
const checkPosition = async () => {
  if (!isLoggedIn.value) return
  
  try {
    // 先从缓存中同步检查（立即返回，无延迟）
    isInPosition.value = positionStore.isInPositionCache(stockCode.value, invt.value)
    
    // 如果缓存为空（首次进入详情页或刷新后），则从数据库查询
    if (positionStore.positionList.length === 0) {
      await positionStore.fetchPositions()
      isInPosition.value = positionStore.isInPositionCache(stockCode.value, invt.value)
    }
  } catch (err) {
  }
}

// 添加自选
const addToWatchlist = async () => {
  if (!isLoggedIn.value) return
  
  try {
    // 传入最新价（如果有的话）
    const price = stockInfo.value?.price
    await watchlistStore.addToWatchlist(stockCode.value, invt.value as 'sh' | 'sz', price)
    showToast('添加自选成功')
    // store 已经刷新了缓存，直接从缓存读取
    isInWatchlist.value = watchlistStore.isInWatchlistCache(stockCode.value, invt.value as 'sh' | 'sz')
  } catch (err) {
    showToast('添加自选失败')
  }
}

// 取消自选
const removeFromWatchlist = async () => {
  if (!isLoggedIn.value) return
  
  // 如果是持仓股，不允许取消自选
  if (isInPosition.value) {
    showToast('持仓股不能取消自选')
    return
  }
  
  try {
    await watchlistStore.removeFromWatchlist(stockCode.value, invt.value as 'sh' | 'sz')
    showToast('取消自选成功')
    // store 已经刷新了缓存，直接从缓存读取
    isInWatchlist.value = watchlistStore.isInWatchlistCache(stockCode.value, invt.value as 'sh' | 'sz')
  } catch (err) {
    showToast('取消自选失败')
  }
}

const goBack = () => {
  router.back()
}

onMounted(async () => {
  // 如果是登录用户，预先加载必要的缓存数据
  if (isLoggedIn.value) {
    const promises = []
    
    // 如果 watchlist 还没有数据，先加载 watchlist（为后续页面提供缓存）
    if (watchlistStore.stockList.length === 0) {
      promises.push(watchlistStore.fetchWatchlist())
    }
    
    // 如果 position 还没有数据，先加载 position（为后续页面提供缓存）
    if (positionStore.positionList.length === 0) {
      promises.push(positionStore.fetchPositions())
    }
    
    // 等待缓存数据加载完成
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }
  
  await Promise.all([
    fetchStockDetail(),
    checkWatchlist(),
    checkPosition()
  ])
})
</script>

<template>
  <div class="stock-detail-page">
    <div class="header">
      <button class="back-button" type="button" @click="goBack">
        <van-icon name="arrow-left" />
      </button>
      <h1 class="title">股票详情</h1>
      
      <!-- 自选按钮（仅登录用户显示） -->
      <div v-if="isLoggedIn" class="watchlist-actions">
        <van-button 
          v-if="!isInWatchlist"
          type="primary" 
          size="small"
          icon="star-o"
          @click="addToWatchlist"
        >
          添加自选
        </van-button>
        <van-button 
          v-else
          type="default" 
          size="small"
          icon="star"
          :disabled="isInPosition"
          @click="removeFromWatchlist"
        >
          {{ isInPosition ? '持仓中' : '取消自选' }}
        </van-button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <van-loading size="24px" />
      <span>加载中...</span>
    </div>

    <div v-else-if="stockInfo" class="content">
      <!-- 股票基本信息 -->
      <div class="stock-header">
        <div class="stock-info-row">
          <div class="stock-title">
            <h2 class="stock-name">
              {{ stockInfo.name }}
              <span v-if="isInPosition" class="position-badge">持</span>
            </h2>
            <div class="stock-code">{{ stockInfo.invt.toUpperCase() }}{{ stockInfo.code }}</div>
          </div>
          <div 
            class="stock-price"
            :class="{
              'price-up': stockInfo.change > 0,
              'price-down': stockInfo.change < 0
            }"
          >
            <div class="current-price">{{ formatNumber(stockInfo.price, 3) }}</div>
            <div v-if="!showTradingData" class="price-change">
              -
            </div>
            <div v-else class="price-change">
              {{ stockInfo.change > 0 ? '+' : '' }}{{ formatNumber(stockInfo.change, 2) }} ({{ stockInfo.changePercent > 0 ? '+' : '' }}{{ formatNumber(stockInfo.changePercent, 2) }}%)
            </div>
          </div>
        </div>
      </div>

      <!-- 股票详细数据 -->
      <div class="stock-details">
        <div class="detail-row">
          <div class="detail-item">
            <span class="label">昨收</span>
            <span class="value">{{ formatNumber(stockInfo.yesterdayPrice, 3) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">今开</span>
            <span class="value">{{ formatNumber(stockInfo.open, 3) }}</span>
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-item">
            <span class="label">最高</span>
            <span class="value price-up">{{ formatNumber(stockInfo.high, 3) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">最低</span>
            <span class="value price-down">{{ formatNumber(stockInfo.low, 3) }}</span>
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-item">
            <span class="label">成交量</span>
            <span class="value">{{ Math.round(stockInfo.volume) }}手</span>
          </div>
          <div class="detail-item">
            <span class="label">成交额</span>
            <span class="value">{{ formatNumber(stockInfo.turnover, 2) }}万</span>
          </div>
        </div>
      </div>
      
      <!-- K线图 -->
      <KLineChart 
        v-if="stockInfo"
        :stock-code="stockCode"
        :invt="invt"
      />
      
      <!-- 操作记录 -->
      <TrackList
        v-if="stockInfo && isLoggedIn"
        :stock-code="stockCode"
        :invt="invt"
        :current-price="stockInfo.price"
      />
      
      <!-- 公司信息 -->
      <CompanyInfo
        v-if="stockInfo"
        :stock-code="stockCode"
      />
      
      <!-- 历年分红率 -->
      <DividendChart
        v-if="stockInfo"
        :stock-code="stockCode"
      />
      
      <!-- 营业总收入及增速 -->
      <RevenueChart
        v-if="stockInfo"
        :stock-code="stockCode"
      />
      
      <!-- 扣非净利润及增速 -->
      <ProfitChart
        v-if="stockInfo"
        :stock-code="stockCode"
      />
    </div>

    <div v-else class="empty">
      <p>暂无数据</p>
    </div>
  </div>
</template>

<style scoped lang="less">
.stock-detail-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  // iOS PWA 适配：为顶部状态栏预留空间
  padding-top: max(10px, env(safe-area-inset-top));
  background-color: #ffffff;
  border-bottom: 1px solid #f0f0f0;
}

.back-button {
  border: none;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: #111827;
  width: 20px;
  height: 20px;
}

.title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.watchlist-actions {
  flex-shrink: 0;
}

.loading,
.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #6b7280;
}

.content {
  flex: 1;
  padding: 12px;
}

.stock-header {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.stock-info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.stock-title {
  flex: 1;
  min-width: 0;
}

.stock-name {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px 0;
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
  border-radius: 3px;
  line-height: 1;
}

.stock-code {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

.stock-price {
  text-align: right;
  flex-shrink: 0;
  
  &.price-up {
    .current-price,
    .price-change {
      color: #ef4444;
    }
  }
  
  &.price-down {
    .current-price,
    .price-change {
      color: #10b981;
    }
  }
}

.current-price {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
  margin-bottom: 2px;
}

.price-change {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}

.stock-details {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
  
  &:first-child {
    padding-top: 0;
  }
  
  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.detail-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .label {
    font-size: 13px;
    color: #6b7280;
    font-weight: 500;
  }
  
  .value {
    font-size: 14px;
    color: #111827;
    font-weight: 600;
    
    &.price-up {
      color: #ef4444;
    }
    
    &.price-down {
      color: #10b981;
    }
  }
}
</style>

