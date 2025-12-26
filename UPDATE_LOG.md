# 📝 更新日志

## 2025-12-26 - 移除不必要的环境变量

### ✅ 更新内容

**Edge Function URL 硬编码** - 不再需要配置 `VITE_ADD_POSITION_API` 环境变量

### 📄 修改的文件

1. **src/views/profile/components/AddPositionDialog.vue**
   - ✅ 移除 `import.meta.env.VITE_ADD_POSITION_API`
   - ✅ 直接使用硬编码 URL：`https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position`

2. **ENV_SETUP.md**
   - ✅ 移除 `VITE_ADD_POSITION_API` 配置项

3. **env.example**
   - ✅ 移除 `VITE_ADD_POSITION_API` 配置项
   - ✅ 添加说明：函数 URL 已硬编码，无需配置

4. **QUICK_START.md**
   - ✅ 更新环境变量示例
   - ✅ 添加说明和故障排查更新

5. **supabase/functions/add-position/MANUAL_DEPLOY.md**
   - ✅ 更新"下一步"部分的说明

6. **supabase/functions/add-position/DEPLOYMENT.md**
   - ✅ 更新"前端配置"部分，添加代码示例和说明

7. **MIGRATION_SUMMARY.md**
   - ✅ 在改进列表中添加硬编码说明

### 💡 为什么这样做？

**Edge Function URL 是公开的，不需要保密：**

✅ **优点：**
- 减少环境变量配置
- 简化部署流程
- URL 不会变化，硬编码更直观
- 避免因环境变量未配置导致的问题

❌ **需要环境变量的情况：**
- API Key / Token（需要保密）
- 敏感配置信息
- 不同环境有不同值的配置

**Edge Function URL 是固定的公开端点，不属于上述情况。**

### 📋 现在需要配置的环境变量

只需要在 `.env.local` 中配置这些：

```env
# Supabase Edge Function - 股票搜索 API
VITE_STOCK_SEARCH_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-search

# Supabase Edge Function - 股票详情 API
VITE_STOCK_DETAIL_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-detail

# Supabase 数据库配置
VITE_SUPABASE_URL=https://qixncbgvrkfjxopqqpiz.supabase.co
VITE_SUPABASE_ANON_KEY=你的_ANON_KEY
```

> **⚠️ 注意：** 仍然需要配置 `VITE_SUPABASE_ANON_KEY`，这是需要保密的认证密钥。

### 🔄 迁移步骤

如果你已经在使用旧的配置：

1. ✅ 从 `.env.local` 中删除 `VITE_ADD_POSITION_API`
2. ✅ 无需修改代码（已自动更新）
3. ✅ 重启开发服务器即可

---

## 📊 最终的配置对比

### 之前（不推荐）

```typescript
// 代码中
const apiUrl = import.meta.env.VITE_ADD_POSITION_API || 'https://...'
```

```env
# .env.local 中
VITE_ADD_POSITION_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position
```

### 现在（推荐）✅

```typescript
// 代码中
const response = await fetch('https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position', {
  // ...
})
```

```env
# .env.local 中
# 无需配置 VITE_ADD_POSITION_API
```

**更简洁、更直观！** 🎉

---

## 🎯 下一步

继续按照 **QUICK_START.md** 完成部署和测试即可！

