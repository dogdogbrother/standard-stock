<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

interface WatchlistItem {
  id: number
  invt: 'sh' | 'sz'
  stock: string
  created_at: string
}

interface StockDetail {
  code: string
  name: string
  price: string | number
  change: number
  changePercent: number
  invt: string
}

const router = useRouter()
const loading = ref(false)
const refreshing = ref(false) // 下拉刷新状态
const stockList = ref<StockDetail[]>([])
const originalStockList = ref<StockDetail[]>([]) // 缓存原始列表数据
const error = ref('')
const sortOrder = ref<'default' | 'asc' | 'desc'>('default') // default: 默认, asc: 升序, desc: 降序

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

const goToSearch = () => {
  router.push('/search')
}

// 将 invt 转换为东方财富的市场代码
const convertInvtToMarket = (invt: string): string => {
  return invt === 'sz' ? '0' : '1' // sz -> 0, sh -> 1
}

// 获取自选股票列表
const fetchWatchlist = async (isRefresh = false) => {
  if (!isRefresh) {
    loading.value = true
    error.value = ''
    stockList.value = []
  }
  
  try {
    // 1. 从 watchlist 表获取所有自选股票
    const { data: watchlistData, error: watchlistError } = await supabase
      .from('watchlist')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (watchlistError) {
      throw watchlistError
    }
    
    if (!watchlistData || watchlistData.length === 0) {
      return
    }
    
    // 2. 拼接 secids 参数，格式：0.000001,1.600000
    const secids = watchlistData
      .map((item: WatchlistItem) => `${convertInvtToMarket(item.invt)}.${item.stock}`)
      .join(',')
    
    console.log('secids:', secids)
    
    // 3. 请求东方财富接口获取股票详情
    const fields = 'f1,f2,f3,f4,f12,f13,f14'
    const apiUrl = import.meta.env.VITE_STOCK_DETAIL_API || 'https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-detail'
    const url = `${apiUrl}?secids=${encodeURIComponent(secids)}&fields=${encodeURIComponent(fields)}`
    
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
    console.log('东方财富返回:', result)
    
    if (result.data && result.data.diff) {
      // 4. 转换数据格式
      const transformed = result.data.diff.map((item: any) => ({
        code: item.f12,
        name: item.f14,
        price: item.f2 ? (item.f2 / 100).toFixed(3) : '--',
        change: item.f4 ? item.f4 / 100 : 0,
        changePercent: item.f3 ? item.f3 / 100 : 0,
        invt: item.f13 === 0 ? 'sz' : 'sh'
      }))
      
      // 缓存原始数据
      originalStockList.value = [...transformed]
      stockList.value = transformed
      
      // 重置排序状态
      sortOrder.value = 'default'
    }
  } catch (err) {
    console.error('获取自选列表失败:', err)
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    if (!isRefresh) {
      loading.value = false
    }
  }
}

// 下拉刷新
const onRefresh = async () => {
  refreshing.value = true
  await fetchWatchlist(true)
  refreshing.value = false
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
  
  sortStockList()
}

// 排序股票列表
const sortStockList = () => {
  if (sortOrder.value === 'default') {
    // 恢复默认顺序（使用缓存的原始数据）
    stockList.value = [...originalStockList.value]
  } else if (sortOrder.value === 'desc') {
    // 降序：涨幅从大到小
    stockList.value.sort((a, b) => b.changePercent - a.changePercent)
  } else {
    // 升序：涨幅从小到大
    stockList.value.sort((a, b) => a.changePercent - b.changePercent)
  }
}

onMounted(() => {
  fetchWatchlist()
})
</script>

<template>
  <div class="watchlist-page">
    <van-search
      class="watchlist-search"
      readonly
      placeholder="请输入股票代码 / 名称"
      shape="round"
      @click="goToSearch"
    />
    
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="loading" class="loading-state">
        <van-loading size="24px" />
        <span>加载中...</span>
      </div>
      
      <div v-else-if="error" class="error-state">
        <van-icon name="warning-o" />
        <p>{{ error }}</p>
      </div>
      
      <div v-else-if="stockList.length > 0" class="stock-container">
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
          v-for="stock in stockList" 
          :key="`${stock.invt}${stock.code}`"
          class="stock-item"
          @click="goToStockDetail(stock)"
        >
          <div class="stock-info">
            <div class="stock-name">{{ stock.name }}</div>
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
  height: calc(100vh - 50px);
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
}

.watchlist-search {
  width: 100%;
  display: block;
  cursor: pointer;
  flex-shrink: 0;
}

:deep(.van-pull-refresh) {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
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
}

.stock-item {
  display: flex;
  align-items: center;
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

.stock-info {
  flex: 1;
  text-align: left;
}

.stock-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.stock-code {
  font-size: 12px;
  color: #9ca3af;
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
