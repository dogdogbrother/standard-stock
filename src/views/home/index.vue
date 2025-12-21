<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { usePositionStore } from '@/stores/position'
import { useMoneyStore } from '@/stores/money'
import AssetCard from './AssetCard.vue'
import BuddyList from './BuddyList.vue'
import PositionSection from './PositionSection.vue'
import { showToast } from 'vant'

interface Buddy {
  id: number
  name: string
  avatar?: string
  money: number  // 投入本金（单位：分）
  heldUnit?: number
  heldUnitStatus?: number
  created_at: string
}

interface TrackRecord {
  id: number
  stock: string
  invt: string
  name: string
  price: number
  num: number
  money: number
  track_type: 'increase' | 'reduce' | 'clear'
  created_at: string
}

const refreshing = ref(false)
const positionStore = usePositionStore()
const moneyStore = useMoneyStore()
const buddyList = ref<Buddy[]>([])
const buddyLoading = ref(false)
const allDataLoaded = ref(false) // 所有数据加载完成标识
const todayTracks = ref<TrackRecord[]>([]) // 今天的操作记录

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

// 获取今天的操作记录
const fetchTodayTracks = async () => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()
    
    const { data, error } = await supabase
      .from('track')
      .select('*')
      .gte('created_at', todayStr)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    
    todayTracks.value = data || []
  } catch (err) {
  }
}

// 获取伙伴列表
const fetchBuddies = async (silent = false) => {
  if (!silent) {
    buddyLoading.value = true
  }
  try {
    const { data, error } = await supabase
      .from('buddy')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    buddyList.value = data || []
  } catch (err) {
  } finally {
    if (!silent) {
      buddyLoading.value = false
    }
  }
}

// 过滤出有份额的伙伴
const activeBuddies = computed(() => {
  return buddyList.value.filter(buddy => (buddy.heldUnit || 0) > 0)
})

// 计算总市值
const totalMarketValue = computed(() => {
  return positionStore.positionList.reduce((total, position) => {
    if (position.currentPrice !== undefined) {
      return total + (position.currentPrice * position.quantity)
    }
    return total
  }, 0)
})

// 计算今日收益
const todayProfit = computed(() => {
  let totalProfit = 0
  
  // 按股票分组今天的操作记录
  const tracksByStock = new Map<string, TrackRecord[]>()
  todayTracks.value.forEach(track => {
    const key = `${track.stock}_${track.invt}`
    if (!tracksByStock.has(key)) {
      tracksByStock.set(key, [])
    }
    tracksByStock.get(key)!.push(track)
  })
  
  // 遍历所有持仓股票（包括今天清仓的quantity=0的股票）
  positionStore.allPositions.forEach(position => {
    if (position.currentPrice === undefined) return
    
    const key = `${position.stock}_${position.invt}`
    const stockTracks = tracksByStock.get(key) || []
    
    // 如果今天有操作记录
    if (stockTracks.length > 0) {
      // 计算今天的总买入量和总卖出量
      let todayBuyQty = 0
      let todaySellQty = 0
      let todaySellAmount = 0
      
      stockTracks.forEach(track => {
        if (track.track_type === 'increase') {
          todayBuyQty += track.num
        } else if (track.track_type === 'reduce' || track.track_type === 'clear') {
          todaySellQty += track.num
          todaySellAmount += track.money / 100
        }
      })
      
      // 计算昨天的持仓数量
      const yesterdayQty = position.quantity - todayBuyQty + todaySellQty
      
      // 情况1: 今天买入新股票（昨天没有持仓）
      if (yesterdayQty === 0 && todayBuyQty > 0) {
        // 今天新买的股票：用最新价和买入均价的差额
        let buyAmount = 0
        stockTracks.forEach(track => {
          if (track.track_type === 'increase') {
            buyAmount += track.money / 100
          }
        })
        const avgBuy = buyAmount / todayBuyQty
        totalProfit += (position.currentPrice - avgBuy) * position.quantity
      }
      // 情况2: 今天加仓了已有股票
      else if (yesterdayQty > 0 && todayBuyQty > 0) {
        // 原有持仓部分：用昨收价计算
        if (position.yesterdayPrice !== undefined) {
          totalProfit += (position.currentPrice - position.yesterdayPrice) * yesterdayQty
        }
        // 新加仓部分：用最新价和买入均价的差额
        let buyAmount = 0
        stockTracks.forEach(track => {
          if (track.track_type === 'increase') {
            buyAmount += track.money / 100
          }
        })
        const avgBuy = buyAmount / todayBuyQty
        totalProfit += (position.currentPrice - avgBuy) * todayBuyQty
      }
      // 情况3: 今天清仓了（现在quantity=0）
      else if (position.quantity === 0 && todaySellQty > 0 && position.yesterdayPrice !== undefined) {
        // 用卖出均价和昨收价的差额 * 数量
        const avgSellPrice = todaySellAmount / todaySellQty
        totalProfit += (avgSellPrice - position.yesterdayPrice) * todaySellQty
      }
      // 情况4: 今天减仓了但还有持仓
      else if (todaySellQty > 0 && position.quantity > 0) {
        if (position.yesterdayPrice !== undefined) {
          // 卖出部分：用卖出均价和昨收价的差额
          const avgSellPrice = todaySellAmount / todaySellQty
          totalProfit += (avgSellPrice - position.yesterdayPrice) * todaySellQty
          // 剩余持仓部分：用当前价和昨收价的差额
          totalProfit += (position.currentPrice - position.yesterdayPrice) * position.quantity
        }
      }
      // 其他情况：有操作但不是上述情况，用昨收价计算
      else if (position.yesterdayPrice !== undefined) {
        totalProfit += (position.currentPrice - position.yesterdayPrice) * position.quantity
      }
    }
    // 如果今天没有操作记录，使用原来的逻辑
    else if (position.yesterdayPrice !== undefined) {
      totalProfit += (position.currentPrice - position.yesterdayPrice) * position.quantity
    }
  })
  
  return totalProfit
})

// 计算今日收益率
const todayProfitRate = computed(() => {
  // 按股票分组今天的操作记录
  const tracksByStock = new Map<string, TrackRecord[]>()
  todayTracks.value.forEach(track => {
    const key = `${track.stock}_${track.invt}`
    if (!tracksByStock.has(key)) {
      tracksByStock.set(key, [])
    }
    tracksByStock.get(key)!.push(track)
  })
  
  // 计算昨收总市值（昨天持有的股票数量 × 昨收价）
  let yesterdayTotalValue = 0
  
  positionStore.allPositions.forEach(position => {
    if (position.yesterdayPrice === undefined) return
    
    const key = `${position.stock}_${position.invt}`
    const stockTracks = tracksByStock.get(key) || []
    
    // 计算今天的买入量和卖出量
    let todayBuyQty = 0
    let todaySellQty = 0
    
    stockTracks.forEach(track => {
      if (track.track_type === 'increase') {
        todayBuyQty += track.num
      } else if (track.track_type === 'reduce' || track.track_type === 'clear') {
        todaySellQty += track.num
      }
    })
    
    // 昨天的持仓数量 = 当前数量 - 今天买入 + 今天卖出
    const yesterdayQty = position.quantity - todayBuyQty + todaySellQty
    
    // 昨收总市值
    yesterdayTotalValue += position.yesterdayPrice * yesterdayQty
  })
  
  if (yesterdayTotalValue === 0) return 0
  
  // 收益率 = 今日收益 / 昨收总市值 * 100
  return (todayProfit.value / yesterdayTotalValue) * 100
})

// 计算总资产（可用资金 + 总市值）
const totalAssets = computed(() => {
  if (!moneyStore.moneyData) return 0
  return moneyStore.moneyData.money + totalMarketValue.value
})

// 获取资金数据
const fetchMoney = async () => {
  try {
    // 如果已有缓存数据，不重复请求
    if (moneyStore.moneyData) {
      return
    }
    await moneyStore.fetchMoney()
  } catch (err) {
  }
}

// 获取持股数据
const fetchPositions = async () => {
  try {
    // 如果已有缓存数据，不重复请求
    if (positionStore.positionList.length > 0) {
      return
    }
    await positionStore.fetchPositions()
  } catch (err) {
  }
}

// 下拉刷新
const onRefresh = async () => {
  try {
    // 强制刷新所有数据（静默刷新，不显示loading状态）
    await Promise.all([
      moneyStore.refreshMoney(),
      positionStore.fetchPositions(true), // 传入true表示静默刷新
      fetchBuddies(true), // 静默刷新伙伴列表
      fetchTodayTracks()
    ])
    showToast('刷新成功')
  } catch (err) {
    showToast('刷新失败')
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  // 等待所有数据加载完成
  await Promise.all([
    fetchMoney(),
    fetchPositions(),
    fetchBuddies(),
    fetchTodayTracks()
  ])
  
  // 额外等待 store 的 loading 完成（确保所有实时数据已加载）
  while (positionStore.loading || moneyStore.loading) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  // 所有数据加载完成
  allDataLoaded.value = true
})
</script>

<template>
  <div class="home-page">
    <AssetCard
      :loading="!allDataLoaded"
      :total-assets="totalAssets"
      :today-profit="todayProfit"
      :today-profit-rate="todayProfitRate"
      :total-market-value="totalMarketValue"
      :available-money="moneyStore.moneyData?.money || 0"
      :show-trading-data="showTradingData"
    />
    
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <BuddyList
        :buddy-list="activeBuddies"
        :buddy-loading="buddyLoading"
        :refreshing="refreshing"
        :all-data-loaded="allDataLoaded"
        :total-assets="totalAssets"
      />
      
      <PositionSection
        :refreshing="refreshing"
      />
    </van-pull-refresh>
  </div>
</template>

<style scoped lang="less">
.home-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
  // iOS PWA 适配：让背景色延伸到状态栏下方
  background: linear-gradient(to bottom, #1989fa 0px, #ffffff 200px);
}

:deep(.van-pull-refresh) {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  min-height: 0;
}

:deep(.van-pull-refresh__track) {
  padding-bottom: 20px;
}
</style>

