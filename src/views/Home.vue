<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { usePositionStore } from '@/stores/position'
import PositionList from '@/components/PositionList.vue'

interface MoneyRecord {
  id: number
  money: number
  created_at: string
}

const loading = ref(false)
const moneyData = ref<MoneyRecord | null>(null)
const positionStore = usePositionStore()
const sortOrder = ref<'default' | 'desc' | 'asc'>('default')

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

// 计算总资产（可用资金 + 总市值）
const totalAssets = computed(() => {
  if (!moneyData.value) return 0
  return moneyData.value.money + totalMarketValue.value
})

// 获取资金数据
const fetchMoney = async () => {
  loading.value = true
  
  try {
    const { data, error: fetchError } = await supabase
      .from('money')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (fetchError) {
      throw fetchError
    }
    
    // 将分转换为元显示
    if (data) {
      data.money = data.money / 100
    }
    
    moneyData.value = data
  } catch (err) {
    console.error('获取数据失败:', err)
  } finally {
    loading.value = false
  }
}

// 获取持股数据
const fetchPositions = async () => {
  try {
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

onMounted(() => {
  fetchMoney()
  fetchPositions()
})
</script>

<template>
  <div class="home-page">
    <div class="top-card">
      <div v-if="loading" class="loading">
        <van-loading size="24px" color="#ffffff" />
      </div>
      <div v-else class="asset-info">
        <div class="label">资产账户</div>
        <div class="amount">¥{{ totalAssets.toFixed(2) }}</div>
        
        <div class="asset-detail">
          <div class="detail-item">
            <span class="detail-label">总市值</span>
            <span class="detail-value">{{ Math.round(totalMarketValue) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">可用资金</span>
            <span class="detail-value">{{ moneyData ? moneyData.money.toFixed(2) : '0.00' }}</span>
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
  font-size: 16px;
  font-weight: 600;
  color: #111827;
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

