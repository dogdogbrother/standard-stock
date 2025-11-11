<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { showToast } from 'vant'

interface Buddy {
  id: number
  name: string
  avatar?: string
  heldUnit?: number
  heldUnitStatus?: number
  created_at: string
}

const loading = ref(false)
const buddyList = ref<Buddy[]>([])
const showAddDialog = ref(false)
const buddyForm = ref({
  name: '',
  money: '',
  avatar: ''
})
const uploading = ref(false)
const avatarPreview = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

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
  buddyForm.value = {
    name: '',
    money: '',
    avatar: ''
  }
  avatarPreview.value = ''
  showAddDialog.value = true
}

// 选择文件
const selectFile = () => {
  // 清空 input value，这样选择同一张图片也能触发 change 事件
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return
  
  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件')
    return
  }
  
  // 验证文件大小 (2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('图片大小不能超过 2MB')
    return
  }
  
  // 显示预览
  const reader = new FileReader()
  reader.onload = (e) => {
    avatarPreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
  
  // 上传到 Supabase Storage
  await uploadAvatar(file)
}

// 上传头像到 Supabase Storage
const uploadAvatar = async (file: File) => {
  uploading.value = true
  
  try {
    // 生成唯一文件名
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `avatars/${fileName}`
    
    // 上传文件
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })
    
    if (uploadError) {
      throw uploadError
    }
    
    // 获取公开 URL
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)
    
    buddyForm.value.avatar = data.publicUrl
    showToast('上传成功')
    
  } catch (err) {
    console.error('上传失败:', err)
    showToast('上传失败，请重试')
    avatarPreview.value = ''
  } finally {
    uploading.value = false
  }
}

// 对话框关闭前的处理
const beforeCloseDialog = async (action: string) => {
  if (action === 'confirm') {
    // 点击确认按钮，执行添加逻辑
    const success = await addBuddy()
    // 只有添加成功时才关闭对话框
    return success
  }
  // 点击取消按钮，直接关闭
  return true
}

// 格式化份额显示，去掉尾部的0
const formatUnit = (unit: number | undefined): string => {
  if (!unit) return '0'
  // 保留4位小数后，去掉尾部的0
  return parseFloat(unit.toFixed(4)).toString()
}

// 判断是否是工作日交易时间（9:30-15:01）
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
  
  // 9:30 = 570分钟, 15:01 = 901分钟
  const tradingStart = 9 * 60 + 30 // 570
  const tradingEnd = 15 * 60 + 1 // 901
  
  return currentTime >= tradingStart && currentTime <= tradingEnd
}

// 添加伙伴
const addBuddy = async () => {
  const { name, money, avatar } = buddyForm.value
  
  if (!name.trim()) {
    showToast('请输入伙伴名称')
    return false
  }
  
  if (!money || isNaN(parseFloat(money))) {
    showToast('请输入有效的资产金额')
    return false
  }
  
  try {
    // money 参数仅用于计算份额
    const buddyMoneyInYuan = parseFloat(money)
    
    // 1. 获取 money 表的最新数据
    const { data: moneyData, error: moneyError } = await supabase
      .from('money')
      .select('money, usedMoney')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (moneyError) throw moneyError
    
    // 2. 计算份额价格 = (money + usedMoney) / 100000
    const totalValue = (moneyData.money + (moneyData.usedMoney || 0)) / 100 // 转换为元
    const unitPrice = totalValue / 100000
    
    // 3. 判断交易时间，设置 heldUnitStatus
    const isTrading = isTradingTime()
    let heldUnitStatus = 0 // 默认待确认
    let heldUnit = 0
    
    if (!isTrading) {
      // 非交易时间，状态设为已确认
      heldUnitStatus = 1
      // 4. 计算应有份额 = 伙伴资产 / 份额价格（保留4位小数）
      heldUnit = parseFloat((buddyMoneyInYuan / unitPrice).toFixed(4))
    }
    
    // 5. 插入 buddy 数据（不包含 money 字段）
    const { error: buddyError } = await supabase
      .from('buddy')
      .insert([{
        name: name.trim(),
        avatar: avatar.trim() || null,
        heldUnit: heldUnit,
        heldUnitStatus: heldUnitStatus
      }])
    
    if (buddyError) throw buddyError
    
    // 6. 如果是已确认状态，更新 unit 表的 held 值
    if (heldUnitStatus === 1 && heldUnit > 0) {
      // 获取当前 unit 表数据（只有一条记录）
      const { data: unitData, error: unitFetchError } = await supabase
        .from('unit')
        .select('id, held')
        .single()
      
      if (unitFetchError) throw unitFetchError
      
      // 更新 held 值
      const newHeld = parseFloat(((unitData.held || 0) + heldUnit).toFixed(4))
      const { error: unitUpdateError } = await supabase
        .from('unit')
        .update({ held: newHeld })
        .eq('id', unitData.id)
      
      if (unitUpdateError) throw unitUpdateError
    }
    
    showToast('添加伙伴成功')
    fetchBuddies()
    return true
  } catch (err) {
    console.error('添加伙伴失败:', err)
    showToast('添加伙伴失败')
    return false
  }
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
            <span 
              class="unit-status" 
              :class="buddy.heldUnitStatus === 1 ? 'confirmed' : 'pending'"
            >
              {{ buddy.heldUnitStatus === 1 ? '已确认' : '待确认' }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加伙伴对话框 -->
    <van-dialog
      v-model:show="showAddDialog"
      title="拉入伙伴"
      show-cancel-button
      :before-close="beforeCloseDialog"
    >
      <div class="dialog-content">
        <van-field
          v-model="buddyForm.name"
          label="名称"
          placeholder="请输入伙伴名称"
          required
        />
        <van-field
          v-model="buddyForm.money"
          label="资产"
          type="number"
          placeholder="请输入资产金额"
          required
        >
          <template #right-icon>
            <span class="unit">元</span>
          </template>
        </van-field>
        
        <!-- 头像上传 -->
        <div class="avatar-upload-field">
          <div class="field-label">头像</div>
          <div class="field-body">
            <!-- 隐藏的文件输入 -->
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleFileChange"
            />
            
            <!-- 头像预览或上传按钮 -->
            <div class="avatar-container">
              <div 
                v-if="avatarPreview || buddyForm.avatar" 
                class="avatar-preview"
                @click="selectFile"
              >
                <img :src="avatarPreview || buddyForm.avatar" alt="头像预览" />
                <div class="avatar-mask">
                  <van-icon name="photograph" size="20" />
                  <span>重新选择</span>
                </div>
              </div>
              <div v-else class="avatar-upload-btn" @click="selectFile">
                <van-icon name="photograph" size="24" />
                <span>选择图片</span>
              </div>
              
              <!-- 上传中状态 -->
              <div v-if="uploading" class="uploading-overlay">
                <van-loading size="20px" />
              </div>
            </div>
            
            <div class="field-tip">支持 JPG、PNG、WEBP，不超过 2MB</div>
          </div>
        </div>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped lang="less">
.buddy-page {
  min-height: calc(100vh - 50px);
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
  display: flex;
  align-items: center;
  gap: 8px;
}

.unit-status {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 10px;
  font-weight: 500;
  
  &.confirmed {
    color: #10b981;
    background-color: #d1fae5;
  }
  
  &.pending {
    color: #f59e0b;
    background-color: #fef3c7;
  }
}

.dialog-content {
  padding: 16px 0;
}

.unit {
  color: #646566;
  font-size: 14px;
  padding-right: 8px;
}

.avatar-upload-field {
  display: flex;
  align-items: flex-start;
  padding: 10px 16px;
  border-bottom: 1px solid #ebedf0;
  font-size: 14px;
}

.field-label {
  flex-shrink: 0;
  width: 6.2em;
  color: #646566;
  padding-top: 8px;
  padding-right: 12px;
}

.field-body {
  flex: 1;
  padding-left: 0;
}

.avatar-container {
  position: relative;
  display: inline-block;
}

.avatar-upload-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 80px;
  height: 80px;
  border: 1px dashed #dcdee0;
  border-radius: 6px;
  background-color: #fafafa;
  cursor: pointer;
  transition: all 0.2s;
  
  &:active {
    transform: scale(0.95);
    background-color: #f0f0f0;
  }
  
  .van-icon {
    color: #969799;
  }
  
  span {
    font-size: 12px;
    color: #969799;
  }
}

.avatar-preview {
  position: relative;
  width: 80px;
  height: 80px;
  cursor: pointer;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 6px;
    display: block;
  }
  
  .avatar-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 6px;
    opacity: 0;
    transition: opacity 0.2s;
    
    .van-icon {
      color: #ffffff;
    }
    
    span {
      font-size: 12px;
      color: #ffffff;
    }
  }
  
  &:hover .avatar-mask {
    opacity: 1;
  }
}

.uploading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 6px;
}

.field-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #969799;
  line-height: 16px;
}
</style>
