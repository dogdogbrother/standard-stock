# 🌐 通过 Supabase Dashboard 手动部署 Edge Function

## 📋 部署步骤

### 1. 访问 Edge Functions 页面

访问：https://app.supabase.com/project/qixncbgvrkfjxopqqpiz/functions

### 2. 创建新函数

- 点击右上角的 **"Create a new function"** 按钮
- 或者点击 **"New Edge Function"**

### 3. 配置函数

在弹出的对话框中：
- **Function name**: `add-position`
- 点击 **"Create function"**

### 4. 复制代码

1. 打开本地文件：`supabase/functions/add-position/index.ts`
2. 复制所有代码（Ctrl+A, Ctrl+C）
3. 在 Supabase Dashboard 的编辑器中粘贴（Ctrl+V）
4. **确保代码完整复制**（从第1行到第309行）

### 5. 部署

- 点击右上角的 **"Deploy"** 按钮
- 等待部署完成（通常需要10-30秒）
- 看到绿色的 "Successfully deployed" 提示

### 6. 验证部署

部署成功后，函数 URL 为：
```
https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position
```

---

## 🧪 测试部署

### 方法 1: 使用 Supabase Dashboard 测试

1. 在 Edge Function 页面，选择 `add-position`
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

4. 点击 **"Run"** 按钮
5. 查看 Response，应该返回：

```json
{
  "success": true,
  "message": "录入成功",
  "isUpdate": false
}
```

### 方法 2: 使用前端测试

1. 更新 `.env.local` 文件：

```env
VITE_ADD_POSITION_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position
```

2. 重启开发服务器：

```bash
npm run dev
```

3. 访问 `/app/profile` 页面
4. 点击 **"录入持股"** 按钮
5. 输入股票信息并提交

---

## 🔄 更新函数（当代码修改后）

1. 访问：https://app.supabase.com/project/qixncbgvrkfjxopqqpiz/functions/add-position
2. 在编辑器中修改代码
3. 点击 **"Deploy"** 按钮重新部署

---

## 📊 查看日志

### 实时日志

1. 在 Edge Function 页面，选择 `add-position`
2. 点击 **"Logs"** 标签
3. 点击 **"Tail logs"** 查看实时日志

### 历史日志

1. 在 **"Logs"** 标签中
2. 选择时间范围
3. 查看所有请求和错误日志

---

## ⚠️ 常见问题

### Q: 部署后出现 502 错误？
**A:** 检查代码是否有语法错误，查看 Logs 标签中的错误信息。

### Q: 函数没有权限操作数据库？
**A:** Edge Function 自动使用 Service Role Key，不需要额外配置。如果仍有问题，检查表的 RLS 策略。

### Q: 前端调用返回 CORS 错误？
**A:** 确保 Edge Function 代码中包含了 CORS headers（已包含）。

### Q: 如何调试？
**A:** 在代码中添加 `console.log()`，然后在 Dashboard 的 Logs 标签中查看输出。

---

## 📝 优点和缺点

### ✅ 优点
- 无需安装任何工具
- 可视化界面，易于操作
- 可以直接在浏览器中编辑和测试
- 实时查看日志

### ❌ 缺点
- 每次更新都需要手动复制代码
- 无法使用版本控制
- 不适合频繁更新

### 💡 建议

如果你：
- **偶尔更新**：使用 Dashboard 手动部署即可
- **频繁更新**：建议安装 Supabase CLI（参考 DEPLOYMENT.md）

---

## 🚀 下一步

部署成功后：

1. ✅ 确保 `.env.local` 中配置了 VITE_SUPABASE_ANON_KEY（函数 URL 已硬编码在代码中，无需配置）
2. ✅ 重启开发服务器
3. ✅ 测试录入持股功能
4. ✅ 验证数据一致性（position/track/money/watchlist）

> **💡 注意：** `add-position` 函数 URL 已硬编码在代码中，不需要在环境变量中配置。

