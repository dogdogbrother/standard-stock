# Supabase Edge Functions 部署说明

## 前置要求

### 1. 安装 Supabase CLI

**Windows 推荐方式（Scoop）：**
```bash
# 如果没有安装 Scoop，先安装它
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**或使用 Chocolatey：**
```bash
choco install supabase
```

**或作为项目依赖（推荐用于团队开发）：**
```bash
pnpm add -D supabase
# 然后使用 pnpm supabase 代替 supabase 命令
```

更多安装方式：https://github.com/supabase/cli#install-the-cli

### 2. 登录 Supabase
```bash
supabase login
```

## 本地开发

1. 启动本地 Supabase 服务
```bash
supabase start
```

2. 在项目根目录创建 `.env.local` 文件（不要提交到 git）
```env
VITE_STOCK_SEARCH_API=http://localhost:54321/functions/v1/stock-search
```

3. 启动前端开发服务器
```bash
pnpm dev
```

4. 本地测试 Edge Function
```bash
curl "http://localhost:54321/functions/v1/stock-search?q=平安"
```

## 部署到生产环境

1. 关联你的 Supabase 项目
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

2. 部署 Edge Function
```bash
supabase functions deploy stock-search
```

3. 更新前端环境变量
在生产环境配置（Vercel/Netlify 等）中设置：
```env
VITE_STOCK_SEARCH_API=https://YOUR_PROJECT_REF.supabase.co/functions/v1/stock-search
```

## Edge Function 说明

### stock-search

**路径**: `/functions/v1/stock-search`

**参数**:
- `q`: 查询关键字（股票代码、拼音、汉字）

**返回示例**:
```json
{
  "code": 0,
  "msg": "",
  "data": {
    "stock": [
      ["sh", "601689", "拓普集团", "", "GP-A"],
      ["sz", "002233", "塔牌集团", "", "GP-A"]
    ]
  }
}
```

## 常见问题

### 1. 本地开发时 Edge Function 无法访问

确保 Supabase 本地服务已启动：
```bash
supabase status
```

### 2. 生产环境 CORS 错误

检查 Edge Function 中的 CORS 配置是否正确，`Access-Control-Allow-Origin` 应设置为你的前端域名或 `*`。

### 3. 如何查看日志

```bash
# 本地日志
supabase functions serve stock-search

# 生产环境日志
supabase functions logs stock-search
```

