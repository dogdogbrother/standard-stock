# Supabase Storage 快速配置（必看！）

## ⚠️ 必须完成以下配置才能使用头像上传功能

### 第 1 步：登录 Supabase Dashboard

访问：https://app.supabase.com/

选择你的项目：`qixncbgvrkfjxopqqpiz`

### 第 2 步：创建 Storage Bucket

1. 点击左侧菜单 **Storage**
2. 点击右上角 **New bucket** 按钮
3. 填写配置：
   ```
   Name: avatars
   Public bucket: ✅ 勾选（重要！）
   File size limit: 2 MB（可选）
   Allowed MIME types: image/png,image/jpeg,image/jpg,image/webp（可选）
   ```
4. 点击 **Create bucket**

### 第 3 步：配置访问策略（Policies）

如果你的 bucket 设置为 public，默认可以公开读取。但为了能上传，需要添加策略：

1. 找到 `avatars` bucket
2. 点击右侧的 **⋮** → **Policies**
3. 点击 **New Policy** → **For full customization**
4. 添加以下两个策略：

#### 策略 1：允许上传
```sql
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'avatars');
```

#### 策略 2：允许读取（如果需要）
```sql
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

### 第 4 步：测试

1. 回到前端应用
2. 点击"拉入伙伴"按钮
3. 点击上传区域选择图片
4. 如果能成功上传并显示预览，说明配置成功！

## 🔍 验证配置是否正确

### 检查清单：

- [ ] 在 Storage 页面能看到 `avatars` bucket
- [ ] `avatars` bucket 显示为 **Public**
- [ ] 已配置上传策略（INSERT policy）
- [ ] 已配置读取策略（SELECT policy）
- [ ] 前端能成功上传图片

## 🆘 遇到问题？

### 问题 1：上传失败 "new row violates row-level security policy"

**原因**：没有配置上传策略

**解决**：添加 INSERT policy（参考第 3 步）

### 问题 2：图片上传后无法显示

**原因**：bucket 不是 public 或没有配置读取策略

**解决**：
1. 确保 bucket 设置为 **Public**
2. 添加 SELECT policy（参考第 3 步）

### 问题 3：上传成功但预览是空白

**原因**：CORS 配置问题

**解决**：
1. 进入 Settings → API → CORS Origins
2. 添加你的域名或 `*`（开发环境）

## 📸 预期效果

配置完成后，你应该看到：

1. 点击虚线框可以选择图片
2. 选择后立即显示预览
3. 自动上传到 Supabase
4. 显示"上传成功"提示
5. 图片 URL 保存到数据库

## 🔗 相关文档

完整配置指南：`STORAGE_SETUP.md`

