<script setup lang="ts">
import { ref } from 'vue'
import { showToast } from 'vant'
import { usePositionStore, type Position } from '@/stores/position'
import { formatNumber } from '@/utils/format'

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  success: []
}>()

const positionStore = usePositionStore()

const reduceForm = ref({
  positionId: 0,
  stock: '',
  invt: '',
  stockName: '',
  currentQuantity: 0,
  currentCost: 0,
  sellPrice: '',
  reduceQuantity: '',
  newCost: 0
})

// 打开对话框
const open = (position: Position) => {
  reduceForm.value = {
    positionId: position.id,
    stock: position.stock,
    invt: position.invt,
    stockName: position.name,
    currentQuantity: position.quantity,
    currentCost: position.cost,
    sellPrice: position.currentPrice ? position.currentPrice.toString() : '',
    reduceQuantity: '',
    newCost: position.cost
  }
  visible.value = true
}

// 增加减仓数量（加100）
const increaseReduceQuantity = () => {
  const current = parseFloat(reduceForm.value.reduceQuantity) || 0
  const newQuantity = current + 100
  // 不能超过当前持股数量
  if (newQuantity <= reduceForm.value.currentQuantity) {
    reduceForm.value.reduceQuantity = String(newQuantity)
    calculateNewCost()
  }
}

// 减少减仓数量（减100）
const decreaseReduceQuantity = () => {
  const current = parseFloat(reduceForm.value.reduceQuantity) || 0
  if (current >= 100) {
    reduceForm.value.reduceQuantity = String(current - 100)
    calculateNewCost()
  }
}

// 计算减仓后的新成本价
const calculateNewCost = () => {
  const { currentQuantity, currentCost, sellPrice, reduceQuantity } = reduceForm.value
  
  if (!sellPrice || !reduceQuantity) {
    reduceForm.value.newCost = currentCost
    return
  }
  
  const sellPriceNum = parseFloat(sellPrice)
  const reduceNum = parseFloat(reduceQuantity)
  
  if (isNaN(sellPriceNum) || isNaN(reduceNum) || reduceNum <= 0) {
    reduceForm.value.newCost = currentCost
    return
  }
  
  const newQuantity = currentQuantity - reduceNum
  
  if (newQuantity <= 0) {
    reduceForm.value.newCost = 0
    return
  }
  
  // 计算新成本价：(原总成本 - 卖出收入) / 新持股数
  const originalTotalCost = currentCost * currentQuantity
  const sellIncome = sellPriceNum * reduceNum
  const newTotalCost = originalTotalCost - sellIncome
  const newCost = newTotalCost / newQuantity
  
  reduceForm.value.newCost = Math.max(0, newCost)
}

// 减仓对话框关闭前的处理
const beforeCloseDialog = async (action: string) => {
  if (action === 'confirm') {
    const { currentQuantity, sellPrice, reduceQuantity } = reduceForm.value
    
    if (!sellPrice) {
      showToast('请输入卖出价格')
      return false
    }
    
    const sellPriceNum = parseFloat(sellPrice)
    
    if (isNaN(sellPriceNum) || sellPriceNum <= 0) {
      showToast('请输入有效的卖出价格')
      return false
    }
    
    if (!reduceQuantity) {
      showToast('请输入减仓数量')
      return false
    }
    
    const reduceNum = parseFloat(reduceQuantity)
    
    if (isNaN(reduceNum) || reduceNum <= 0) {
      showToast('请输入有效的数量')
      return false
    }
    
    if (reduceNum % 100 !== 0) {
      showToast('减仓数量必须是100的倍数')
      return false
    }
    
    if (reduceNum > currentQuantity) {
      showToast('减仓数量不能超过当前持股数')
      return false
    }
    
    const success = await reducePosition()
    return success
  }
  return true
}

// 调用 Edge Function 减仓
const reducePosition = async () => {
  try {
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    
    const response = await fetch('https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/reduce-position', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        positionId: reduceForm.value.positionId,
        stock: reduceForm.value.stock,
        invt: reduceForm.value.invt,
        name: reduceForm.value.stockName,
        sellPrice: parseFloat(reduceForm.value.sellPrice),
        reduceQuantity: parseFloat(reduceForm.value.reduceQuantity),
        currentQuantity: reduceForm.value.currentQuantity,
        currentCost: reduceForm.value.currentCost
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      // 刷新持仓数据
      await positionStore.fetchPositions()
      showToast(result.message)
      emit('success')
      return true
    } else {
      showToast(result.error || '减仓失败')
      return false
    }
  } catch (err) {
    console.error('减仓失败:', err)
    showToast('减仓失败，请稍后重试')
    return false
  }
}

defineExpose({
  open
})
</script>

<template>
  <van-dialog
    v-model:show="visible"
    title="减仓"
    show-cancel-button
    confirm-button-color="#1890ff"
    :before-close="beforeCloseDialog"
  >
    <div class="dialog-content">
      <div class="reduce-info">
        <p class="stock-name">{{ reduceForm.stockName }}</p>
        <p class="current-quantity">当前持股：{{ reduceForm.currentQuantity }} 股</p>
      </div>
      <van-field
        v-model="reduceForm.sellPrice"
        label="卖出价格"
        type="number"
        placeholder="请输入卖出价格"
        required
        @input="calculateNewCost"
      >
        <template #right-icon>
          <span class="unit">元</span>
        </template>
      </van-field>
      <div class="quantity-field-wrapper">
        <div class="quantity-label">减仓数量</div>
        <div class="quantity-control">
          <van-button 
            icon="minus" 
            size="small" 
            @click="decreaseReduceQuantity"
            :disabled="!reduceForm.reduceQuantity || parseFloat(reduceForm.reduceQuantity) < 100"
          />
          <van-field
            v-model="reduceForm.reduceQuantity"
            type="number"
            placeholder="减仓数量"
            class="quantity-input"
            center
            @input="calculateNewCost"
          />
          <van-button 
            icon="plus" 
            size="small" 
            @click="increaseReduceQuantity"
            :disabled="!reduceForm.reduceQuantity ? false : parseFloat(reduceForm.reduceQuantity) + 100 > reduceForm.currentQuantity"
          />
        </div>
        <span class="quantity-unit">股</span>
      </div>
      
      <!-- 显示新成本价 -->
      <div v-if="reduceForm.reduceQuantity && parseFloat(reduceForm.reduceQuantity) > 0 && parseFloat(reduceForm.reduceQuantity) < reduceForm.currentQuantity" class="new-cost-info">
        <div class="cost-row">
          <span class="label">原成本价：</span>
          <span class="value">{{ formatNumber(reduceForm.currentCost, 3) }} 元</span>
        </div>
        <div class="cost-row">
          <span class="label">新成本价：</span>
          <span 
            class="value new-cost"
            :class="{
              'cost-down': reduceForm.newCost < reduceForm.currentCost,
              'cost-up': reduceForm.newCost > reduceForm.currentCost
            }"
          >
            {{ formatNumber(reduceForm.newCost, 3) }} 元
          </span>
        </div>
      </div>
      
      <!-- 清仓提示 -->
      <div v-if="reduceForm.reduceQuantity && parseFloat(reduceForm.reduceQuantity) === reduceForm.currentQuantity" class="clear-position-warning">
        <van-icon name="warning-o" />
        <span>已清仓</span>
      </div>
      
      <p class="hint">提示：减仓数量必须是100的倍数</p>
    </div>
  </van-dialog>
</template>

<style scoped lang="less">
.dialog-content {
  padding: 16px;
}

.reduce-info {
  margin-bottom: 16px;
  padding: 12px;
  background-color: #f7f8fa;
  border-radius: 6px;
  
  .stock-name {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    margin: 0 0 8px 0;
  }
  
  .current-quantity {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }
}

.new-cost-info {
  margin: 12px 16px;
  padding: 12px;
  background-color: #fffbe6;
  border-radius: 6px;
  border: 1px solid #ffe58f;
  
  .cost-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .label {
      font-size: 14px;
      color: #6b7280;
    }
    
    .value {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
      
      &.new-cost {
        font-size: 16px;
        font-weight: 600;
      }
    }
  }
  
  .cost-down {
    color: #10b981 !important;
  }
  
  .cost-up {
    color: #ef4444 !important;
  }
}

.clear-position-warning {
  margin: 12px 16px;
  padding: 12px;
  background-color: #fff2f0;
  border-radius: 6px;
  border: 1px solid #ffccc7;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #ef4444;
  font-size: 16px;
  font-weight: 600;
  
  :deep(.van-icon) {
    font-size: 20px;
  }
}

.hint {
  margin: 8px 0 0 0;
  padding: 0 16px;
  font-size: 12px;
  color: #969799;
}

.unit {
  color: #646566;
  font-size: 14px;
  padding-right: 8px;
}

.quantity-field-wrapper {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background-color: #ffffff;
  
  .quantity-label {
    font-size: 14px;
    color: #646566;
    margin-right: 12px;
    width: 88px;
    flex-shrink: 0;
  }
  
  .quantity-control {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    
    .quantity-input {
      flex: 1;
      padding: 0;
      
      :deep(.van-field__control) {
        text-align: center;
      }
    }
    
    :deep(.van-button) {
      width: 28px;
      height: 28px;
      padding: 0;
      font-size: 12px;
    }
  }
  
  .quantity-unit {
    color: #646566;
    font-size: 14px;
    margin-left: 8px;
    flex-shrink: 0;
  }
}
</style>

