# reduce-position Edge Function

## 功能说明

减仓操作的 Supabase Edge Function，处理股票减仓/清仓逻辑。

## 功能特性

- ✅ 更新 position 表（减少数量或删除记录）
- ✅ 插入 track 记录（track_type = 'reduce'）
- ✅ 更新资金（增加卖出金额）
- ✅ 自动识别清仓（数量为0时删除持仓记录）
- ✅ 完整的参数校验

## 请求参数

```typescript
{
  positionId: number        // 持仓ID
  stock: string            // 股票代码
  invt: string             // 市场类型（sz/sh）
  name: string             // 股票名称
  sellPrice: number        // 卖出价（元）
  reduceQuantity: number   // 减仓数量
  currentQuantity: number  // 当前持股数量
  currentCost: number      // 当前成本价（元）
}
```

## 返回格式

### 成功响应

```json
{
  "success": true,
  "message": "减仓成功" | "清仓成功",
  "newQuantity": 800,
  "sellAmount": 19500.50
}
```

### 错误响应

```json
{
  "success": false,
  "error": "错误信息"
}
```

## 部署方法

### 使用 Supabase CLI 部署

```bash
# 登录 Supabase
supabase login

# 部署函数
supabase functions deploy reduce-position

# 验证部署
supabase functions list
```

### 手动部署（Web 界面）

1. 访问 [Supabase Dashboard - Edge Functions](https://app.supabase.com/project/qixncbgvrkfjxopqqpiz/functions)
2. 点击 **Create a new function**
3. 名称：`reduce-position`
4. 复制 `index.ts` 的内容
5. 点击 **Deploy**

## 测试

```bash
# 本地测试
curl -i --location 'https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/reduce-position' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "positionId": 1,
    "stock": "600519",
    "invt": "sh",
    "name": "贵州茅台",
    "sellPrice": 1650.50,
    "reduceQuantity": 100,
    "currentQuantity": 1000,
    "currentCost": 1500.00
  }'
```

## 业务逻辑

1. **参数校验**
   - 检查必要参数
   - 验证数量必须是 100 的倍数
   - 验证减仓数量不能超过当前持股

2. **更新持仓**
   - 如果减仓后数量为 0 → 删除 position 记录（清仓）
   - 如果减仓后数量 > 0 → 更新 quantity 字段（部分减仓）
   - **注意：成本价不变**

3. **记录操作**
   - 插入 track 表记录（track_type = 'reduce'）

4. **更新资金**
   - money 表增加卖出金额（sellPrice × reduceQuantity）

## 与 add-position 的区别

| 项目 | add-position | reduce-position |
|------|--------------|-----------------|
| 操作 | 买入/加仓 | 卖出/减仓 |
| position 更新 | 增加数量，更新成本 | 减少数量，成本不变 |
| track_type | 'increase' | 'reduce' |
| 资金变化 | 扣减 | 增加 |
| 清空处理 | - | 删除 position 记录 |

## 注意事项

- 减仓不改变成本价（加权成本保持不变）
- 清仓时会删除 position 记录，但 track 记录保留
- 资金增加的是卖出金额，不考虑盈亏

## 相关文件

- 前端调用：`src/views/profile/components/ReducePositionDialog.vue`
- 数据表：`position`、`track`、`money`
