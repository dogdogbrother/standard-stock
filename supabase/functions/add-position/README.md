# Add Position Edge Function

## 功能说明

录入持股的 Edge Function，处理新增持股和加仓操作。

## 业务逻辑

1. **参数校验**
   - 股票代码、市场类型、名称不能为空
   - 买入价必须大于 0
   - 持股数量必须是 100 的倍数

2. **新增持股**
   - 插入 `position` 表
   - 插入 `track` 表（操作记录）
   - 更新 `money` 表（扣减资金）
   - 添加到 `watchlist` 表（如果不存在）

3. **加仓操作**（股票已存在）
   - 计算新的平均成本价
   - 更新 `position` 表（成本、数量）
   - 插入 `track` 表（操作记录）
   - 更新 `money` 表（扣减资金）

## API 接口

### 请求

```http
POST /functions/v1/add-position
Content-Type: application/json
Authorization: Bearer YOUR_ANON_KEY

{
  "stock": "000001",      // 股票代码
  "invt": "sz",           // 市场类型 (sz/sh)
  "name": "平安银行",      // 股票名称
  "cost": 10.50,          // 买入价（单位：元）
  "quantity": 100         // 持股数量（必须是100的倍数）
}
```

### 响应

**新增成功：**
```json
{
  "success": true,
  "message": "录入成功",
  "isUpdate": false
}
```

**加仓成功：**
```json
{
  "success": true,
  "message": "加仓成功",
  "isUpdate": true,
  "avgCost": 10.35,        // 新的平均成本价
  "totalQuantity": 500     // 总持股数量
}
```

**失败：**
```json
{
  "success": false,
  "error": "错误信息"
}
```

## 本地测试

```bash
# 启动本地 Edge Function
supabase functions serve add-position

# 测试请求
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

## 部署

```bash
supabase functions deploy add-position
```

## 环境变量

- `SUPABASE_URL`: Supabase 项目 URL（自动注入）
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key（自动注入）

## 优势

相比前端直接操作数据库：

1. ✅ **原子性操作** - 所有数据库操作在后端统一处理
2. ✅ **减少网络请求** - 从 7 次减少到 1 次
3. ✅ **更好的安全性** - 业务逻辑不暴露给前端
4. ✅ **更易维护** - 逻辑集中，易于测试和修改
5. ✅ **更好的错误处理** - 统一的错误处理机制

