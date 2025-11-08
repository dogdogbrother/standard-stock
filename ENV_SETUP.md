# 环境变量配置

## 本地开发

在项目根目录创建 `.env.local` 文件（已在 .gitignore 中，不会提交到 git）：

```env
# Supabase Edge Function - 股票搜索 API
VITE_STOCK_SEARCH_API=http://localhost:54321/functions/v1/stock-search
```

## 生产环境

在部署平台（Vercel/Netlify 等）的环境变量中配置：

```env
VITE_STOCK_SEARCH_API=https://YOUR_PROJECT_REF.supabase.co/functions/v1/stock-search
```

将 `YOUR_PROJECT_REF` 替换为你的 Supabase 项目 ID。

## 如何获取 Supabase 项目 ID

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 在 Settings > API 中查看 `Project URL`
4. URL 格式为：`https://PROJECT_REF.supabase.co`

