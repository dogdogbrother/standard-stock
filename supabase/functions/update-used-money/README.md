# Update Used Money Edge Function

每天下午 3:01 自动更新 `money` 表的 `usedMoney` 字段（持仓总市值）。

## 功能

1. 获取 `position` 表的所有持仓数据
2. 调用东方财富 API 获取股票最新价
3. 计算总市值（最新价 × 持股数）
4. 更新 `money` 表的 `usedMoney` 字段

## 部署

```bash
# 部署 Edge Function
supabase functions deploy update-used-money
```

## 测试

### 本地测试

```bash
# 启动本地开发
supabase functions serve update-used-money

# 测试调用
curl -X POST http://localhost:54321/functions/v1/update-used-money \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 线上测试

```bash
curl -X POST https://your-project.supabase.co/functions/v1/update-used-money \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## GitHub Actions

定时任务配置在 `.github/workflows/update-used-money.yml`。

### 时间安排

- **执行时间**：工作日每天下午 3:01（中国时间）
- **Cron 表达式**：`1 7 * * 1-5`（UTC 时间）
- **执行日期**：周一到周五

### 手动触发

可以在 GitHub Actions 页面手动触发测试：
1. 访问仓库的 **Actions** 标签
2. 选择 **Update Used Money** workflow
3. 点击 **Run workflow**

## 配置 GitHub Secrets

在仓库设置中添加以下 Secrets：

1. `SUPABASE_URL`
   - 值：`https://your-project.supabase.co`

2. `SUPABASE_ANON_KEY`
   - 值：你的 Supabase Anon Key

### 添加步骤

1. 进入 GitHub 仓库
2. **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加上述两个 secret

## 监控

### 查看执行日志

1. 进入 GitHub Actions 页面
2. 选择最近的 workflow 运行
3. 查看详细日志

### Edge Function 日志

在 Supabase Dashboard 中：
1. **Functions** → `update-used-money`
2. 点击 **Logs** 查看执行日志

## 返回数据格式

```json
{
  "success": true,
  "usedMoney": 150000.50,
  "usedMoneyInCents": 15000050,
  "positionCount": 5,
  "details": [
    {
      "stock": "000001",
      "quantity": 1000,
      "currentPrice": 15.50,
      "marketValue": "15500.00"
    }
  ]
}
```

## 错误处理

如果出现错误：
1. 检查 GitHub Actions 日志
2. 检查 Supabase Edge Function 日志
3. 确认 position 表有数据
4. 确认东方财富 API 可访问
5. 检查 Secrets 配置是否正确

## 注意事项

- 股市收盘时间为下午 3:00，定时任务设置在 3:01 确保获取到当天收盘价
- 只在工作日执行，周末和节假日不执行
- API 返回的价格单位是"分"，需要除以 100

