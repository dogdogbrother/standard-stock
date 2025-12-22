<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { usePositionStore } from '@/stores/position'
import { useMoneyStore } from '@/stores/money'
import { formatNumber } from '@/utils/format'

defineProps<{
  refreshing?: boolean
  allDataLoaded?: boolean
}>()

const showEditDialog = ref(false)
const editAmount = ref('')

const positionStore = usePositionStore()
const moneyStore = useMoneyStore()
const router = useRouter()

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
  if (!moneyStore.moneyData) return 0
  return moneyStore.moneyData.money + totalMarketValue.value
})

// 打开修改对话框
const openEditDialog = () => {
  if (!moneyStore.moneyData) return
  editAmount.value = moneyStore.moneyData.money.toString()
  showEditDialog.value = true
}

// 增加金额
const increaseAmount = () => {
  const current = parseFloat(editAmount.value) || 0
  editAmount.value = formatNumber(current + 0.01, 2).toString()
}

// 减少金额
const decreaseAmount = () => {
  const current = parseFloat(editAmount.value) || 0
  const newAmount = Math.max(0, current - 0.01) // 不能小于 0
  editAmount.value = formatNumber(newAmount, 2).toString()
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
    await moneyStore.updateMoney(amountInYuan)
    showEditDialog.value = false
    showToast('修正成功')
  } catch (err) {
    showToast('修正失败')
  }
}

// 暴露刷新方法供父组件调用（下拉刷新时使用）
const refresh = async () => {
  await moneyStore.refreshMoney()
}

const goHome = () => {
  router.push('/')
}

// onMounted 不再需要加载数据，由父组件统一加载
// onMounted(async () => {
//   // 只在缓存为空时才请求
//   if (!moneyStore.moneyData) {
//     await moneyStore.fetchMoney()
//   }
// })

defineExpose({
  refresh
})
</script>

<template>
  <div class="money-section">
    <div class="section-header">
      <h3>资金信息</h3>
    </div>
    
    <div v-if="!allDataLoaded && !refreshing" class="loading">
      <van-loading size="24px" />
      <span>加载中...</span>
    </div>
    
    <div v-else-if="moneyStore.error && !refreshing" class="error">
      <van-icon name="warning-o" />
      <p>{{ moneyStore.error }}</p>
    </div>
    
    <div v-else-if="moneyStore.moneyData && allDataLoaded" class="money-info">
      <!-- 总资产 -->
      <div class="total-assets">
        {{ formatNumber(totalAssets, 2) }}
      </div>
      
      <!-- 可用资金和总市值 -->
      <div class="money-row">
        <div class="money-item">
          <span class="label">可用资金</span>
          <div class="value-with-button">
            <span class="value">{{ formatNumber(moneyStore.moneyData.money, 2) }}</span>
            <van-button 
              type="primary" 
              size="mini"
              @click="openEditDialog"
            >
              修正
            </van-button>
          </div>
        </div>
        <div class="money-item total-market" @click="goHome">
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

.money-item.total-market {
  cursor: pointer;
  transition: transform 0.2s ease;
  
  &:active {
    transform: scale(0.98);
  }
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

