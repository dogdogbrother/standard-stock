<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { showToast } from 'vant'
import { usePositionStore } from '@/stores/position'

interface MoneyRecord {
  id: number
  money: number
  created_at: string
}

const loading = ref(false)
const moneyData = ref<MoneyRecord | null>(null)
const error = ref('')
const showEditDialog = ref(false)
const editAmount = ref('')

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


// 获取 money 数据
const fetchMoney = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const { data, error: fetchError } = await supabase
      .from('money')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single() // 返回单条记录
    
    if (fetchError) {
      throw fetchError
    }
    
    // 将分转换为元显示
    if (data) {
      data.money = data.money / 100
    }
    
    moneyData.value = data
    console.log('获取到的数据:', data)
  } catch (err) {
    console.error('获取数据失败:', err)
    error.value = err instanceof Error ? err.message : '获取数据失败'
  } finally {
    loading.value = false
  }
}

// 打开修改对话框
const openEditDialog = () => {
  if (!moneyData.value) return
  editAmount.value = moneyData.value.money.toString()
  showEditDialog.value = true
}

// 增加金额
const increaseAmount = () => {
  const current = parseFloat(editAmount.value) || 0
  editAmount.value = (current + 0.01).toFixed(2)
}

// 减少金额
const decreaseAmount = () => {
  const current = parseFloat(editAmount.value) || 0
  const newAmount = Math.max(0, current - 0.01) // 不能小于 0
  editAmount.value = newAmount.toFixed(2)
}

// 确认修改
const confirmEdit = async () => {
  const amountInYuan = parseFloat(editAmount.value)
  
  if (!editAmount.value) {
    showToast('请输入金额')
    return
  }
  
  if (isNaN(amountInYuan)) {
    showToast('请输入有效的数字')
    return
  }
  
  try {
    // 将元转换为分存储到数据库
    const amountInCents = Math.round(amountInYuan * 100)
    
    // 获取最新的 money 记录的 id
    if (!moneyData.value || !moneyData.value.id) {
      showToast('获取数据失败')
      return
    }
    
    // 更新最新的记录
    const { error: updateError } = await supabase
      .from('money')
      .update({ money: amountInCents })
      .eq('id', moneyData.value.id)
    
    if (updateError) {
      showToast('更新失败')
      console.error('更新失败:', updateError)
      return
    }
    
    // 更新本地数据（保持元为单位）
    if (moneyData.value) {
      moneyData.value.money = amountInYuan
    }
    
    showEditDialog.value = false
    showToast('修正成功')
  } catch (err) {
    console.error('修正失败:', err)
    showToast('修正失败')
  }
}

// 暴露刷新方法供父组件调用
const refresh = async () => {
  await fetchMoney()
}

onMounted(() => {
  fetchMoney()
})

defineExpose({
  refresh
})
</script>

<template>
  <div class="money-section">
    <div class="section-header">
      <h3>资金信息</h3>
    </div>
    
    <div v-if="loading" class="loading">
      <van-loading size="24px" />
      <span>加载中...</span>
    </div>
    
    <div v-else-if="error" class="error">
      <van-icon name="warning-o" />
      <p>{{ error }}</p>
    </div>
    
    <div v-else-if="moneyData" class="money-info">
      <!-- 总资产 -->
      <div class="total-assets">
        {{ totalAssets.toFixed(2) }}
      </div>
      
      <!-- 可用资金和总市值 -->
      <div class="money-row">
        <div class="money-item">
          <span class="label">可用资金</span>
          <div class="value-with-button">
            <span class="value">{{ moneyData.money.toFixed(2) }}</span>
            <van-button 
              type="primary" 
              size="mini"
              @click="openEditDialog"
            >
              修正
            </van-button>
          </div>
        </div>
        <div class="money-item">
          <span class="label">总市值</span>
          <span class="value">{{ Math.round(totalMarketValue) }}</span>
        </div>
      </div>
    </div>
    
    <div v-else class="empty">
      <p>暂无数据</p>
    </div>
    
    <!-- 修正金额对话框 -->
    <van-dialog
      v-model:show="showEditDialog"
      title="修正金额"
      show-cancel-button
      @confirm="confirmEdit"
    >
      <div class="dialog-content">
        <div class="amount-input-wrapper">
          <van-button 
            class="step-button"
            icon="minus"
            size="small"
            @click="decreaseAmount"
          />
          <van-field
            v-model="editAmount"
            type="number"
            placeholder="请输入金额"
            class="amount-field"
          >
            <template #right-icon>
              <span class="unit">元</span>
            </template>
          </van-field>
          <van-button 
            class="step-button"
            icon="plus"
            size="small"
            @click="increaseAmount"
          />
        </div>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped lang="less">
.money-section {
  margin-top: 20px;
  padding: 16px;
  background-color: #f9fafb;
  border-radius: 8px;
  min-height: 200px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.loading,
.error,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #6b7280;
}

.error {
  color: #ef4444;
}

.money-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.total-assets {
  text-align: center;
  font-size: 32px;
  font-weight: 700;
  color: #111827;
}

.money-row {
  display: flex;
  gap: 12px;
}

.money-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background-color: #ffffff;
  border-radius: 6px;
}

.money-item .label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.value-with-button {
  display: flex;
  align-items: center;
  gap: 8px;
}

.money-item .value {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.dialog-content {
  padding: 16px;
}

.amount-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-button {
  flex-shrink: 0;
}

.amount-field {
  flex: 1;
}

.unit {
  color: #646566;
  font-size: 14px;
  padding-right: 8px;
}
</style>

