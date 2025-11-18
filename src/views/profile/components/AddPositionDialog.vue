<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { supabase } from '@/lib/supabase'
import { showToast, showConfirmDialog } from 'vant'
import { useMoneyStore } from '@/stores/money'
import { formatNumber } from '@/utils/format'

const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{
  success: []
}>()

const moneyStore = useMoneyStore()

const positionForm = ref({
  stock: '',
  cost: '',
  quantity: ''
})

// 增加持股数量（加100）
const increaseQuantity = () => {
  const current = parseFloat(positionForm.value.quantity) || 0
  positionForm.value.quantity = String(current + 100)
}

// 减少持股数量（减100）
const decreaseQuantity = () => {
  const current = parseFloat(positionForm.value.quantity) || 0
  if (current >= 100) {
    positionForm.value.quantity = String(current - 100)
  }
}

// 股票搜索建议相关
const searchLoading = ref(false)
const searchResults = ref<any[]>([])
const showSearchDropdown = ref(false)
const selectedStockName = ref('')
const selectedStockMarket = ref('')

// 待确认的重复股票信息
let pendingDuplicateInfo: any = null

// 重置表单
const resetForm = () => {
  positionForm.value = {
    stock: '',
    cost: '',
    quantity: ''
  }
  searchResults.value = []
  showSearchDropdown.value = false
  selectedStockName.value = ''
  selectedStockMarket.value = ''
}

// 搜索股票
let searchTimer: any = null
const onStockInput = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  
  const keyword = String(positionForm.value.stock || '').trim()
  
  if (!keyword) {
    searchResults.value = []
    showSearchDropdown.value = false
    selectedStockName.value = ''
    selectedStockMarket.value = ''
    return
  }
  
  searchTimer = setTimeout(async () => {
    await searchStock(keyword)
  }, 300)
}

// 调用股票搜索 API
const searchStock = async (keyword: string) => {
  searchLoading.value = true
  try {
    const apiUrl = import.meta.env.VITE_STOCK_SEARCH_API || 'http://localhost:54321/functions/v1/stock-search'
    const response = await fetch(`${apiUrl}?q=${encodeURIComponent(keyword)}`)
    const data = await response.json()
    
    if (data.code === 0 && data.data?.stock) {
      searchResults.value = data.data.stock
        .filter((item: any[]) => item[4]?.startsWith('GP-A'))
        .map((item: any[]) => ({
          market: item[0],
          code: item[1],
          name: item[2]
        }))
      showSearchDropdown.value = searchResults.value.length > 0
      
      const exactMatch = searchResults.value.find(
        stock => stock.code === keyword
      )
      if (exactMatch) {
        selectedStockName.value = exactMatch.name
        selectedStockMarket.value = exactMatch.market
        showSearchDropdown.value = false
      } else {
        selectedStockName.value = ''
        selectedStockMarket.value = ''
      }
    } else {
      searchResults.value = []
      showSearchDropdown.value = false
      selectedStockName.value = ''
      selectedStockMarket.value = ''
    }
  } catch (err) {
    searchResults.value = []
    showSearchDropdown.value = false
    selectedStockName.value = ''
    selectedStockMarket.value = ''
  } finally {
    searchLoading.value = false
  }
}

// 选择股票
const selectStock = (stock: any) => {
  positionForm.value.stock = stock.code
  selectedStockName.value = stock.name
  selectedStockMarket.value = stock.market
  searchResults.value = []
  showSearchDropdown.value = false
}

// 检查股票是否重复
const checkDuplicateStock = async (stockCode: string) => {
  try {
    const { data: existingData, error: queryError } = await supabase
      .from('position')
      .select('id, name, cost, quantity')
      .eq('stock', stockCode)
      .maybeSingle()
    
    if (queryError) throw queryError
    
    if (existingData) {
      pendingDuplicateInfo = {
        existing: existingData,
        form: { ...positionForm.value },
        stockName: selectedStockName.value
      }
      return true
    }
    
    return false
  } catch (err) {
    return false
  }
}

// 录入持股的前置处理
const beforeCloseDialog = async (action: string) => {
  if (action === 'confirm') {
    const { stock, cost, quantity } = positionForm.value
    
    if (!stock.trim()) {
      showToast('请输入股票代码')
      return false
    }
    
    if (!cost || isNaN(parseFloat(cost))) {
      showToast('请输入有效的买入价')
      return false
    }
    
    if (!quantity || isNaN(parseFloat(quantity))) {
      showToast('请输入有效的持股数量')
      return false
    }
    
    const quantityNum = parseFloat(quantity)
    if (quantityNum % 100 !== 0) {
      showToast('持股数量必须是100的倍数')
      return false
    }
    
    const isDuplicate = await checkDuplicateStock(stock.trim())
    if (isDuplicate) {
      return true
    }
    
    // 如果没有选中股票（没有 market 或 name 信息），则从搜索结果中获取
    if (!selectedStockMarket.value || !selectedStockName.value) {
      await searchStock(stock.trim())
      const matchedStock = searchResults.value.find(s => s.code === stock.trim())
      if (matchedStock) {
        selectedStockMarket.value = matchedStock.market
        selectedStockName.value = matchedStock.name
      }
    }
    
    // 校验股票名称和市场类型必须存在
    if (!selectedStockName.value) {
      showToast('未找到该股票信息，请重新选择')
      return false
    }
    
    if (!selectedStockMarket.value) {
      showToast('股票市场类型缺失，请重新选择')
      return false
    }
    
    const success = await addPosition()
    return success
  }
  return true
}

// 更新资金信息（录入持股时减少可用资金，传入负值）
const updateMoneyInfo = async (totalAmount: number) => {
  try {
    // 录入持股时需要减少可用资金，所以传入负值
    await moneyStore.updateMoneyByAmount(-totalAmount)
  } catch (err) {
    throw err
  }
}

// 录入持股（仅用于新增股票）
const addPosition = async () => {
  const { stock, cost, quantity } = positionForm.value
  
  try {
    // cost 保留3位小数(元)，转为1位小数(分): 11.678元 → 1167.8分
    const costInCents = Math.round(parseFloat(cost) * 1000) / 10
    const costValue = parseFloat(cost)
    const quantityValue = parseFloat(quantity)
    
    const { error: insertError } = await supabase
      .from('position')
      .insert([{
        stock: stock.trim(),
        invt: selectedStockMarket.value || 'sh',
        name: selectedStockName.value || '',
        cost: costInCents,
        quantity: quantityValue
      }])
    
    if (insertError) throw insertError
    
    const totalAmount = costValue * quantityValue
    
    // 先插入 track 记录（加仓）
    await insertTrackRecord({
      stock: stock.trim(),
      invt: selectedStockMarket.value || 'sh',
      name: selectedStockName.value || '',
      money: Math.round(totalAmount * 100), // 单位：分（整数）
      price: Math.round(costValue * 1000) / 10, // 单位：分（1位小数）
      num: Math.round(quantityValue), // 确保是整数
      track_type: 'increase'
    })
    
    // 再更新资金信息
    await updateMoneyInfo(totalAmount)
    
    await addToWatchlistIfNotExists(stock.trim(), selectedStockMarket.value)
    
    showToast('录入成功')
    emit('success')
    return true
  } catch (err) {
    showToast('录入失败')
    return false
  }
}

// 插入 track 记录
const insertTrackRecord = async (trackData: {
  stock: string
  invt: string
  name: string
  money: number // 单位：分（整数）
  price: number // 单位：分（整数）
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

// 检查股票是否在 watchlist 中，如果不存在则添加
const addToWatchlistIfNotExists = async (stockCode: string, stockMarket: string) => {
  try {
    const { data: existingWatch } = await supabase
      .from('watchlist')
      .select('id')
      .eq('stock', stockCode)
      .maybeSingle()
    
    if (!existingWatch) {
      const { error: insertError } = await supabase
        .from('watchlist')
        .insert([{
          stock: stockCode,
          invt: stockMarket || 'sh'
        }])
      
      if (insertError) {
      }
    }
  } catch (err) {
  }
}

// 监听弹窗打开，重置表单
watch(visible, (newVal) => {
  if (newVal) {
    resetForm()
  }
})

// 监听弹窗关闭，处理重复股票确认
watch(visible, async (newVal, oldVal) => {
  if (oldVal === true && newVal === false && pendingDuplicateInfo) {
    await nextTick()
    
    const { existing, form, stockName } = pendingDuplicateInfo
    const oldCost = existing.cost / 100
    const oldQuantity = existing.quantity
    const newCost = parseFloat(form.cost)
    const newQuantity = parseFloat(form.quantity)
    
    const totalCost = (oldCost * oldQuantity) + (newCost * newQuantity)
    const totalQuantity = oldQuantity + newQuantity
    const avgCost = totalCost / totalQuantity
    
    try {
      await showConfirmDialog({
        title: '股票已存在',
        message: `成本价格已变动 (${formatNumber(avgCost, 3)}元)`,
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      })
      
      // avgCost 保留3位小数(元)，转为1位小数(分): 11.678元 → 1167.8分
      const avgCostInCents = Math.round(avgCost * 1000) / 10
      const { error: updateError } = await supabase
        .from('position')
        .update({
          cost: avgCostInCents,
          quantity: totalQuantity,
          name: stockName || existing.name
        })
        .eq('id', existing.id)
      
      if (updateError) throw updateError
      
      const newAddAmount = newCost * newQuantity
      
      // 先插入 track 记录（加仓）
      await insertTrackRecord({
        stock: form.stock.trim(),
        invt: selectedStockMarket.value || 'sh',
        name: stockName || existing.name,
        money: Math.round(newAddAmount * 100), // 单位：分（整数）
        price: Math.round(newCost * 1000) / 10, // 单位：分（1位小数）
        num: Math.round(newQuantity), // 确保是整数
        track_type: 'increase'
      })
      
      // 再更新资金信息（只需要计算新增的金额）
      await updateMoneyInfo(newAddAmount)
      
      showToast('更新成功')
      emit('success')
    } catch (err) {
      if (err !== 'cancel') {
        showToast('更新失败')
      }
    } finally {
      pendingDuplicateInfo = null
    }
  }
})
</script>

<template>
  <van-dialog
    v-model:show="visible"
    title="录入持股"
    show-cancel-button
    :before-close="beforeCloseDialog"
  >
    <div class="dialog-content">
      <!-- 股票代码输入（带搜索建议） -->
      <div class="stock-input-wrapper">
        <van-field
          v-model="positionForm.stock"
          label="股票代码"
          placeholder="输入股票代码或名称"
          required
          @input="onStockInput"
        >
          <template #right-icon>
            <van-loading v-if="searchLoading" size="16px" />
          </template>
        </van-field>
        
        <!-- 显示选中的股票名称 -->
        <div v-if="selectedStockName" class="selected-stock-hint">
          {{ selectedStockName }}
        </div>
        
        <!-- 搜索结果下拉列表 -->
        <div v-if="showSearchDropdown" class="search-dropdown">
          <div 
            v-for="stock in searchResults" 
            :key="stock.code"
            class="search-item"
            @click="selectStock(stock)"
          >
            <span class="stock-code">{{ stock.code }}</span>
            <span class="stock-name">{{ stock.name }}</span>
            <span class="stock-market">{{ stock.market.toUpperCase() }}</span>
          </div>
        </div>
      </div>
      
      <van-field
        v-model="positionForm.cost"
        label="买入价"
        type="number"
        placeholder="请输入买入价"
        required
      >
        <template #right-icon>
          <span class="unit">元</span>
        </template>
      </van-field>
      <div class="quantity-field-wrapper">
        <div class="quantity-label">持股数量</div>
        <div class="quantity-control">
          <van-button 
            icon="minus" 
            size="small" 
            @click="decreaseQuantity"
            :disabled="!positionForm.quantity || parseFloat(positionForm.quantity) < 100"
          />
          <van-field
            v-model="positionForm.quantity"
            type="number"
            placeholder="持股数量"
            class="quantity-input"
            center
          />
          <van-button 
            icon="plus" 
            size="small" 
            @click="increaseQuantity"
          />
        </div>
        <span class="quantity-unit">股</span>
      </div>
    </div>
  </van-dialog>
</template>

<style scoped lang="less">
.dialog-content {
  padding: 16px;
}

.stock-input-wrapper {
  position: relative;
}

.selected-stock-hint {
  padding: 4px 16px 8px 116px;
  font-size: 12px;
  color: #969799;
  line-height: 16px;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  background-color: #ffffff;
  border: 1px solid #ebedf0;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  margin-top: 4px;
}

.search-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f7f8fa;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: #f7f8fa;
  }
  
  &:active {
    background-color: #ebedf0;
  }
}

.stock-code {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  min-width: 70px;
  flex-shrink: 0;
}

.stock-name {
  flex: 1;
  font-size: 14px;
  color: #646566;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stock-market {
  font-size: 12px;
  color: #969799;
  padding: 2px 6px;
  background-color: #f2f3f5;
  border-radius: 3px;
  flex-shrink: 0;
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

