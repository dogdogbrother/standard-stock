<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { usePositionStore } from '@/stores/position'
import { useMoneyStore } from '@/stores/money'
import PositionList from '@/components/PositionList.vue'
import TrackHistoryButton from '@/components/TrackHistoryButton.vue'
import { showToast } from 'vant'

interface Buddy {
  id: number
  name: string
  avatar?: string
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

const loading = ref(false)
const router = useRouter()
const refreshing = ref(false)
const positionStore = usePositionStore()
const moneyStore = useMoneyStore()
const sortOrder = ref<'default' | 'desc' | 'asc'>('default')
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

// 计算份额价格
const unitPrice = computed(() => {
  if (!moneyStore.moneyData) return 0
  const totalValue = (moneyStore.moneyData.money + (moneyStore.moneyData.usedMoney || 0))
  return totalValue / 100000
})

// 计算昨日份额价格
const yesterdayUnitPrice = computed(() => {
  if (!moneyStore.moneyData) return 0
  // 昨日总资产 = 今日总资产 - 今日收益
  const yesterdayTotalValue = totalAssets.value - todayProfit.value
  return yesterdayTotalValue / 100000
})

// 计算伙伴持有金额
const getBuddyAsset = (buddy: Buddy): number => {
  if (!buddy.heldUnit) return 0
  return buddy.heldUnit * unitPrice.value
}

// 计算伙伴今日盈亏
const getBuddyProfit = (buddy: Buddy): number => {
  if (!buddy.heldUnit) return 0
  // 今日盈亏 = 份额 × (今日份额价格 - 昨日份额价格)
  return buddy.heldUnit * (unitPrice.value - yesterdayUnitPrice.value)
}

// 过滤出有份额的伙伴
const activeBuddies = computed(() => {
  return buddyList.value.filter(buddy => (buddy.heldUnit || 0) > 0)
})

// 计算盈亏金额
const getProfitAmount = (position: any): number => {
  if (position.currentPrice === undefined) return 0
  return (position.currentPrice - position.cost) * position.quantity
}

// 排序后的持仓列表
const sortedPositionList = computed(() => {
  const list = [...positionStore.positionList]
  
  if (sortOrder.value === 'desc') {
    // 降序：盈亏从大到小
    return list.sort((a, b) => getProfitAmount(b) - getProfitAmount(a))
  } else if (sortOrder.value === 'asc') {
    // 升序：盈亏从小到大
    return list.sort((a, b) => getProfitAmount(a) - getProfitAmount(b))
  }
  
  // 默认顺序
  return list
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

// 格式化金额显示（整数不显示小数）
const formatAmount = (amount: number): string => {
  if (Number.isInteger(amount)) {
    return amount.toString()
  }
  return amount.toFixed(2)
}

// 计算总资产（可用资金 + 总市值）
const totalAssets = computed(() => {
  if (!moneyStore.moneyData) return 0
  return moneyStore.moneyData.money + totalMarketValue.value
})

// 获取资金数据
const fetchMoney = async () => {
  loading.value = true
  
  try {
    // 如果已有缓存数据，不重复请求
    if (moneyStore.moneyData) {
      return
    }
    await moneyStore.fetchMoney()
  } catch (err) {
  } finally {
    loading.value = false
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

// 切换排序
const toggleSort = () => {
  if (sortOrder.value === 'default') {
    sortOrder.value = 'desc' // 第一次点击：降序（从大到小）
  } else if (sortOrder.value === 'desc') {
    sortOrder.value = 'asc' // 第二次点击：升序（从小到大）
  } else {
    sortOrder.value = 'default' // 第三次点击：恢复默认
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

const goToWatchlist = () => {
  router.push('/app/watchlist')
}

onMounted(async () => {
  // 等待所有数据加载完成
  await Promise.all([
    fetchMoney(),
    fetchPositions(),
    fetchBuddies(),
    fetchTodayTracks()
  ])
  // 所有数据加载完成
  allDataLoaded.value = true
})
</script>

<template>
  <div class="home-page">
    <div class="top-card" @click="goToWatchlist">
      <div v-if="loading" class="loading">
        <van-loading size="24px" color="#ffffff" />
      </div>
      <div v-else class="asset-info">
        <div class="label">总资产</div>
        <div class="amount">¥{{ totalAssets.toFixed(2) }}</div>
        
        <div class="asset-detail">
          <div class="detail-item">
            <span class="detail-label">今日收益</span>
            <span 
              v-if="!showTradingData"
              class="detail-value"
            >
              -
            </span>
            <span 
              v-else
              class="detail-value"
              :class="{
                'profit-up': todayProfit > 0,
                'profit-down': todayProfit < 0
              }"
            >
              {{ todayProfit > 0 ? '+' : '' }}{{ formatAmount(todayProfit) }}<span class="profit-rate">({{ todayProfitRate > 0 ? '+' : '' }}{{ todayProfitRate.toFixed(2) }}%)</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">总市值</span>
            <span class="detail-value">{{ Math.round(totalMarketValue) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">可用资金</span>
            <span class="detail-value">{{ moneyStore.moneyData ? moneyStore.moneyData.money.toFixed(2) : '0.00' }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <!-- 伙伴列表 -->
      <div v-if="activeBuddies.length > 0 && (!buddyLoading || refreshing)" class="buddy-section">
        <div class="buddy-list">
          <div 
            v-for="buddy in activeBuddies" 
            :key="buddy.id" 
            class="buddy-item"
          >
            <div class="buddy-avatar">
              <img v-if="buddy.avatar" :src="buddy.avatar" alt="头像" />
              <van-icon v-else name="user-o" />
            </div>
            <div class="buddy-info">
              <div class="buddy-name">{{ buddy.name }}</div>
              <div class="buddy-asset-row">
                <div class="buddy-asset">
                  持有金额：<span v-if="allDataLoaded">¥{{ getBuddyAsset(buddy).toFixed(2) }}</span><span v-else class="loading-text">计算中...</span>
                </div>
                <!-- 只有所有数据加载完成才显示收益 -->
                <div v-if="!allDataLoaded" class="buddy-profit loading-text">
                  -
                </div>
                <div v-else-if="!showTradingData" class="buddy-profit">
                  -
                </div>
                <div 
                  v-else
                  class="buddy-profit"
                  :class="{
                    'profit-up': getBuddyProfit(buddy) > 0,
                    'profit-down': getBuddyProfit(buddy) < 0
                  }"
                >
                  {{ getBuddyProfit(buddy) > 0 ? '+' : '' }}{{ formatAmount(getBuddyProfit(buddy)) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 持仓列表 -->
      <div class="position-section">
        <div class="section-header">
          <div class="section-title" @click="toggleSort">
            持仓
            <span class="sort-icon" :class="sortOrder">
              <van-icon v-if="sortOrder === 'desc'" name="arrow-down" />
              <van-icon v-else-if="sortOrder === 'asc'" name="arrow-up" />
              <van-icon v-else name="exchange" />
            </span>
          </div>
          <TrackHistoryButton />
        </div>
        
        <div v-if="positionStore.loading && !refreshing" class="loading">
          <van-loading size="24px" />
          <span>加载中...</span>
        </div>
        
        <div v-else-if="positionStore.positionList.length === 0 && !positionStore.loading" class="empty">
          <p>暂无持仓数据</p>
        </div>
        
        <PositionList 
          v-else-if="positionStore.positionList.length > 0"
          :position-list="sortedPositionList"
          :show-reduce-button="false"
        />
      </div>
    </van-pull-refresh>
  </div>
</template>

<style scoped lang="less">
.home-page {
  min-height: 100vh;
  background-color: #ffffff;
  padding-bottom: 10px;
  // iOS PWA 适配：让背景色延伸到状态栏下方
  background: linear-gradient(to bottom, #1989fa 0px, #ffffff 200px);
}

.top-card {
  width: 100%;
  padding: 24px 16px;
  // iOS PWA 适配：为顶部状态栏预留空间，让渐变背景延伸到状态栏
  padding-top: max(24px, calc(24px + env(safe-area-inset-top)));
  min-height: 180px;
  background-image: linear-gradient(to bottom, #1989fa, #0291fc, #0098fe, #00a0ff, #00a7ff, #00b0ff, #00b9ff, #00c1fe, #00ccf9, #00d6ea, #00ded5, #00e4ba);
  cursor: pointer;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.asset-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.label {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.amount {
  font-size: 36px;
  font-weight: 700;
  color: #ffffff;
}

.asset-detail {
  display: flex;
  gap: 24px;
  margin-top: 4px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: #ffffff;
}

.detail-value {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  
  &.profit-up {
    color: #ffebee;
  }
  
  &.profit-down {
    color: #e8f5e9;
  }
}

.profit-rate {
  font-size: 14px;
}

.van-pull-refresh {
  min-height: calc(100vh - 180px);
}

.buddy-section {
  padding-top: 16px;
}

.buddy-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0 16px;
}

.buddy-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
  
  &:active {
    transform: scale(0.98);
  }
}

.buddy-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-right: 12px;
  flex-shrink: 0;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .van-icon {
    font-size: 24px;
    color: #9ca3af;
  }
}

.buddy-info {
  flex: 1;
  min-width: 0;
}

.buddy-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buddy-asset-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.buddy-asset {
  font-size: 14px;
  color: #6b7280;
  
  .loading-text {
    color: #9ca3af;
  }
}

.buddy-profit {
  font-size: 14px;
  font-weight: 500;
  
  &.profit-up {
    color: #ef4444;
  }
  
  &.profit-down {
    color: #10b981;
  }
  
  &.loading-text {
    color: #9ca3af;
    font-weight: 400;
  }
}

.position-section {
  margin: 16px 16px 6px 16px;
  padding: 16px;
  background-color: #f9fafb;
  border-radius: 8px;
  min-height: 224px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  cursor: pointer;
  user-select: none;
  
  &:active {
    opacity: 0.7;
  }
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: #9ca3af;
  
  &.desc {
    color: #ef4444;
  }
  
  &.asc {
    color: #10b981;
  }
}

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #6b7280;
}
</style>

