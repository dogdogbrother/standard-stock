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
  reduceQuantity: ''
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

// 打开减仓对话框
const openReduceDialog = (position: Position) => {
  reduceForm.value = {
    positionId: position.id,
    stockName: position.name,
    currentQuantity: position.quantity,
    reduceQuantity: ''
  }
  showReduceDialog.value = true
}

// 确认减仓
const confirmReduce = async () => {
  const { positionId, currentQuantity, reduceQuantity } = reduceForm.value
  
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
      // 更新持股数量
      const { error: updateError } = await supabase
        .from('position')
        .update({ quantity: newQuantity })
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
          <div class="position-name">{{ position.name }}</div>
          <div class="position-stock">{{ position.stock }}</div>
        </div>
        <div class="position-details">
          <div class="detail-row">
            <span class="label">成本价：</span>
            <span class="value">{{ position.cost.toFixed(2) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">最新价：</span>
            <span 
              v-if="position.currentPrice !== undefined" 
              class="value"
              :class="{
                'price-up': position.changePercent && position.changePercent > 0,
                'price-down': position.changePercent && position.changePercent < 0
              }"
            >
              {{ position.currentPrice.toFixed(2) }}
            </span>
            <span v-else class="value loading-text">--</span>
          </div>
          <div class="detail-row">
            <span class="label">涨跌幅：</span>
            <span 
              v-if="position.changePercent !== undefined"
              class="value"
              :class="{
                'price-up': position.changePercent > 0,
                'price-down': position.changePercent < 0
              }"
            >
              {{ position.changePercent > 0 ? '+' : '' }}{{ position.changePercent.toFixed(2) }}%
            </span>
            <span v-else class="value loading-text">--</span>
          </div>
          <div class="detail-row">
            <span class="label">持股数：</span>
            <span class="value">{{ position.quantity }}</span>
          </div>
        </div>
        
        <!-- 减仓按钮 -->
        <div class="position-actions">
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
          v-model="reduceForm.reduceQuantity"
          label="减仓数量"
          type="number"
          placeholder="请输入减仓数量"
          required
        >
          <template #right-icon>
            <span class="unit">股</span>
          </template>
        </van-field>
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

.price-up {
  color: #ef4444 !important;
}

.price-down {
  color: #10b981 !important;
}

.loading-text {
  color: #9ca3af;
}

.position-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
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
