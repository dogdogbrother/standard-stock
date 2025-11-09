<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { showDialog, showToast } from 'vant'

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

// 确认修改
const confirmEdit = async () => {
  const amount = parseFloat(editAmount.value)
  
  if (!editAmount.value) {
    showToast('请输入金额')
    return
  }
  
  if (isNaN(amount)) {
    showToast('请输入有效的数字')
    return
  }
  
  try {
    // 更新数据库
    const { error: updateError } = await supabase
      .from('money')
      .update({ money: amount })
      .eq('id', 1)
    
    if (updateError) {
      showToast('更新失败')
      console.error('更新失败:', updateError)
      return
    }
    
    // 更新本地数据
    if (moneyData.value) {
      moneyData.value.money = amount
    }
    
    showEditDialog.value = false
    showToast('修改成功')
  } catch (err) {
    console.error('修改失败:', err)
    showToast('修改失败')
  }
}

onMounted(() => {
  fetchMoney()
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
          修改
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
    
    <!-- 修改金额对话框 -->
    <van-dialog
      v-model:show="showEditDialog"
      title="修改金额"
      show-cancel-button
      @confirm="confirmEdit"
    >
      <div class="dialog-content">
        <van-field
          v-model="editAmount"
          type="number"
          placeholder="请输入金额"
          clearable
        />
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

.money-section {
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
</style>

