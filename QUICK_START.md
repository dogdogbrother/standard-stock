# 🚀 Edge Function 部署快速指南

## 📋 部署 add-position Edge Function

### 方式 1: Supabase Dashboard（推荐）

**适合你的使用习惯（Web 操作），无需安装任何工具。**

1. **访问 Edge Functions 页面**
   ```
   https://app.supabase.com/project/qixncbgvrkfjxopqqpiz/functions
   ```

2. **创建新函数**
   - 点击 **"Create a new function"**
   - Function name: `add-position`
   - 点击 **"Create function"**

3. **复制代码**
   - 打开 `supabase/functions/add-position/index.ts`
   - 全选复制（Ctrl+A, Ctrl+C）
   - 粘贴到 Dashboard 编辑器中（Ctrl+V）

4. **部署**
   - 点击 **"Deploy"** 按钮
   - 等待部署完成（约10-30秒）
   - 看到绿色提示 "Successfully deployed"

✅ **部署完成！函数 URL:**
```
https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position
```

---

## 🔧 配置前端

### 1. 创建 .env.local 文件

在项目根目录创建 `.env.local` 文件：

```bash
# 复制示例文件
copy env.example .env.local
```

或者直接创建：

```env
# Supabase Edge Function - 股票搜索 API
VITE_STOCK_SEARCH_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-search

# Supabase Edge Function - 股票详情 API
VITE_STOCK_DETAIL_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-detail

# Supabase 数据库配置
VITE_SUPABASE_URL=https://qixncbgvrkfjxopqqpiz.supabase.co
VITE_SUPABASE_ANON_KEY=你的_ANON_KEY
```

> **💡 注意：** `add-position` 函数 URL 已硬编码在代码中，无需配置环境变量。

### 2. 获取 ANON_KEY

1. 访问：https://app.supabase.com/project/qixncbgvrkfjxopqqpiz/settings/api
2. 找到 **"Project API keys"** 部分
3. 复制 **"anon public"** key
4. 替换 `.env.local` 中的 `你的_ANON_KEY`

### 3. 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 重新启动
npm run dev
```

---

## 🧪 测试

### 测试 1: Dashboard 测试（推荐先做这个）

1. 访问：https://app.supabase.com/project/qixncbgvrkfjxopqqpiz/functions/add-position
2. 点击 **"Invoke"** 标签
3. 在 Request Body 中输入：

```json
{
  "stock": "000001",
  "invt": "sz",
  "name": "平安银行",
  "cost": 10.50,
  "quantity": 100
}
```

4. 点击 **"Run"**
5. **预期结果：**

```json
{
  "success": true,
  "message": "录入成功",
  "isUpdate": false
}
```

6. **验证数据库：**
   - 访问 Table Editor
   - 检查 `position` 表（应该有新记录）
   - 检查 `track` 表（应该有操作记录）
   - 检查 `money` 表（资金应该减少）
   - 检查 `watchlist` 表（应该有自选股记录）

### 测试 2: 前端测试

1. 访问：http://localhost:5173/app/profile
2. 点击 **"录入持股"** 按钮
3. 输入股票信息：
   - 股票代码：`600519`
   - 买入价：`1680.50`
   - 持股数量：`100`
4. 点击 **"确认"**
5. **预期结果：**
   - 提示 "录入成功"
   - 持股列表自动刷新
   - 可用资金减少

### 测试 3: 加仓测试

再次录入相同的股票：

1. 点击 **"录入持股"**
2. 输入相同的股票代码：`600519`
3. 输入不同的价格和数量
4. **预期结果：**
   - 提示 "加仓成功，新成本: XX元"
   - 成本价自动计算为平均值
   - 持股数量累加

---

## ✅ 验证清单

- [ ] Edge Function 部署成功
- [ ] `.env.local` 文件已创建并配置
- [ ] ANON_KEY 已正确填写
- [ ] Dashboard 测试通过
- [ ] 前端录入持股成功（新增）
- [ ] 前端加仓成功（重复股票）
- [ ] 数据库记录正确：
  - [ ] position 表有记录
  - [ ] track 表有操作记录
  - [ ] money 表资金扣减正确
  - [ ] watchlist 表有自选股

---

## 🔍 故障排查

### 问题 1: 前端提示 "录入失败"

**检查：**
1. 浏览器控制台是否有错误
2. VITE_SUPABASE_ANON_KEY 是否正确
3. 是否重启了开发服务器
4. Edge Function 是否已部署成功

### 问题 2: Dashboard 测试失败

**检查：**
1. Edge Function 代码是否完整复制
2. 查看 Logs 标签中的错误信息
3. 检查数据库表结构是否正确

### 问题 3: 数据没有插入数据库

**检查：**
1. 查看 Edge Function Logs
2. 检查表的 RLS 策略（Service Role Key 应该能绕过 RLS）
3. 验证数据库连接

---

## 📚 相关文档

- 📄 详细部署指南：`supabase/functions/add-position/MANUAL_DEPLOY.md`
- 📄 环境变量配置：`ENV_SETUP.md`
- 📄 API 文档：`supabase/functions/add-position/README.md`
- 📄 测试文件：`supabase/functions/add-position/test.http`

---

## 💡 下一步

完成部署和测试后，你可以：

1. ✅ 继续使用前端录入持股，享受改进后的性能
2. ✅ 查看 `/app/profile` 页面加载速度提升（从多次请求变为单次请求）
3. ✅ 考虑将其他操作也迁移到 Edge Function（如减仓、修正资金等）

---

## 🎉 完成！

部署成功后，你的系统将获得：
- ⚡ **更快的响应速度**（网络请求从7次减少到1次）
- 🔒 **更好的数据一致性**（原子性操作，避免部分成功）
- 🛡️ **更高的安全性**（业务逻辑在后端，不暴露给前端）
- 🧹 **更简洁的代码**（前端代码减少80%+）

