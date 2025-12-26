# 🚀 stock-search Edge Function 部署指南

## 快速部署（Supabase Dashboard）

### 1. 访问 Edge Functions 页面
```
https://app.supabase.com/project/qixncbgvrkfjxopqqpiz/functions
```

### 2. 创建或更新函数

#### 如果函数不存在：
1. 点击 **"Create a new function"**
2. Function name: `stock-search`
3. 点击 **"Create function"**

#### 如果函数已存在：
1. 在函数列表中点击 `stock-search`
2. 进入编辑页面

### 3. 复制代码

1. 打开本地文件：`supabase/functions/stock-search/index.ts`
2. 全选复制（Ctrl+A, Ctrl+C）
3. 粘贴到 Dashboard 编辑器中（Ctrl+V）

**完整代码：**
```typescript
// @ts-nocheck
// Supabase Edge Function - 股票搜索代理
// Deploy: supabase functions deploy stock-search
// Note: 此文件运行在 Deno 环境中，TypeScript 配置已排除

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TENCENT_API = 'https://proxy.finance.qq.com/ifzqgtimg/appstock/smartbox/search/get'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 获取查询参数
    const url = new URL(req.url)
    const query = url.searchParams.get('q')

    if (!query) {
      return new Response(
        JSON.stringify({ error: '缺少查询参数 q' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 请求腾讯接口
    const tencentUrl = `${TENCENT_API}?q=${encodeURIComponent(query)}`
    const response = await fetch(tencentUrl)

    if (!response.ok) {
      throw new Error(`腾讯接口返回错误: ${response.status}`)
    }

    const data = await response.json()

    // 返回数据
    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '请求失败' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

### 4. 部署

1. 点击右上角 **"Deploy"** 按钮
2. 等待部署完成（约10-30秒）
3. 看到绿色提示 "Successfully deployed"

---

## 🧪 测试

### 方法 1: Dashboard 测试

1. 在函数详情页，点击 **"Invoke"** 标签
2. 在 URL parameters 中添加：
   ```
   q=000001
   ```
3. 点击 **"Run"**
4. **预期结果：**
   ```json
   {
     "code": 0,
     "msg": "",
     "data": {
       "stock": [
         ["sz", "000001", "平安银行", "", "GP-A"]
       ]
     }
   }
   ```

### 方法 2: 浏览器测试

直接在浏览器访问：
```
https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-search?q=000001
```

应该返回 JSON 数据。

### 方法 3: curl 测试

```bash
curl "https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-search?q=000001"
```

---

## 🔧 前端配置

确保 `.env.local` 中配置了正确的 URL：

```env
VITE_STOCK_SEARCH_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-search
```

**配置后必须重启开发服务器！**

```bash
# 停止服务器（Ctrl+C）
# 重新启动
npm run dev
```

---

## 📊 查看日志

### 实时日志

1. 在函数详情页，点击 **"Logs"** 标签
2. 点击 **"Tail logs"** 开关
3. 在前端触发搜索，实时查看日志

### 历史日志

1. 在 **"Logs"** 标签中
2. 调整时间范围（Last hour / Last 24 hours）
3. 查看所有请求记录

---

## ⚠️ 常见问题

### Q: 部署后仍然 404？
**A:** 
1. 确认函数名称是 `stock-search`（不是 stock_search 或其他）
2. 等待1-2分钟让部署生效
3. 清除浏览器缓存

### Q: 返回 CORS 错误？
**A:** 
1. 确认代码中包含了 CORS headers（已包含）
2. 检查 OPTIONS 请求是否返回 200
3. 重新部署函数

### Q: 返回 500 错误但没有日志？
**A:** 
1. 函数可能在初始化阶段就崩溃了
2. 检查代码是否有语法错误
3. 查看 Logs 中是否有部署错误

### Q: 腾讯接口返回错误？
**A:** 
1. 腾讯 API 可能暂时不可用
2. 检查网络是否能访问 `proxy.finance.qq.com`
3. 查看 Logs 中的具体错误信息

---

## 🎯 故障排查流程

```
1. 检查函数是否部署 
   ↓ 否 → 部署函数
   ↓ 是
2. 浏览器直接访问测试
   ↓ 404 → 重新部署
   ↓ CORS → 检查 CORS 配置
   ↓ 500 → 查看 Logs
   ↓ 成功
3. 检查前端环境变量
   ↓ 错误 → 更新 .env.local 并重启
   ↓ 正确
4. 检查前端网络请求
   ↓ 查看 Network 标签
   ↓ 查看具体错误信息
```

---

## 📝 部署完成检查清单

- [ ] 函数在 Dashboard 显示为 "Deployed"
- [ ] 浏览器直接访问返回正确数据
- [ ] `.env.local` 配置正确
- [ ] 开发服务器已重启
- [ ] 前端搜索功能正常
- [ ] Logs 中能看到请求记录

---

部署成功后，`stock-search` 功能就可以正常使用了！🎉

