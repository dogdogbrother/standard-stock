<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { showToast } from 'vant'
import AddPositionDialog from './AddPositionDialog.vue'

interface Position {
  id: number
  stock: string
  name: string
  cost: number
  quantity: number
  created_at: string
  currentPrice?: number
  changePercent?: number
}

const positionLoading = ref(false)
const positionList = ref<Position[]>([])
const showAddDialog = ref(false)

// 减仓相关
const showReduceDialog = ref(false)
const reduceForm = ref({
  positionId: 0,
  stockName: '',
  currentQuantity: 0,
  currentCost: 0,
  sellPrice: '',
  reduceQuantity: '',
  newCost: 0
})

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
  if (positions.length === 0) return

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
      positionList.value = positions.map(pos => ({
        ...pos,
        currentPrice: stockDataMap.get(pos.stock)?.currentPrice,
        changePercent: stockDataMap.get(pos.stock)?.changePercent
      }))
    }
  } catch (err) {
    console.error('获取股票实时数据失败:', err)
    // 获取实时数据失败不影响持股列表显示
    positionList.value = positions
  }
}

// 获取持股列表
const fetchPositions = async () => {
  positionLoading.value = true
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
    await fetchStockRealTimeData(positions)
  } catch (err) {
    console.error('获取持股列表失败:', err)
    showToast('获取持股列表失败')
  } finally {
    positionLoading.value = false
  }
}

// 打开录入持股对话框
const openAddDialog = () => {
  showAddDialog.value = true
}

// 添加成功后刷新列表
const handleAddSuccess = () => {
  fetchPositions()
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

// 打开减仓对话框
const openReduceDialog = (position: Position) => {
  reduceForm.value = {
    positionId: position.id,
    stockName: position.name,
    currentQuantity: position.quantity,
    currentCost: position.cost,
    sellPrice: position.currentPrice ? position.currentPrice.toString() : '',
    reduceQuantity: '',
    newCost: position.cost
  }
  showReduceDialog.value = true
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
  // 这样盈利会降低成本价，亏损会提高成本价
  const originalTotalCost = currentCost * currentQuantity
  const sellIncome = sellPriceNum * reduceNum
  const newTotalCost = originalTotalCost - sellIncome
  const newCost = newTotalCost / newQuantity
  
  reduceForm.value.newCost = Math.max(0, newCost) // 确保成本价不为负
}

// 确认减仓
const confirmReduce = async () => {
  const { positionId, currentQuantity, sellPrice, reduceQuantity } = reduceForm.value
  
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
    
    if (newQuantity === 0) {
      // 完全清仓，删除记录
      const { error: deleteError } = await supabase
        .from('position')
        .delete()
        .eq('id', positionId)
      
      if (deleteError) throw deleteError
      
      showToast('已清仓')
    } else {
      // 更新持股数量和成本价
      const newCostInCents = Math.round(reduceForm.value.newCost * 100)
      
      const { error: updateError } = await supabase
        .from('position')
        .update({ 
          quantity: newQuantity,
          cost: newCostInCents
        })
        .eq('id', positionId)
      
      if (updateError) throw updateError
      
      showToast('减仓成功')
    }
    
    showReduceDialog.value = false
    fetchPositions()
  } catch (err) {
    console.error('减仓失败:', err)
    showToast('减仓失败')
  }
}

onMounted(() => {
  fetchPositions()
})
</script>

<template>
  <div class="position-section">
    <div class="section-header">
      <h3>持股信息</h3>
      <van-button 
        type="primary" 
        size="small"
        icon="add-o"
        @click="openAddDialog"
      >
        录入持股
      </van-button>
    </div>
    
    <div v-if="positionLoading" class="loading">
      <van-loading size="24px" />
      <span>加载中...</span>
    </div>
    
    <div v-else-if="positionList.length === 0" class="empty">
      <p>暂无持股数据</p>
    </div>
    
    <div v-else class="position-list">
      <div 
        v-for="position in positionList" 
        :key="position.id" 
        class="position-item"
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
              {{ position.currentPrice.toFixed(2) }}
            </span>
            <span v-else class="current-price loading-text">--</span>
            
            <span 
              v-if="position.changePercent !== undefined"
              class="change-percent"
              :class="{
                'price-up': position.changePercent > 0,
                'price-down': position.changePercent < 0
              }"
            >
              {{ position.changePercent > 0 ? '+' : '' }}{{ position.changePercent.toFixed(2) }}%
            </span>
            <span v-else class="change-percent loading-text">--</span>
          </div>
        </div>
        <div class="position-details">
          <span class="detail-item">
            <span class="label">成本价：</span>
            <span class="value">{{ position.cost.toFixed(2) }}</span>
          </span>
          <span class="detail-item">
            <span class="label">持股数：</span>
            <span class="value">{{ position.quantity }}</span>
          </span>
        </div>
        
        <!-- 盈亏信息和减仓按钮 -->
        <div class="profit-loss-row">
          <div v-if="position.currentPrice !== undefined" class="profit-loss">
            <span class="label">盈亏：</span>
            <span 
              class="value"
              :class="{
                'price-up': getProfitAmount(position) > 0,
                'price-down': getProfitAmount(position) < 0
              }"
            >
              ¥{{ getProfitAmount(position).toFixed(2) }}
              ({{ getProfitPercent(position) > 0 ? '+' : '' }}{{ getProfitPercent(position).toFixed(2) }}%)
            </span>
          </div>
          <van-button 
            type="warning" 
            size="mini"
            @click="openReduceDialog(position)"
          >
            减仓
          </van-button>
        </div>
      </div>
    </div>
    
    <!-- 录入持股对话框 -->
    <AddPositionDialog 
      v-model:visible="showAddDialog"
      @success="handleAddSuccess"
    />
    
    <!-- 减仓对话框 -->
    <van-dialog
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
        <van-field
          v-model="reduceForm.reduceQuantity"
          label="减仓数量"
          type="number"
          placeholder="请输入减仓数量"
          required
          @input="calculateNewCost"
        >
          <template #right-icon>
            <span class="unit">股</span>
          </template>
        </van-field>
        
        <!-- 显示新成本价 -->
        <div v-if="reduceForm.reduceQuantity && parseFloat(reduceForm.reduceQuantity) > 0 && parseFloat(reduceForm.reduceQuantity) < reduceForm.currentQuantity" class="new-cost-info">
          <div class="cost-row">
            <span class="label">原成本价：</span>
            <span class="value">{{ reduceForm.currentCost.toFixed(2) }} 元</span>
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
              {{ reduceForm.newCost.toFixed(2) }} 元
            </span>
          </div>
        </div>
        
        <p class="hint">提示：减仓数量必须是100的倍数</p>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped lang="less">
.position-section {
  margin-top: 20px;
  padding: 16px;
  background-color: #f9fafb;
  border-radius: 8px;
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
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #6b7280;
}

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
</style>
