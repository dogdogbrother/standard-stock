# Supabase Storage 图片上传配置指南

## 一、在 Supabase Dashboard 中配置 Storage

### 1. 创建 Storage Bucket

1. 登录你的 Supabase Dashboard：https://app.supabase.com/
2. 选择你的项目
3. 点击左侧菜单的 **Storage**
4. 点击 **New bucket** 按钮
5. 填写配置：
   - **Bucket name**: `avatars` (存储头像的桶)
   - **Public bucket**: ✅ 勾选（让图片可以公开访问）
   - **File size limit**: 可选，比如设置为 2MB
   - **Allowed MIME types**: 可选，比如 `image/png,image/jpeg,image/jpg,image/webp`
6. 点击 **Create bucket**

### 2. 设置访问策略（Policies）

如果你的 bucket 设置为 public，默认已经可以公开读取。如果需要更细粒度的控制：

1. 在 Storage 页面，找到你创建的 `avatars` bucket
2. 点击右侧的 **⋮** 菜单 → **Policies**
3. 添加以下策略：

#### 允许所有人上传图片（不推荐生产环境）
```sql
-- Policy name: Allow public uploads
-- Operation: INSERT
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'avatars');
```

#### 允许所有人读取图片
```sql
-- Policy name: Allow public read
-- Operation: SELECT
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

#### 允许所有人删除图片（可选，不推荐）
```sql
-- Policy name: Allow public delete
-- Operation: DELETE
CREATE POLICY "Allow public delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'avatars');
```

### 3. 获取 Storage URL

在 Dashboard 的 **Settings** → **API** 中，找到：
- **Project URL**: `https://xxxxx.supabase.co`
- **anon public key**: 你的公开 API Key

## 二、前端配置

### 1. 环境变量配置

在 `.env.local` 文件中添加：

```env
# Supabase 配置
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon-key
```

### 2. 检查 supabase 客户端配置

确保 `src/lib/supabase.ts` 正确配置：

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## 三、文件上传示例代码

### 基础上传

```typescript
import { supabase } from '@/lib/supabase'

// 上传文件
async function uploadAvatar(file: File) {
  // 生成唯一文件名
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `avatars/${fileName}`

  // 上传文件
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file)

  if (error) {
    console.error('上传失败:', error)
    return null
  }

  // 获取公开 URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}
```

### 带进度条和错误处理

```typescript
async function uploadAvatarWithProgress(
  file: File,
  onProgress?: (progress: number) => void
) {
  try {
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('仅支持 JPG、PNG、WEBP 格式的图片')
    }

    // 验证文件大小（2MB）
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      throw new Error('图片大小不能超过 2MB')
    }

    // 生成唯一文件名
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `avatars/${fileName}`

    // 上传文件
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) throw error

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return {
      success: true,
      url: urlData.publicUrl,
      path: filePath
    }
  } catch (error) {
    console.error('上传失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传失败'
    }
  }
}
```

### 删除文件

```typescript
async function deleteAvatar(filePath: string) {
  const { error } = await supabase.storage
    .from('avatars')
    .remove([filePath])

  if (error) {
    console.error('删除失败:', error)
    return false
  }

  return true
}
```

## 四、Vue 组件使用示例

```vue
<template>
  <div>
    <input 
      type="file" 
      accept="image/*" 
      @change="handleFileChange"
      ref="fileInput"
    />
    <van-button @click="$refs.fileInput.click()">
      选择图片
    </van-button>
    
    <van-loading v-if="uploading" />
    
    <img v-if="avatarUrl" :src="avatarUrl" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { showToast } from 'vant'

const uploading = ref(false)
const avatarUrl = ref('')

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return
  
  uploading.value = true
  
  try {
    // 验证文件
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件')
      return
    }
    
    if (file.size > 2 * 1024 * 1024) {
      showToast('图片大小不能超过 2MB')
      return
    }
    
    // 上传
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`
    
    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)
    
    if (error) throw error
    
    // 获取 URL
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)
    
    avatarUrl.value = data.publicUrl
    showToast('上传成功')
    
  } catch (error) {
    console.error('上传失败:', error)
    showToast('上传失败')
  } finally {
    uploading.value = false
  }
}
</script>
```

## 五、常见问题

### 1. 上传后图片无法访问

- 确保 bucket 设置为 **public**
- 检查是否配置了正确的读取策略（Policy）
- 使用 `getPublicUrl` 而不是 `getSignedUrl`

### 2. CORS 错误

- 在 Supabase Dashboard → **Settings** → **API** → **CORS Origins** 中添加你的域名
- 或者添加 `*` 允许所有域名（仅用于开发）

### 3. 文件名冲突

- 使用时间戳 + 随机字符串生成唯一文件名
- 或者设置 `upsert: true` 覆盖同名文件

### 4. 图片压缩

Supabase 本身不提供图片压缩，建议：
- 前端上传前使用 `browser-image-compression` 等库压缩
- 或使用 Supabase 的 Image Transformation（需要额外配置）

## 六、安全建议

### 生产环境配置

1. **不要使用公开上传策略**，而是：
   - 要求用户登录后才能上传
   - 使用 Row Level Security (RLS) 限制访问

2. **限制文件大小和类型**
   - 在 bucket 设置中配置
   - 前端也要验证

3. **使用文件夹组织**
   ```typescript
   const filePath = `avatars/${userId}/${fileName}`
   ```

4. **定期清理未使用的图片**
   - 删除伙伴时同时删除对应的头像文件

## 七、快速开始检查清单

- [ ] 在 Supabase Dashboard 创建 `avatars` bucket
- [ ] 设置为 public bucket
- [ ] 配置读取策略（Policy）
- [ ] 在 `.env.local` 中配置 Supabase URL 和 Key
- [ ] 测试上传功能
- [ ] 测试图片 URL 是否可访问

---

配置完成后，你就可以在前端组件中使用 Supabase Storage 上传和管理图片了！

