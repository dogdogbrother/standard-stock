import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

// Watchlist 表的数据结构
export interface WatchlistItem {
  id: number
  invt: 'sh' | 'sz'
  stock: string
  created_at: string
  price?: number // 添加自选时的价格（单位：分）
}

// Track 操作记录
export interface TrackRecord {
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

// 股息率信息
export interface Dividend {
  year: string
  num: number
}

// Watchlist 视图返回的数据结构（包含 tracks 和 dividend）
export interface WatchlistWithTracks extends WatchlistItem {
  tracks: TrackRecord[]
  dividend?: Dividend
}

export const useWatchlistStore = defineStore('watchlist', () => {
  const watchlistData = ref<WatchlistWithTracks[]>([]) // 存储 watchlist_with_tracks 视图数据
  const loading = ref(false)
  const error = ref('')

  // 获取自选股票列表（从 watchlist_with_tracks 视图）
  const fetchWatchlist = async (isRefresh = false) => {
    if (!isRefresh) {
      loading.value = true
      error.value = ''
      watchlistData.value = []
    }
    
    try {
      const { data, error: fetchError } = await supabase
        .from('watchlist_with_tracks')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (fetchError) throw fetchError
      
      if (!data || data.length === 0) {
        watchlistData.value = []
        return
      }
      
      // 处理返回的数据
      watchlistData.value = data.map((item: any) => {
        // 解析 tracks（可能是 JSON 字符串）
        let tracks: TrackRecord[] = []
        if (item.tracks) {
          try {
            tracks = typeof item.tracks === 'string' 
              ? JSON.parse(item.tracks) 
              : item.tracks
          } catch (e) {
            tracks = []
          }
        }
        
        // 解析 dividend（可能是 JSON 字符串）
        let dividend: Dividend | undefined
        if (item.dividend) {
          try {
            const dividendData = typeof item.dividend === 'string'
              ? JSON.parse(item.dividend)
              : item.dividend
            if (dividendData && dividendData.year && dividendData.num !== null) {
              dividend = {
                year: dividendData.year,
                num: dividendData.num
              }
            }
          } catch (e) {
            dividend = undefined
          }
        }
        
        return {
          id: item.id,
          stock: item.stock,
          invt: item.invt,
          created_at: item.created_at,
          price: item.price,
          tracks,
          dividend
        }
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载失败'
    } finally {
      if (!isRefresh) {
        loading.value = false
      }
    }
  }

  // 添加自选
  const addToWatchlist = async (stock: string, invt: 'sh' | 'sz', price?: number) => {
    try {
      // 先检查是否已存在
      const checkResult = await checkInWatchlist(stock, invt)
      if (checkResult.isInWatchlist) {
        const error: any = new Error('已在自选中')
        error.code = '23505'
        throw error
      }
      
      // 构建插入数据
      const insertData: any = {
        stock,
        invt
      }
      if (price !== undefined) {
        insertData.price = Math.round(price * 100) // 元转分（整数）
      }
      
      const { error } = await supabase
        .from('watchlist')
        .insert([insertData])
      
      if (error) throw error
      
      // 添加成功后刷新列表
      await fetchWatchlist(true)
      return true
    } catch (err) {
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
      throw err
    }
  }

  // 从缓存中检查是否在自选中（同步方法）
  const isInWatchlistCache = (stock: string, invt: 'sh' | 'sz'): boolean => {
    return watchlistData.value.some(item => item.stock === stock && item.invt === invt)
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
      return {
        isInWatchlist: false,
        watchlistId: null
      }
    }
  }

  // 是否有自选股票
  const hasWatchlist = computed(() => watchlistData.value.length > 0)

  return {
    watchlistData,
    loading,
    error,
    hasWatchlist,
    fetchWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    checkInWatchlist,
    isInWatchlistCache
  }
})
