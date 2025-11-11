<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { usePositionStore } from '@/stores/position'

interface MoneyRecord {
  id: number
  money: number
  created_at: string
}

const loading = ref(false)
const moneyData = ref<MoneyRecord | null>(null)
const positionStore = usePositionStore()

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
  </div>
</template>

<style scoped lang="less">
.home-page {
  min-height: 100vh;
  background-color: #ffffff;
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
</style>

