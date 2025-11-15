<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { showToast } from 'vant'
import AddBuddyDialog from './AddBuddyDialog.vue'

interface Buddy {
  id: number
  name: string
  avatar?: string
  heldUnit?: number
  created_at: string
}

const loading = ref(false)
const buddyList = ref<Buddy[]>([])
const showAddDialog = ref(false)

// 获取伙伴列表
const fetchBuddies = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('buddy')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    buddyList.value = data || []
  } catch (err) {
    console.error('获取伙伴列表失败:', err)
    showToast('获取伙伴列表失败')
  } finally {
    loading.value = false
  }
}

// 打开添加伙伴对话框
const openAddDialog = () => {
  showAddDialog.value = true
}

// 格式化份额显示，去掉尾部的0
const formatUnit = (unit: number | undefined): string => {
  if (!unit) return '0'
  // 保留4位小数后，去掉尾部的0
  return parseFloat(unit.toFixed(4)).toString()
}

// 添加成功后的回调
const handleAddSuccess = () => {
  fetchBuddies()
}

onMounted(() => {
  fetchBuddies()
})
</script>

<template>
  <div class="buddy-page">
    <div class="header">
      <h2>伙伴中心</h2>
      <van-button 
        type="primary" 
        size="small"
        icon="plus"
        @click="openAddDialog"
      >
        拉入伙伴
      </van-button>
    </div>
    
    <div v-if="loading" class="loading">
      <van-loading size="24px" />
      <span>加载中...</span>
    </div>
    
    <div v-else-if="buddyList.length === 0" class="empty">
      <van-icon name="friends-o" class="icon" />
      <p>暂无伙伴，快去添加吧~</p>
    </div>
    
    <div v-else class="buddy-list">
      <div 
        v-for="buddy in buddyList" 
        :key="buddy.id" 
        class="buddy-item"
      >
        <div class="buddy-avatar">
          <img v-if="buddy.avatar" :src="buddy.avatar" alt="头像" />
          <van-icon v-else name="user-o" />
        </div>
        <div class="buddy-info">
          <div class="buddy-name">{{ buddy.name }}</div>
          <div class="buddy-unit">
            持有份额：{{ formatUnit(buddy.heldUnit) }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加伙伴对话框 -->
    <AddBuddyDialog 
      v-model:show="showAddDialog"
      @success="handleAddSuccess"
    />
  </div>
</template>

<style scoped lang="less">
.buddy-page {
  height: 100%;
  padding: 16px;
  background-color: #f5f5f5;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 4px;
}

h2 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #6b7280;
  
  .icon {
    font-size: 48px;
    color: @primary-color;
  }
  
  p {
    font-size: 14px;
    margin: 0;
  }
}

.buddy-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.buddy-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
  
  &:active {
    transform: scale(0.98);
  }
}

.buddy-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-right: 12px;
  flex-shrink: 0;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .van-icon {
    font-size: 24px;
    color: #9ca3af;
  }
}

.buddy-info {
  flex: 1;
  min-width: 0;
}

.buddy-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buddy-unit {
  font-size: 14px;
  color: #6b7280;
}
</style>

