# 环境变量配置

## 本地开发

在项目根目录创建 `.env.local` 文件（已在 .gitignore 中，不会提交到 git）：

```env
# Supabase Edge Function - 股票搜索 API
VITE_STOCK_SEARCH_API=http://localhost:54321/functions/v1/stock-search

# Supabase Edge Function - 股票详情 API
VITE_STOCK_DETAIL_API=http://localhost:54321/functions/v1/stock-detail

# Supabase 数据库配置
VITE_SUPABASE_URL=https://qixncbgvrkfjxopqqpiz.supabase.co
VITE_SUPABASE_ANON_KEY=你的_ANON_KEY
```

## 生产环境

在部署平台（Vercel/Netlify 等）的环境变量中配置：

```env
VITE_STOCK_SEARCH_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-search

# Supabase Edge Function - 股票详情 API
VITE_STOCK_DETAIL_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-detail

# Supabase 数据库配置
VITE_SUPABASE_URL=https://qixncbgvrkfjxopqqpiz.supabase.co
VITE_SUPABASE_ANON_KEY=你的_ANON_KEY
```

## 如何获取 Supabase API Key

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目（qixncbgvrkfjxopqqpiz）
3. 点击左侧菜单的 **Settings** ⚙️
4. 点击 **API**
5. 在 "Project API keys" 部分找到：
   - **anon public**: 这是前端使用的公开密钥
   - 复制 `anon` key 的值，添加到 `.env.local` 中

