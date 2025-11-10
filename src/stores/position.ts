import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface Position {
  id: number
  stock: string
  name: string
  cost: number
  quantity: number
  created_at: string
  currentPrice?: number
  changePercent?: number
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
        fields: 'f2,f3,f12'
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
          stockDataMap.set(item.f12, {
            currentPrice: item.f2 / 100, // 最新价除以100
            changePercent: item.f3 / 100 // 涨跌幅除以100
          })
        })
        
        // 更新持股列表的实时数据
        return positions.map(pos => ({
          ...pos,
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
        .select('id, stock, name, cost, quantity, created_at')
        .order('created_at', { ascending: false })
      
      if (fetchError) throw fetchError
      
      // 将分转换为元显示
      const positions = (data || []).map((pos: any) => ({
        id: pos.id,
        stock: pos.stock,
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
    const costInCents = Math.round(cost * 100)
    
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

  return {
    positionList,
    loading,
    fetchPositions,
    updatePosition,
    deletePosition
  }
})

