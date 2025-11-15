import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface Position {
  id: number
  stock: string
  invt: string
  name: string
  cost: number
  quantity: number
  created_at: string
  updated_at?: string // 更新时间
  currentPrice?: number
  changePercent?: number
  yesterdayPrice?: number // 昨收价
}

export const usePositionStore = defineStore('position', () => {
  const positionList = ref<Position[]>([]) // 用于显示的持仓列表（过滤掉quantity=0）
  const allPositions = ref<Position[]>([]) // 所有持仓（包括quantity=0，用于计算今日收益）
  const loading = ref(false)

  // 根据股票代码判断市场（0=深市，1=沪市）
  const getMarketPrefix = (stockCode: string): string => {
    const code = stockCode.substring(0, 3)
    // 沪市：60、68 开头
    if (code.startsWith('60') || code.startsWith('68')) {
      return '1'
    }
    // 深市：00、30、002 开头
    return '0'
  }

  // 获取股票实时数据
  const fetchStockRealTimeData = async (positions: Position[]) => {
    if (positions.length === 0) return positions

    try {
      // 构建 secids 参数，格式：0.000001,1.600000
      const secids = positions
        .map(pos => `${getMarketPrefix(pos.stock)}.${pos.stock}`)
        .join(',')
      
      const apiUrl = import.meta.env.VITE_STOCK_DETAIL_API || 'https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-detail'
      
      // 使用 URLSearchParams 正确转义参数
      const params = new URLSearchParams({
        secids: secids,
        fields: 'f2,f3,f12,f18' // f2=最新价, f3=涨跌幅, f12=代码, f18=昨收价
      })
      
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('获取股票详情失败')
      }
      
      const result = await response.json()
      
      if (result.data?.diff) {
        const stockDataMap = new Map()
        result.data.diff.forEach((item: any) => {
          const currentPrice = item.f2 / 100 // 最新价除以100
          const changePercent = item.f3 / 100 // 涨跌幅除以100 (例如: 250 -> 2.5%)
          const yesterdayPrice = item.f18 ? item.f18 / 100 : currentPrice // 直接使用f18昨收价
          
          stockDataMap.set(item.f12, {
            yesterdayPrice: yesterdayPrice,
            currentPrice: currentPrice,
            changePercent: changePercent
          })
        })
        
        // 更新持股列表的实时数据
        return positions.map(pos => ({
          ...pos,
          yesterdayPrice: stockDataMap.get(pos.stock)?.yesterdayPrice,
          currentPrice: stockDataMap.get(pos.stock)?.currentPrice,
          changePercent: stockDataMap.get(pos.stock)?.changePercent
        }))
      }
    } catch (err) {
      console.error('获取股票实时数据失败:', err)
      // 获取实时数据失败不影响持股列表显示
    }
    
    return positions
  }

  // 获取持股列表
  const fetchPositions = async (silent = false) => {
    if (!silent) {
      loading.value = true
    }
    try {
      const { data, error: fetchError } = await supabase
        .from('position')
        .select('id, stock, invt, name, cost, quantity, created_at, updated_at')
        .order('created_at', { ascending: false })
      
      if (fetchError) throw fetchError
      
      // 获取今天的日期（00:00:00）
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()
      
      // 将分转换为元显示，过滤掉quantity=0且不是今天更新的数据
      const positionsFromDB = (data || [])
        .filter((pos: any) => {
          // 保留 quantity > 0 的
          if (pos.quantity > 0) return true
          // 保留 quantity = 0 但 updated_at 是今天的（今天清仓的）
          if (pos.quantity === 0 && pos.updated_at && pos.updated_at >= todayStr) return true
          // 其他的过滤掉
          return false
        })
        .map((pos: any) => ({
          id: pos.id,
          stock: pos.stock,
          invt: pos.invt,
          name: pos.name,
          cost: pos.cost / 100,
          quantity: pos.quantity,
          created_at: pos.created_at,
          updated_at: pos.updated_at
        }))
      
      // 获取所有股票的实时数据（包括quantity=0但今天更新的，用于计算今日收益）
      const allPositionsWithPrice = await fetchStockRealTimeData(positionsFromDB)
      
      // 存储所有持仓（包括quantity=0但今天更新的）
      allPositions.value = allPositionsWithPrice
      
      // 只保留quantity > 0的持仓用于显示
      positionList.value = allPositionsWithPrice.filter(pos => pos.quantity > 0)
    } catch (err) {
      console.error('获取持股列表失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新持股（减仓时）
  const updatePosition = async (positionId: number, quantity: number, cost: number) => {
    // cost 保留3位小数(元)，转为1位小数(分): 11.678元 → 1167.8分
    const costInCents = Math.round(cost * 1000) / 10
    
    const { error: updateError } = await supabase
      .from('position')
      .update({ 
        quantity: quantity,
        cost: costInCents
      })
      .eq('id', positionId)
    
    if (updateError) throw updateError
    
    // 刷新列表（静默刷新，因为操作按钮已有loading状态）
    await fetchPositions(true)
  }

  // 删除持股（清仓时）
  const deletePosition = async (positionId: number) => {
    const { error: deleteError } = await supabase
      .from('position')
      .delete()
      .eq('id', positionId)
    
    if (deleteError) throw deleteError
    
    // 刷新列表（静默刷新，因为操作按钮已有loading状态）
    await fetchPositions(true)
  }

  // 从缓存中检查是否在持仓中（同步方法，立即返回）
  const isInPositionCache = (stock: string, invt: string): boolean => {
    return positionList.value.some(pos => pos.stock === stock && pos.invt === invt)
  }

  // 获取持仓股票的 Set 集合（用于快速判断）
  const getPositionStocksSet = (): Set<string> => {
    return new Set(
      positionList.value.map(pos => `${pos.invt}${pos.stock}`)
    )
  }

  return {
    positionList,
    allPositions,
    loading,
    fetchPositions,
    updatePosition,
    deletePosition,
    isInPositionCache,
    getPositionStocksSet
  }
})

