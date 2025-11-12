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
  currentPrice?: number
  changePercent?: number
  yesterdayPrice?: number // 昨收价
}

export const usePositionStore = defineStore('position', () => {
  const positionList = ref<Position[]>([])
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
        fields: 'f2,f3,f12' // f2=最新价, f3=涨跌幅, f12=代码 (通过f2和f3计算昨收价)
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
          // 通过最新价和涨跌幅反推昨收价：昨收价 = 最新价 / (1 + 涨跌幅)
          // changePercent 已经是百分比数值，直接用
          const yesterdayPrice = changePercent !== 0 
            ? currentPrice / (1 + changePercent / 100)
            : currentPrice
          
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
  const fetchPositions = async () => {
    loading.value = true
    try {
      const { data, error: fetchError } = await supabase
        .from('position')
        .select('id, stock, invt, name, cost, quantity, created_at')
        .order('created_at', { ascending: false })
      
      if (fetchError) throw fetchError
      
      // 将分转换为元显示
      const positions = (data || []).map((pos: any) => ({
        id: pos.id,
        stock: pos.stock,
        invt: pos.invt,
        name: pos.name,
        cost: pos.cost / 100,
        quantity: pos.quantity,
        created_at: pos.created_at
      }))
      
      // 获取股票实时数据
      positionList.value = await fetchStockRealTimeData(positions)
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
    
    // 刷新列表
    await fetchPositions()
  }

  // 删除持股（清仓时）
  const deletePosition = async (positionId: number) => {
    const { error: deleteError } = await supabase
      .from('position')
      .delete()
      .eq('id', positionId)
    
    if (deleteError) throw deleteError
    
    // 刷新列表
    await fetchPositions()
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
    loading,
    fetchPositions,
    updatePosition,
    deletePosition,
    isInPositionCache,
    getPositionStocksSet
  }
})

