<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { showToast } from 'vant'

interface Props {
  show: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const buddyForm = ref({
  name: '',
  money: '',
  avatar: ''
})
const uploading = ref(false)
const avatarPreview = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

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
    // money 参数用于存储到 buddy 表
    const buddyMoneyInYuan = parseFloat(money)
    const buddyMoneyInCents = Math.round(buddyMoneyInYuan * 100) // 转换为分
    
    // 1. 插入 buddy 数据
    // heldUnit = 0（待确认），由定时任务统一处理份额分配
    const { data: newBuddy, error: buddyError } = await supabase
      .from('buddy')
      .insert([{
        name: name.trim(),
        avatar: avatar.trim() || null,
        money: buddyMoneyInCents,
        heldUnit: 0 // 待定时任务确认
      }])
      .select()
      .single()
    
    if (buddyError) throw buddyError
    
    // 2. 创建 buddyOrder 记录
    // heldUnitStatus = 0（待确认），由定时任务统一确认份额
    const { error: orderError } = await supabase
      .from('buddyOrder')
      .insert([{
        buddyId: newBuddy.id,
        money: buddyMoneyInCents,
        heldUnitStatus: 0, // 待定时任务确认
        track_type: 'increase' // 拉入伙伴视为加仓操作
      }])
    
    if (orderError) throw orderError
    
    showToast('添加伙伴成功，份额将在次日确认')
    
    // 重置表单
    resetForm()
    
    // 通知父组件刷新列表
    emit('success')
    
    return true
  } catch (err) {
    console.error('添加伙伴失败:', err)
    showToast('添加伙伴失败')
    return false
  }
}

// 重置表单
const resetForm = () => {
  buddyForm.value = {
    name: '',
    money: '',
    avatar: ''
  }
  avatarPreview.value = ''
}

// 监听对话框显示状态，显示时重置表单
const handleDialogShow = (value: boolean) => {
  if (value) {
    resetForm()
  }
}
</script>

<template>
  <van-dialog
    :show="props.show"
    @update:show="(value) => { handleDialogShow(value); emit('update:show', value) }"
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
</template>

<style scoped lang="less">
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

