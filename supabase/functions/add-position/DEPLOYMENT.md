# Edge Function 部署指南

## 🚀 部署步骤

### 1. 确保 Supabase CLI 已安装

```bash
# 检查版本
supabase --version

# 如果未安装，参考：https://supabase.com/docs/guides/cli
```

### 2. 登录 Supabase

```bash
supabase login
```

### 3. 关联项目

```bash
# 在项目根目录执行
supabase link --project-ref qixncbgvrkfjxopqqpiz
```

### 4. 部署 Edge Function

```bash
# 部署 add-position 函数
supabase functions deploy add-position

# 或者部署所有函数
supabase functions deploy
```

### 5. 验证部署

```bash
# 查看已部署的函数
supabase functions list
```

## 🧪 测试

### 本地测试

```bash
# 启动本地 Supabase（包括所有 Edge Functions）
supabase start

# 或者只启动 add-position 函数
supabase functions serve add-position --no-verify-jwt
```

**测试请求（新增持股）：**
```bash
curl -X POST http://localhost:54321/functions/v1/add-position \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "stock": "000001",
    "invt": "sz",
    "name": "平安银行",
    "cost": 10.50,
    "quantity": 100
  }'
```

**测试请求（加仓）：**
```bash
# 第二次添加同一股票，测试加仓逻辑
curl -X POST http://localhost:54321/functions/v1/add-position \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "stock": "000001",
    "invt": "sz",
    "name": "平安银行",
    "cost": 11.00,
    "quantity": 200
  }'
```

### 生产环境测试

```bash
curl -X POST https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "stock": "000001",
    "invt": "sz",
    "name": "平安银行",
    "cost": 10.50,
    "quantity": 100
  }'
```

## 📊 查看日志

### 本地日志

Edge Function 的日志会直接在终端中显示。

### 生产环境日志

```bash
# 查看实时日志
supabase functions logs add-position --tail

# 查看历史日志
supabase functions logs add-position
```

或在 Supabase Dashboard 中查看：
1. 进入项目：https://app.supabase.com/project/qixncbgvrkfjxopqqpiz
2. 点击左侧 **Edge Functions**
3. 选择 `add-position`
4. 查看 **Logs** 标签

## 🔧 前端配置

**无需配置！** 函数 URL 已硬编码在代码中：

```typescript
// src/views/profile/components/AddPositionDialog.vue
const response = await fetch('https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ stock, invt, name, cost, quantity })
})
```

> **💡 说明：** Edge Function URL 是公开的，不需要保密，因此直接硬编码在代码中即可。只有 ANON_KEY 需要配置在环境变量中。

## ⚠️ 注意事项

1. **Service Role Key**：Edge Function 使用 Service Role Key 来绕过 RLS 策略，这个 key 会自动注入到 Edge Function 的环境变量中，无需手动配置。

2. **CORS**：Edge Function 已配置 CORS，允许所有来源访问（`Access-Control-Allow-Origin: *`）。如果需要限制来源，可以修改 CORS 配置。

3. **错误处理**：所有数据库操作错误都会被捕获并返回 JSON 格式的错误信息，前端可以根据 `success` 字段判断是否成功。

4. **性能监控**：可以在 Supabase Dashboard 的 Edge Functions 页面查看函数的调用次数、响应时间等指标。

## 🔄 更新 Edge Function

修改代码后重新部署：

```bash
supabase functions deploy add-position
```

## 🗑️ 删除 Edge Function

```bash
supabase functions delete add-position
```

## 📝 常见问题

### Q: 部署后 502 错误？
A: 检查 Edge Function 代码是否有语法错误，查看日志：`supabase functions logs add-position`

### Q: 数据库操作失败？
A: 确保 Service Role Key 已正确配置，检查表的 RLS 策略。

### Q: CORS 错误？
A: 确保 Edge Function 返回了正确的 CORS headers，检查 OPTIONS 请求的处理。

### Q: 如何调试？
A: 使用 `console.log()` 打印日志，然后通过 `supabase functions logs` 查看。

