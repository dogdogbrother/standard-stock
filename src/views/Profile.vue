<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { supabase } from '@/lib/supabase'
import { showToast, showConfirmDialog } from 'vant'

interface MoneyRecord {
  id: number
  money: number
  created_at: string
}

interface Position {
  id: number
  stock: string
  name: string
  cost: number
  quantity: number
  created_at: string
}

const loading = ref(false)
const moneyData = ref<MoneyRecord | null>(null)
const error = ref('')
const showEditDialog = ref(false)
const editAmount = ref('')

// 持股相关状态
const positionLoading = ref(false)
const positionList = ref<Position[]>([])
const showAddPositionDialog = ref(false)
const positionForm = ref({
  stock: '',
  cost: '',
  quantity: ''
})

// 股票搜索建议相关
const searchLoading = ref(false)
const searchResults = ref<any[]>([])
const showSearchDropdown = ref(false)
const selectedStockName = ref('')

// 获取 money 数据
const fetchMoney = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const { data, error: fetchError } = await supabase
      .from('money')
      .select('*')
      .eq('id', 1) // 查询 id = 1 的记录
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
    
    // 更新数据库
    const { error: updateError } = await supabase
      .from('money')
      .update({ money: amountInCents })
      .eq('id', 1)
    
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
    positionList.value = (data || []).map((pos: any) => ({
      id: pos.id,
      stock: pos.stock,
      name: pos.name,
      cost: pos.cost / 100,
      quantity: pos.quantity,
      created_at: pos.created_at
    }))
  } catch (err) {
    console.error('获取持股列表失败:', err)
    showToast('获取持股列表失败')
  } finally {
    positionLoading.value = false
  }
}

// 打开录入持股对话框
const openAddPositionDialog = () => {
  positionForm.value = {
    stock: '',
    cost: '',
    quantity: ''
  }
  searchResults.value = []
  showSearchDropdown.value = false
  selectedStockName.value = ''
  showAddPositionDialog.value = true
}

// 搜索股票
let searchTimer: any = null
const onStockInput = () => {
  // 清除之前的定时器
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  
  // 获取输入框的值
  const keyword = String(positionForm.value.stock || '').trim()
  
  if (!keyword) {
    searchResults.value = []
    showSearchDropdown.value = false
    return
  }
  
  // 防抖：延迟 300ms 搜索
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
      // 只显示 GP-A 类型的股票
      searchResults.value = data.data.stock
        .filter((item: any[]) => item[4] === 'GP-A')
        .map((item: any[]) => ({
          market: item[0],  // sh 或 sz
          code: item[1],    // 股票代码
          name: item[2]     // 股票名称
        }))
      showSearchDropdown.value = searchResults.value.length > 0
      
      // 检查是否有完全匹配的股票代码
      const exactMatch = searchResults.value.find(
        stock => stock.code === keyword
      )
      if (exactMatch) {
        selectedStockName.value = exactMatch.name
        showSearchDropdown.value = false
      } else {
        selectedStockName.value = ''
      }
    } else {
      searchResults.value = []
      showSearchDropdown.value = false
      selectedStockName.value = ''
    }
  } catch (err) {
    console.error('搜索股票失败:', err)
    searchResults.value = []
    showSearchDropdown.value = false
    selectedStockName.value = ''
  } finally {
    searchLoading.value = false
  }
}

// 选择股票
const selectStock = (stock: any) => {
  positionForm.value.stock = stock.code
  selectedStockName.value = stock.name
  searchResults.value = []
  showSearchDropdown.value = false
}

// 待确认的重复股票信息
let pendingDuplicateInfo: any = null

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
      // 保存重复股票信息，稍后使用
      pendingDuplicateInfo = {
        existing: existingData,
        form: { ...positionForm.value },
        stockName: selectedStockName.value
      }
      return true
    }
    
    return false
  } catch (err) {
    console.error('检查股票失败:', err)
    return false
  }
}

// 录入持股的前置处理
const beforeClosePositionDialog = async (action: string) => {
  if (action === 'confirm') {
    // 先进行表单验证
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
    
    // 检查是否重复
    const isDuplicate = await checkDuplicateStock(stock.trim())
    if (isDuplicate) {
      // 如果是重复的，返回 true 关闭弹窗，然后在关闭后显示确认对话框
      return true
    }
    
    // 不重复，直接添加
    const success = await addPosition()
    return success
  }
  return true
}

// 录入持股（仅用于新增股票）
const addPosition = async () => {
  const { stock, cost, quantity } = positionForm.value
  
  try {
    const costInCents = Math.round(parseFloat(cost) * 100)
    
    const { error: insertError } = await supabase
      .from('position')
      .insert([{
        stock: stock.trim(),
        name: selectedStockName.value || '',
        cost: costInCents,
        quantity: parseFloat(quantity)
      }])
    
    if (insertError) throw insertError
    
    // 检查并添加到 watchlist
    await addToWatchlistIfNotExists(stock.trim(), selectedStockName.value)
    
    showToast('录入成功')
    fetchPositions()
    return true
  } catch (err) {
    console.error('录入失败:', err)
    showToast('录入失败')
    return false
  }
}

// 检查股票是否在 watchlist 中，如果不存在则添加
const addToWatchlistIfNotExists = async (stockCode: string, stockName: string) => {
  try {
    // 检查是否已存在
    const { data: existingWatch } = await supabase
      .from('watchlist')
      .select('id')
      .eq('stock', stockCode)
      .maybeSingle()
    
    // 如果不存在，则添加
    if (!existingWatch) {
      const { error: insertError } = await supabase
        .from('watchlist')
        .insert([{
          stock: stockCode,
          name: stockName || ''
        }])
      
      if (insertError) {
        console.error('添加到自选失败:', insertError)
      } else {
        console.log('已自动添加到自选列表')
      }
    }
  } catch (err) {
    console.error('检查自选列表失败:', err)
  }
}

// 监听录入弹窗关闭，处理重复股票确认
watch(showAddPositionDialog, async (newVal, oldVal) => {
  if (oldVal === true && newVal === false && pendingDuplicateInfo) {
    // 弹窗刚关闭，且有待处理的重复股票
    await nextTick()
    
    const { existing, form, stockName } = pendingDuplicateInfo
    const oldCost = existing.cost / 100
    const oldQuantity = existing.quantity
    const newCost = parseFloat(form.cost)
    const newQuantity = parseFloat(form.quantity)
    
    // 计算新的成本价
    const totalCost = (oldCost * oldQuantity) + (newCost * newQuantity)
    const totalQuantity = oldQuantity + newQuantity
    const avgCost = totalCost / totalQuantity
    
    try {
      await showConfirmDialog({
        title: '股票已存在',
        message: `成本价格已变动 (${avgCost.toFixed(2)}元)`,
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      })
      
      // 用户确认，更新记录
      const avgCostInCents = Math.round(avgCost * 100)
      const { error: updateError } = await supabase
        .from('position')
        .update({
          cost: avgCostInCents,
          quantity: totalQuantity,
          name: stockName || existing.name
        })
        .eq('id', existing.id)
      
      if (updateError) throw updateError
      
      showToast('更新成功')
      fetchPositions()
    } catch (err) {
      if (err !== 'cancel') {
        console.error('更新失败:', err)
        showToast('更新失败')
      }
    } finally {
      // 清空待处理信息
      pendingDuplicateInfo = null
    }
  }
})

onMounted(() => {
  fetchMoney()
  fetchPositions()
})
</script>

<template>
  <div class="profile-page">
    <h2>我的</h2>
    
    <div class="money-section">
      <div class="section-header">
        <h3>资金信息</h3>
        <van-button 
          v-if="moneyData" 
          type="primary" 
          size="small"
          @click="openEditDialog"
        >
          修正
        </van-button>
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
        <div class="money-item">
          <span class="label">金额：</span>
          <span class="value">{{ moneyData.money }}</span>
        </div>
      </div>
      
      <div v-else class="empty">
        <p>暂无数据</p>
      </div>
    </div>
    
    <!-- 持股板块 -->
    <div class="position-section">
      <div class="section-header">
        <h3>持股信息</h3>
        <van-button 
          type="primary" 
          size="small"
          icon="add-o"
          @click="openAddPositionDialog"
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
            <div class="position-name">{{ position.name }}</div>
            <div class="position-stock">{{ position.stock }}</div>
          </div>
          <div class="position-details">
            <div class="detail-row">
              <span class="label">成本价：</span>
              <span class="value">¥{{ position.cost.toFixed(2) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">持股数：</span>
              <span class="value">{{ position.quantity }}</span>
            </div>
          </div>
        </div>
      </div>
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
    
    <!-- 录入持股对话框 -->
    <van-dialog
      v-model:show="showAddPositionDialog"
      title="录入持股"
      show-cancel-button
      :before-close="beforeClosePositionDialog"
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
        <van-field
          v-model="positionForm.quantity"
          label="持股数量"
          type="number"
          placeholder="请输入持股数量"
          required
        >
          <template #right-icon>
            <span class="unit">股</span>
          </template>
        </van-field>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped lang="less">
.profile-page {
  padding: 16px;
  background-color: #ffffff;
  min-height: 100vh;
}

h2 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 20px;
}

.money-section,
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

.money-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background-color: #ffffff;
  border-radius: 6px;
}

.money-item .label {
  font-size: 14px;
  color: #6b7280;
}

.money-item .value {
  font-size: 14px;
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
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
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

.position-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.detail-row .label {
  color: #6b7280;
}

.detail-row .value {
  color: #111827;
  font-weight: 500;
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
</style>

