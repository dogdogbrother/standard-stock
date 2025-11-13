<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { usePositionStore } from '@/stores/position'
import { useMoneyStore } from '@/stores/money'
import PositionList from '@/components/PositionList.vue'
import { showToast } from 'vant'

interface Buddy {
  id: number
  name: string
  avatar?: string
  heldUnit?: number
  heldUnitStatus?: number
  created_at: string
}

const loading = ref(false)
const refreshing = ref(false)
const positionStore = usePositionStore()
const moneyStore = useMoneyStore()
const sortOrder = ref<'default' | 'desc' | 'asc'>('default')
const buddyList = ref<Buddy[]>([])
const buddyLoading = ref(false)
const allDataLoaded = ref(false) // 所有数据加载完成标识

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

// 获取伙伴列表
const fetchBuddies = async () => {
  buddyLoading.value = true
  try {
    const { data, error } = await supabase
      .from('buddy')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    buddyList.value = data || []
  } catch (err) {
    console.error('获取伙伴列表失败:', err)
  } finally {
    buddyLoading.value = false
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
  return positionStore.positionList.reduce((total, position) => {
    if (position.currentPrice !== undefined && position.yesterdayPrice !== undefined) {
      // (最新价 - 昨收价) * 持股数量
      return total + ((position.currentPrice - position.yesterdayPrice) * position.quantity)
    }
    return total
  }, 0)
})

// 计算今日收益率
const todayProfitRate = computed(() => {
  // 计算昨收总市值
  const yesterdayTotalValue = positionStore.positionList.reduce((total, position) => {
    if (position.yesterdayPrice !== undefined) {
      return total + (position.yesterdayPrice * position.quantity)
    }
    return total
  }, 0)
  
  // 计算今日总市值
  const todayTotalValue = positionStore.positionList.reduce((total, position) => {
    if (position.currentPrice !== undefined) {
      return total + (position.currentPrice * position.quantity)
    }
    return total
  }, 0)
  
  if (yesterdayTotalValue === 0) return 0
  
  // 收益率 = (今日总市值 - 昨收总市值) / 昨收总市值 * 100
  return ((todayTotalValue - yesterdayTotalValue) / yesterdayTotalValue) * 100
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
    console.error('获取数据失败:', err)
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
    console.error('获取持股列表失败:', err)
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
    // 强制刷新所有数据
    await Promise.all([
      moneyStore.refreshMoney(),
      positionStore.fetchPositions(),
      fetchBuddies()
    ])
    showToast('刷新成功')
  } catch (err) {
    console.error('刷新失败:', err)
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
    fetchBuddies()
  ])
  // 所有数据加载完成
  allDataLoaded.value = true
})
</script>

<template>
  <div class="home-page">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="top-card">
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
      
      <!-- 伙伴列表 -->
      <div v-if="!buddyLoading && activeBuddies.length > 0" class="buddy-section">
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
          <h3 class="section-title" @click="toggleSort">
            持仓
            <span class="sort-icon" :class="sortOrder">
              <van-icon v-if="sortOrder === 'desc'" name="arrow-down" />
              <van-icon v-else-if="sortOrder === 'asc'" name="arrow-up" />
              <van-icon v-else name="exchange" />
            </span>
          </h3>
        </div>
        
        <div v-if="positionStore.loading" class="loading">
          <van-loading size="24px" />
          <span>加载中...</span>
        </div>
        
        <div v-else-if="positionStore.positionList.length === 0" class="empty">
          <p>暂无持仓数据</p>
        </div>
        
        <PositionList 
          v-else
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
}

.top-card {
  width: 100%;
  padding: 24px 16px;
  min-height: 180px;
  background-image: linear-gradient(to left top, #f6b9db, #edbee6, #e2c3ee, #d7c9f4, #cdcef7, #c6d4fc, #bfdafe, #bae0ff, #b7e9ff, #b7f1ff, #baf8ff, #c2fffb);
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
  color: #111827;
  font-weight: 500;
}

.amount {
  font-size: 36px;
  font-weight: 700;
  color: #111827;
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
  color: #6b7280;
}

.detail-value {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  
  &.profit-up {
    color: #ef4444;
  }
  
  &.profit-down {
    color: #10b981;
  }
}

.profit-rate {
  font-size: 14px;
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
  margin: 16px;
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
  
  &.desc,
  &.asc {
    color: #3b82f6;
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

