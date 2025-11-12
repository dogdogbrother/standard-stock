# Confirm Buddy Orders Edge Function

每个工作日结束后的凌晨 00:01 自动确认待确认的伙伴订单份额。

## 功能

1. 查找昨天（前一个工作日）`buddyOrder` 表中 `heldUnitStatus = 0`（待确认）的订单
2. 获取最新的 `money` 表数据，计算当前份额价格
3. 获取 `unit` 表数据，检查可用份额
4. 对每个待确认订单：
   - 计算应分配的份额 = 订单金额 / 份额价格
   - 检查份额是否充足（held + 新份额 <= total）
   - **份额充足**：
     - 更新 `buddy` 表的 `heldUnit` 为计算值
     - 更新 `buddyOrder` 的 `heldUnitStatus = 1`（已确认）
     - 累加 `unit` 表的 `held` 值
   - **份额不足**：
     - 更新 `buddy` 表的 `heldUnit = 0`
     - 更新 `buddyOrder` 的 `heldUnitStatus = 2`（份额不足）
     - 不更新 `unit` 表
5. 返回确认结果统计

## 为什么需要这个任务

在股市交易时间内（工作日 9:30-15:01），拉入伙伴时无法立即确认份额，因为：
- 持仓市值（`usedMoney`）还在变动中
- 份额价格不稳定
- 无法准确判断是否有足够份额

因此在交易时间内创建的订单状态为 `heldUnitStatus = 0`（待确认），等到当天收盘后，在第二天凌晨由这个定时任务统一处理。

## 执行时机说明

- **周一**交易日的订单 → **周二凌晨 00:01** 确认
- **周二**交易日的订单 → **周三凌晨 00:01** 确认
- **周三**交易日的订单 → **周四凌晨 00:01** 确认
- **周四**交易日的订单 → **周五凌晨 00:01** 确认
- **周五**交易日的订单 → **周六凌晨 00:01** 确认

这样确保使用的是当天收盘后的最终市值数据（由 `update-used-money` 在下午 3:01 更新）。

## 部署

```bash
# 部署 Edge Function
supabase functions deploy confirm-buddy-orders
```

## 测试

### 本地测试

```bash
# 启动本地开发
supabase functions serve confirm-buddy-orders

# 测试调用
curl -X POST http://localhost:54321/functions/v1/confirm-buddy-orders \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 线上测试

```bash
curl -X POST https://your-project.supabase.co/functions/v1/confirm-buddy-orders \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## GitHub Actions

定时任务配置在 `.github/workflows/confirm-buddy-orders.yml`。

### 时间安排

- **执行时间**：周二到周六凌晨 00:01（北京时间）
- **Cron 表达式**：`1 16 * * 2-6`（UTC 周一到周五 16:01）
- **处理对象**：前一个工作日的待确认订单

### 执行时间线

以周一为例：
- **15:00** - 股市收盘
- **15:01** - `update-used-money` 更新当天持仓市值
- **次日 00:01** - `confirm-buddy-orders` 确认昨天的订单

这样确保：
1. 市值数据已经是收盘后的最终数据
2. 份额价格计算准确
3. 有足够的时间窗口处理异常情况

### 手动触发

可以在 GitHub Actions 页面手动触发测试：
1. 访问仓库的 **Actions** 标签
2. 选择 **Confirm Buddy Orders** workflow
3. 点击 **Run workflow**

## 配置 GitHub Secrets

使用与 `update-used-money` 相同的 Secrets：
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 返回数据格式

### 成功情况

```json
{
  "success": true,
  "message": "订单确认完成",
  "totalOrders": 3,
  "confirmedCount": 2,
  "insufficientCount": 1,
  "errorCount": 0,
  "unitPrice": 1.5234,
  "oldHeld": 45000.5,
  "newHeld": 48500.75,
  "results": [
    {
      "orderId": 123,
      "buddyId": 45,
      "calculatedHeldUnit": 1000.5,
      "heldUnit": 1000.5,
      "status": "confirmed",
      "newStatus": 1
    },
    {
      "orderId": 124,
      "buddyId": 46,
      "calculatedHeldUnit": 2500.25,
      "heldUnit": 2500.25,
      "status": "confirmed",
      "newStatus": 1
    },
    {
      "orderId": 125,
      "buddyId": 47,
      "calculatedHeldUnit": 55000.0,
      "heldUnit": 0,
      "status": "insufficient",
      "newStatus": 2
    }
  ]
}
```

### 无待确认订单

```json
{
  "success": true,
  "message": "没有待确认的订单",
  "confirmedCount": 0
}
```

### 错误情况

```json
{
  "success": false,
  "error": "错误描述"
}
```

## 字段说明

- `totalOrders`: 待确认订单总数
- `confirmedCount`: 成功确认的订单数
- `insufficientCount`: 份额不足的订单数
- `errorCount`: 处理失败的订单数
- `unitPrice`: 当前份额价格
- `oldHeld`: 更新前的 held 值
- `newHeld`: 更新后的 held 值
- `results`: 每个订单的处理结果
  - `status`: `confirmed`（已确认）、`insufficient`（份额不足）、`error`（错误）
  - `newStatus`: 新的 `heldUnitStatus` 值（1=已确认，2=份额不足）

## 监控

### 查看执行日志

1. 进入 GitHub Actions 页面
2. 选择最近的 workflow 运行
3. 查看详细日志

### Edge Function 日志

在 Supabase Dashboard 中：
1. **Functions** → `confirm-buddy-orders`
2. 点击 **Logs** 查看执行日志

## 错误处理

如果出现错误：
1. 检查 GitHub Actions 日志
2. 检查 Supabase Edge Function 日志
3. 确认 buddyOrder 表有待确认数据
4. 确认 money 表有最新数据
5. 确认 unit 表数据正确
6. 检查 Secrets 配置是否正确

## 注意事项

- 定时任务设置在凌晨 00:01，确保有足够时间处理
- 只处理**昨天**创建的 `heldUnitStatus = 0` 的订单
- 使用北京时间（UTC+8）判断日期，避免时区问题
- 按订单顺序处理，先到先得，确保公平性
- 如果多个订单导致份额不足，后面的订单会被标记为"份额不足"
- Cron 时间是 `1 16 * * 2-6`：
  - 周二凌晨（UTC 周一 16:01）确认周一的订单
  - 周三凌晨（UTC 周二 16:01）确认周二的订单
  - ...以此类推
- 使用的是前一天下午 3:01 更新的持仓市值数据

