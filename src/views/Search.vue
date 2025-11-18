<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useWatchlistStore } from '@/stores/watchlist'

interface StockItem {
  code: string
  name: string
  exchange: string
}

interface TencentSearchResponse {
  code: number
  msg: string
  data: {
    stock?: Array<[string, string, string, string, string]>
  }
}

// Supabase Edge Function 地址
// 本地开发: http://localhost:54321/functions/v1/stock-search
// 生产环境: https://YOUR_PROJECT_REF.supabase.co/functions/v1/stock-search
const STOCK_SEARCH_API = import.meta.env.VITE_STOCK_SEARCH_API || 'http://localhost:54321/functions/v1/stock-search'

const router = useRouter()
const watchlistStore = useWatchlistStore()
const keyword = ref('')
const searchRef = ref<{ focus: () => void } | null>(null)
const results = ref<StockItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const hasSearched = ref(false)
const addingStocks = ref(new Set<string>()) // 正在添加的股票集合
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

const fetchStocks = async (query: string) => {
  const currentId = ++requestId
  loading.value = true
  errorMessage.value = ''
  hasSearched.value = true

  try {
    const url = `${STOCK_SEARCH_API}?q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error('搜索接口请求失败')
    }
    
    const data: TencentSearchResponse = await response.json()
    
    if (currentId !== requestId) {
      return
    }

    if (data.code !== 0 || !data.data.stock) {
      results.value = []
      return
    }

    // 只保留 GP-A 开头类型的股票
    const stocks = data.data.stock
      .filter(item => item[4]?.startsWith('GP-A'))
      .map(item => ({
        exchange: item[0].toUpperCase(),
        code: item[1],
        name: item[2],
      }))

    results.value = stocks
  } catch (error) {
    if (currentId !== requestId) {
      return
    }
    errorMessage.value = '搜索失败，请稍后重试'
    results.value = []
  } finally {
    if (currentId === requestId) {
      loading.value = false
    }
  }
}

const clearResults = () => {
  results.value = []
  errorMessage.value = ''
  hasSearched.value = false
  loading.value = false
}

const scheduleSearch = (value: string) => {
  const trimmed = value.trim()
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  if (!trimmed) {
    clearResults()
    return
  }

  debounceTimer = window.setTimeout(() => {
    fetchStocks(trimmed)
  }, 400)
}

watch(keyword, (value) => {
  scheduleSearch(value)
})

const onSearch = (value: string) => {
  const trimmed = value.trim()
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  if (!trimmed) {
    clearResults()
    return
  }

  fetchStocks(trimmed)
}

const goBack = () => {
  router.back()
}

const goToStockDetail = (item: StockItem) => {
  router.push(`/stock/${item.exchange.toLowerCase()}/${item.code}`)
}

// 检查股票是否在自选中
const isInWatchlist = (item: StockItem): boolean => {
  return watchlistStore.isInWatchlistCache(item.code, item.exchange.toLowerCase() as 'sh' | 'sz')
}

// 检查股票是否正在添加
const isAddingStock = (item: StockItem): boolean => {
  return addingStocks.value.has(`${item.exchange}_${item.code}`)
}

// 将 exchange 转换为东方财富的市场代码
const convertExchangeToMarket = (exchange: string): string => {
  return exchange.toLowerCase() === 'sz' ? '0' : '1' // sz -> 0, sh -> 1
}

// 获取股票最新价
const fetchStockPrice = async (item: StockItem): Promise<number | undefined> => {
  try {
    const secid = `${convertExchangeToMarket(item.exchange)}.${item.code}`
    const fields = 'f2' // f2 是最新价
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
      return undefined
    }
    
    const result = await response.json()
    
    if (result.data && result.data.diff && result.data.diff.length > 0) {
      const stockData = result.data.diff[0]
      // f2 是最新价，单位是分，需要转为元
      return stockData.f2 ? stockData.f2 / 100 : undefined
    }
    
    return undefined
  } catch (err) {
    return undefined
  }
}

// 添加到自选
const addToWatchlist = async (item: StockItem, event: Event) => {
  // 阻止冒泡，避免触发父元素的跳转
  event.stopPropagation()
  
  const stockKey = `${item.exchange}_${item.code}`
  
  // 如果正在添加中，忽略重复点击
  if (addingStocks.value.has(stockKey)) {
    return
  }
  
  // 添加到正在添加的集合中
  addingStocks.value.add(stockKey)
  
  try {
    // 先获取股票最新价
    const price = await fetchStockPrice(item)
    
    // 添加到自选列表，并传入最新价
    await watchlistStore.addToWatchlist(
      item.code,
      item.exchange.toLowerCase() as 'sh' | 'sz',
      price
    )
    
    showToast({
      message: '添加自选成功',
      icon: 'success'
    })
  } catch (err: any) {
    // 检查是否是重复添加的错误（23505是 PostgreSQL 的唯一约束错误代码）
    if (err?.code === '23505' || err?.message?.includes('duplicate')) {
      showToast('已在自选中')
    } else {
      showToast({
        message: '添加失败',
        icon: 'fail'
      })
    }
  } finally {
    // 从正在添加的集合中移除
    addingStocks.value.delete(stockKey)
  }
}

onMounted(async () => {
  // 加载 watchlist 数据，确保缓存是最新的
  if (watchlistStore.stockList.length === 0) {
    await watchlistStore.fetchWatchlist()
  }
  
  requestAnimationFrame(() => {
    searchRef.value?.focus?.()
  })
})

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})

const hasKeyword = computed(() => keyword.value.trim().length > 0)
</script>

<template>
  <div class="search-page">
    <div class="search-header">
      <button class="back-button" type="button" @click="goBack">
        <van-icon name="arrow-left" />
      </button>
      <van-search
        ref="searchRef"
        v-model="keyword"
        placeholder="请输入股票代码 / 名称"
        shape="round"
        autofocus
        @search="onSearch"
      />
    </div>

    <div class="search-content">
      <div v-if="loading" class="loading-state">
        <van-loading size="24px" />
        <span>搜索中...</span>
      </div>
      <div v-else-if="errorMessage" class="error-state">
        <van-icon name="warning-o" />
        <p>{{ errorMessage }}</p>
      </div>
      <div v-else-if="results.length > 0" class="result-list">
        <div 
          v-for="item in results" 
          :key="`${item.exchange}${item.code}`" 
          class="result-item"
          @click="goToStockDetail(item)"
        >
          <div class="info">
            <div class="name">{{ item.name }}</div>
            <div class="code">{{ item.exchange }}{{ item.code }}</div>
          </div>
          <!-- 如果已在自选中，显示已添加标识 -->
          <div v-if="isInWatchlist(item)" class="added-badge">
            <van-icon name="success" />
            <span>已添加</span>
          </div>
          <!-- 如果正在添加中，显示 loading -->
          <div v-else-if="isAddingStock(item)" class="add-button loading">
            <van-loading size="16px" color="#3b82f6" />
          </div>
          <!-- 如果不在自选中，显示添加按钮 -->
          <div v-else class="add-button" @click="addToWatchlist(item, $event)">
            <van-icon name="plus" />
          </div>
        </div>
      </div>
      <div v-else-if="hasSearched && hasKeyword" class="empty-state">
        <van-icon name="search" class="icon" />
        <p>未找到相关股票</p>
      </div>
      <div v-else class="empty-state">
        <van-icon name="search" class="icon" />
        <p>输入代码或名称，开始查找股票。</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.search-page {
  min-height: 100vh;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
}

.search-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px 12px;
  // iOS PWA 适配：为顶部状态栏预留空间
  padding-top: max(10px, env(safe-area-inset-top));
  background-color: #ffffff;
}

.back-button {
  border: none;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  color: #111827;
  width: 24px;
  height: 24px;
}

:deep(.van-search) {
  flex: 1;
}

.search-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 16px 16px;
  background-color: #ffffff;
  overflow-y: auto;
}

.loading-state,
.error-state,
.empty-state {
  width: 100%;
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #6b7280;
}

.error-state {
  color: #ef4444;
}

.loading-state span {
  font-size: 14px;
}

.result-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 16px;
  background-color: #ffffff;
  box-shadow: 0 10px 30px rgba(31, 45, 61, 0.08);
  border: 1px solid #f1f3f5;
  cursor: pointer;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.98);
    box-shadow: 0 8px 20px rgba(31, 45, 61, 0.06);
  }
}

.result-item .info {
  text-align: left;
  flex: 1;
}

.result-item .info .name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.result-item .info .code {
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.result-item .add-button {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: #f0f7ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;

  :deep(.van-icon) {
    font-size: 16px;
    color: #3b82f6;
  }

  &:hover {
    background-color: #e0f0ff;
  }

  &:active {
    background-color: #d0e7ff;
    transform: scale(0.95);
  }
  
  &.loading {
    pointer-events: none;
    opacity: 0.8;
  }
}

.result-item .added-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  background-color: #f0f9ff;
  flex-shrink: 0;

  :deep(.van-icon) {
    font-size: 14px;
    color: #10b981;
  }

  span {
    font-size: 12px;
    color: #6b7280;
  }
}

.empty-state .icon {
  font-size: 48px;
  color: @primary-color;
  margin-bottom: @spacing-md;
}
</style>

