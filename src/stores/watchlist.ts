import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { usePositionStore } from './position'

export interface WatchlistItem {
  id: number
  invt: 'sh' | 'sz'
  stock: string
  created_at: string
}

export interface StockDetail {
  code: string
  name: string
  price: string | number
  change: number
  changePercent: number
  invt: string
}

export const useWatchlistStore = defineStore('watchlist', () => {
  const stockList = ref<StockDetail[]>([])
  const originalStockList = ref<StockDetail[]>([]) // 缓存原始列表数据（用于排序恢复）
  const loading = ref(false)
  const error = ref('')
  
  // 获取 position store 实例
  const positionStore = usePositionStore()

  // 将 invt 转换为东方财富的市场代码
  const convertInvtToMarket = (invt: string): string => {
    return invt === 'sz' ? '0' : '1' // sz -> 0, sh -> 1
  }

  // 判断是否是持仓股（使用 position store 的缓存）
  const isInPosition = (stock: StockDetail): boolean => {
    return positionStore.isInPositionCache(stock.code, stock.invt)
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
        stockList.value = []
        originalStockList.value = []
        return
      }
      
      // 2. 拼接 secids 参数，格式：0.000001,1.600000
      const secids = watchlistData
        .map((item: WatchlistItem) => `${convertInvtToMarket(item.invt)}.${item.stock}`)
        .join(',')
      
      // 3. 请求东方财富接口获取股票详情
      const fields = 'f18,f2,f3,f4,f12,f13,f14'
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

  // 刷新自选列表（同时刷新持仓数据）
  const refreshWatchlist = async () => {
    await Promise.all([
      fetchWatchlist(true),
      positionStore.fetchPositions()
    ])
  }

  // 添加自选
  const addToWatchlist = async (stock: string, invt: 'sh' | 'sz') => {
    try {
      // 先检查是否已存在
      const checkResult = await checkInWatchlist(stock, invt)
      if (checkResult.isInWatchlist) {
        const error: any = new Error('已在自选中')
        error.code = '23505'
        throw error
      }
      
      const { error } = await supabase
        .from('watchlist')
        .insert([{ stock, invt }])
      
      if (error) throw error
      
      // 添加成功后刷新列表
      await fetchWatchlist(true)
      return true
    } catch (err) {
      console.error('添加自选失败:', err)
      throw err
    }
  }

  // 取消自选
  const removeFromWatchlist = async (stock: string, invt: 'sh' | 'sz') => {
    try {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('stock', stock)
        .eq('invt', invt)
      
      if (error) throw error
      
      // 删除成功后刷新列表
      await fetchWatchlist(true)
      return true
    } catch (err) {
      console.error('取消自选失败:', err)
      throw err
    }
  }

  // 从缓存中检查是否在自选中（同步方法，立即返回）
  const isInWatchlistCache = (stock: string, invt: 'sh' | 'sz'): boolean => {
    // 从缓存的 stockList 中查找
    return stockList.value.some(item => item.code === stock && item.invt === invt)
  }

  // 检查是否在自选中（异步方法，从数据库查询）
  const checkInWatchlist = async (stock: string, invt: 'sh' | 'sz'): Promise<{ isInWatchlist: boolean; watchlistId: number | null }> => {
    try {
      const { data, error } = await supabase
        .from('watchlist')
        .select('id')
        .eq('stock', stock)
        .eq('invt', invt)
        .maybeSingle()
      
      if (error) throw error
      
      return {
        isInWatchlist: !!data,
        watchlistId: data ? data.id : null
      }
    } catch (err) {
      console.error('检查自选状态失败:', err)
      return {
        isInWatchlist: false,
        watchlistId: null
      }
    }
  }

  // 排序股票列表
  const sortStockList = (order: 'default' | 'asc' | 'desc') => {
    if (order === 'default') {
      // 恢复默认顺序（使用缓存的原始数据）
      stockList.value = [...originalStockList.value]
    } else if (order === 'desc') {
      // 降序：涨幅从大到小
      stockList.value.sort((a, b) => b.changePercent - a.changePercent)
    } else {
      // 升序：涨幅从小到大
      stockList.value.sort((a, b) => a.changePercent - b.changePercent)
    }
  }

  // 是否有自选股票
  const hasWatchlist = computed(() => stockList.value.length > 0)

  return {
    stockList,
    originalStockList,
    loading,
    error,
    hasWatchlist,
    fetchWatchlist,
    refreshWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    checkInWatchlist,
    isInWatchlistCache,
    isInPosition,
    sortStockList
  }
})

