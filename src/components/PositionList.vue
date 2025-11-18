<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { usePositionStore, type Position } from '@/stores/position'
import { supabase } from '@/lib/supabase'
import { formatNumber } from '@/utils/format'

interface Props {
  positionList: Position[]
  showReduceButton?: boolean // 是否显示减仓按钮，默认为 true
}

const props = withDefaults(defineProps<Props>(), {
  showReduceButton: true
})

const emit = defineEmits<{
  (e: 'reduce-success'): void
}>()

const router = useRouter()
const positionStore = usePositionStore()

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

// 跳转到股票详情页
const goToStockDetail = (position: Position) => {
  router.push(`/stock/${position.invt}/${position.stock}`)
}

// 减仓相关
const showReduceDialog = ref(false)
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

// 计算盈亏金额
const getProfitAmount = (position: Position): number => {
  if (position.currentPrice === undefined) return 0
  return (position.currentPrice - position.cost) * position.quantity
}

// 计算盈亏比例
const getProfitPercent = (position: Position): number => {
  if (position.currentPrice === undefined || position.cost === 0) return 0
  return ((position.currentPrice - position.cost) / position.cost) * 100
}

// 计算市值（现价 × 持股数）
const getMarketValue = (position: Position): number => {
  if (position.currentPrice === undefined) return 0
  return position.currentPrice * position.quantity
}

// 打开减仓对话框
const openReduceDialog = (position: Position) => {
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
  showReduceDialog.value = true
}

// 插入 track 记录
const insertTrackRecord = async (trackData: {
  stock: string
  invt: string
  name: string
  money: number // 单位：分（整数）
  price: number // 单位：分（1位小数）
  num: number // 股票数量（整数）
  track_type: 'increase' | 'reduce'
}) => {
  try {
    const { error: trackError } = await supabase
      .from('track')
      .insert([trackData])
    
    if (trackError) {
      throw trackError
    }
  } catch (err) {
    throw err
  }
}

// 更新资金信息（减仓时增加可用资金）
const updateMoneyInfo = async (totalAmount: number) => {
  try {
    // 获取今天的开始和结束时间
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowISO = tomorrow.toISOString()
    
    // 查找今天是否已有记录
    const { data: todayMoney, error: todayError } = await supabase
      .from('money')
      .select('*')
      .gte('created_at', todayISO)
      .lt('created_at', tomorrowISO)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (todayError) throw todayError
    
    // 计算新的资金数据（金额单位：分）
    const totalAmountInCents = Math.round(totalAmount * 100)
    
    if (todayMoney) {
      // 今天已有记录，更新它（减仓增加可用资金，只更新money，usedMoney由定时任务更新）
      const newMoney = todayMoney.money + totalAmountInCents
      
      const { error: updateError } = await supabase
        .from('money')
        .update({
          money: newMoney
        })
        .eq('id', todayMoney.id)
      
      if (updateError) throw updateError
    } else {
      // 今天没有记录，获取最新记录并插入新记录
      const { data: latestMoney, error: fetchError } = await supabase
        .from('money')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (fetchError) throw fetchError
      
      const newMoney = latestMoney.money + totalAmountInCents
      
      const { error: insertError } = await supabase
        .from('money')
        .insert({
          money: newMoney
        })
      
      if (insertError) throw insertError
    }
  } catch (err) {
    throw err
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

// 确认减仓
const confirmReduce = async () => {
  const { positionId, stock, invt, stockName, currentQuantity, sellPrice, reduceQuantity } = reduceForm.value
  
  if (!sellPrice) {
    showToast('请输入卖出价格')
    return
  }
  
  const sellPriceNum = parseFloat(sellPrice)
  
  if (isNaN(sellPriceNum) || sellPriceNum <= 0) {
    showToast('请输入有效的卖出价格')
    return
  }
  
  if (!reduceQuantity) {
    showToast('请输入减仓数量')
    return
  }
  
  const reduceNum = parseFloat(reduceQuantity)
  
  if (isNaN(reduceNum) || reduceNum <= 0) {
    showToast('请输入有效的数量')
    return
  }
  
  if (reduceNum % 100 !== 0) {
    showToast('减仓数量必须是100的倍数')
    return
  }
  
  if (reduceNum > currentQuantity) {
    showToast('减仓数量不能超过当前持股数')
    return
  }
  
  try {
    const newQuantity = currentQuantity - reduceNum
    
    // 先插入 track 记录（减仓）
    await insertTrackRecord({
      stock: stock,
      invt: invt,
      name: stockName,
      money: Math.round(sellPriceNum * reduceNum * 100), // 单位：分（整数）
      price: Math.round(sellPriceNum * 1000) / 10, // 单位：分（1位小数）
      num: Math.round(reduceNum), // 确保是整数
      track_type: 'reduce'
    })
    
    // 更新资金信息（减仓释放资金）
    await updateMoneyInfo(sellPriceNum * reduceNum)
    
    // 再更新持仓（清仓时不删除记录，而是设置为0）
    if (newQuantity === 0) {
      // 完全清仓，将 quantity 和 cost 都设置为 0
      await positionStore.updatePosition(positionId, 0, 0)
      showToast('已清仓')
    } else {
      // 更新持股数量和成本价
      await positionStore.updatePosition(positionId, newQuantity, reduceForm.value.newCost)
      showToast('减仓成功')
    }
    
    showReduceDialog.value = false
    emit('reduce-success')
  } catch (err) {
    showToast('减仓失败')
  }
}
</script>

<template>
  <div class="position-list">
    <div 
      v-for="position in positionList" 
      :key="position.id" 
      class="position-item"
      @click="goToStockDetail(position)"
    >
      <div class="position-header">
        <div class="stock-info">
          <span class="position-name">{{ position.name }}</span>
          <span class="position-stock">{{ position.stock }}</span>
        </div>
        <div class="price-info">
          <span 
            v-if="position.currentPrice !== undefined" 
            class="current-price"
          >
            {{ formatNumber(position.currentPrice, 3) }}
          </span>
          <span v-else class="current-price loading-text">--</span>
          
          <span 
            v-if="!showTradingData"
            class="change-percent"
          >
            -
          </span>
          <span 
            v-else-if="position.changePercent !== undefined"
            class="change-percent"
            :class="{
              'price-up': position.changePercent > 0,
              'price-down': position.changePercent < 0
            }"
          >
            {{ position.changePercent > 0 ? '+' : '' }}{{ formatNumber(position.changePercent, 2) }}%
          </span>
          <span v-else class="change-percent loading-text">--</span>
        </div>
      </div>
      <div class="position-details">
        <span v-if="position.currentPrice !== undefined" class="market-value">
          ¥{{ formatNumber(getMarketValue(position), 2) }}
        </span>
        <span class="detail-item">
          <span class="label">成本:</span>
          <span class="value">{{ formatNumber(position.cost, 3) }}</span>
        </span>
        <span class="detail-item">
          <span class="label">持股:</span>
          <span class="value">{{ position.quantity }}</span>
        </span>
      </div>
      
      <!-- 盈亏信息和减仓按钮 -->
      <div class="profit-loss-row">
        <div v-if="position.currentPrice !== undefined" class="profit-loss">
          <span class="label">盈亏:</span>
          <span 
            class="value"
            :class="{
              'price-up': getProfitAmount(position) > 0,
              'price-down': getProfitAmount(position) < 0
            }"
          >
            ¥{{ formatNumber(getProfitAmount(position), 2) }}
            ({{ getProfitPercent(position) > 0 ? '+' : '' }}{{ formatNumber(getProfitPercent(position), 2) }}%)
          </span>
        </div>
        <van-button 
          v-if="props.showReduceButton"
          type="warning" 
          size="mini"
          @click.stop="openReduceDialog(position)"
        >
          减仓
        </van-button>
      </div>
    </div>
    
    <!-- 减仓对话框 -->
    <van-dialog
      v-if="props.showReduceButton"
      v-model:show="showReduceDialog"
      title="减仓"
      show-cancel-button
      @confirm="confirmReduce"
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
        
        <p class="hint">提示：减仓数量必须是100的倍数</p>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped lang="less">
.position-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.position-item {
  padding: 16px;
  background-color: #ffffff;
  border-radius: 8px;
  border-left: 3px solid #1989fa;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: #f9fafb;
  }
  
  &:active {
    transform: scale(0.98);
  }
}

.position-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.stock-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.position-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.position-stock {
  font-size: 12px;
  color: #969799;
}

.price-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-price {
  font-size: 16px;
  font-weight: 600;
}

.change-percent {
  font-size: 14px;
  font-weight: 500;
}

.position-details {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
}

.market-value {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 4px;
  
  .label {
    color: #6b7280;
  }
  
  .value {
    color: #111827;
    font-weight: 500;
  }
}

.price-up {
  color: #ef4444 !important;
}

.price-down {
  color: #10b981 !important;
}

.loading-text {
  color: #9ca3af;
}

.profit-loss-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.profit-loss {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  
  .label {
    color: #6b7280;
  }
  
  .value {
    font-weight: 600;
  }
}

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

