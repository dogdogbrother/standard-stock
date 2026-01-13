# 📝 更新日志

## 2026-01-13 - 新增机构页面和基金数据获取功能

### ✅ 更新内容

**1. 新增"机构"Tab页**
- 在 tab 栏添加"机构"选项（自选 → 机构 → 伙伴 → 我的）
- 创建机构页面路由和页面结构
- 为后续展示基金持仓等机构数据做准备

**2. 新增基金数据获取脚本（Python）**
- 使用 AKShare 获取公募基金数据
- 支持获取基金列表、持仓明细、规模数据
- 自动存储到 Supabase 数据库
- 提供完整的文档和快速启动脚本

### 📄 修改/新增的文件

**前端部分：**
1. `src/views/AppLayout.vue` - 添加"机构" tab
2. `src/router/index.ts` - 添加机构页面路由
3. `src/views/institution/index.vue` - 创建机构页面（新）

**Python 脚本部分（新增 `scripts/` 目录）：**
1. `scripts/fund_data_fetcher.py` - 基金数据获取主脚本
2. `scripts/test_connection.py` - 环境测试脚本
3. `scripts/requirements.txt` - Python 依赖
4. `scripts/create_tables.sql` - 数据库表创建脚本
5. `scripts/env.template` - 环境变量模板
6. `scripts/run.bat` - Windows 快速启动脚本
7. `scripts/run.sh` - Linux/macOS 快速启动脚本
8. `scripts/README.md` - 详细文档
9. `scripts/GETTING_STARTED.md` - 快速开始指南
10. `scripts/.gitignore` - Python 相关忽略文件

**文档部分：**
1. `FUND_DATA_FEATURE.md` - 基金数据功能说明文档（新）

### 💡 技术说明

**为什么使用 Python 而不是 Edge Function？**
- Supabase Edge Functions 基于 Deno，只支持 TypeScript/JavaScript
- AKShare 是 Python 生态的金融数据库，功能强大
- 采用独立脚本方案：Python 脚本 + 定时任务

**数据库表结构：**
- `fund_list`: 基金列表（基金代码、名称、类型）
- `fund_holdings`: 基金持仓（股票持仓明细）
- `fund_scale`: 基金规模（资产规模、份额）

### 🚀 使用方法

1. 在 Supabase SQL Editor 执行 `scripts/create_tables.sql`
2. 配置环境变量：`cp scripts/env.template scripts/.env`
3. 运行脚本：Windows `run.bat` / Linux/macOS `./run.sh`

详细文档：
- 📖 [快速开始](scripts/GETTING_STARTED.md)
- 📖 [完整文档](scripts/README.md)
- 📖 [功能说明](FUND_DATA_FEATURE.md)

### 📚 参考资源

- [AKShare 官方文档](https://akshare.akfamily.xyz/index.html)

---

## 2025-12-26 - 移除不必要的环境变量

### ✅ 更新内容

**Edge Function URL 硬编码** - 不再需要配置 `VITE_ADD_POSITION_API` 环境变量

### 📄 修改的文件

1. **src/views/profile/components/AddPositionDialog.vue**
   - ✅ 移除 `import.meta.env.VITE_ADD_POSITION_API`
   - ✅ 直接使用硬编码 URL：`https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position`

2. **ENV_SETUP.md**
   - ✅ 移除 `VITE_ADD_POSITION_API` 配置项

3. **env.example**
   - ✅ 移除 `VITE_ADD_POSITION_API` 配置项
   - ✅ 添加说明：函数 URL 已硬编码，无需配置

4. **QUICK_START.md**
   - ✅ 更新环境变量示例
   - ✅ 添加说明和故障排查更新

5. **supabase/functions/add-position/MANUAL_DEPLOY.md**
   - ✅ 更新"下一步"部分的说明

6. **supabase/functions/add-position/DEPLOYMENT.md**
   - ✅ 更新"前端配置"部分，添加代码示例和说明

7. **MIGRATION_SUMMARY.md**
   - ✅ 在改进列表中添加硬编码说明

### 💡 为什么这样做？

**Edge Function URL 是公开的，不需要保密：**

✅ **优点：**
- 减少环境变量配置
- 简化部署流程
- URL 不会变化，硬编码更直观
- 避免因环境变量未配置导致的问题

❌ **需要环境变量的情况：**
- API Key / Token（需要保密）
- 敏感配置信息
- 不同环境有不同值的配置

**Edge Function URL 是固定的公开端点，不属于上述情况。**

### 📋 现在需要配置的环境变量

只需要在 `.env.local` 中配置这些：

```env
# Supabase Edge Function - 股票搜索 API
VITE_STOCK_SEARCH_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-search

# Supabase Edge Function - 股票详情 API
VITE_STOCK_DETAIL_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-detail

# Supabase 数据库配置
VITE_SUPABASE_URL=https://qixncbgvrkfjxopqqpiz.supabase.co
VITE_SUPABASE_ANON_KEY=你的_ANON_KEY
```

> **⚠️ 注意：** 仍然需要配置 `VITE_SUPABASE_ANON_KEY`，这是需要保密的认证密钥。

### 🔄 迁移步骤

如果你已经在使用旧的配置：

1. ✅ 从 `.env.local` 中删除 `VITE_ADD_POSITION_API`
2. ✅ 无需修改代码（已自动更新）
3. ✅ 重启开发服务器即可

---

## 📊 最终的配置对比

### 之前（不推荐）

```typescript
// 代码中
const apiUrl = import.meta.env.VITE_ADD_POSITION_API || 'https://...'
```

```env
# .env.local 中
VITE_ADD_POSITION_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position
```

### 现在（推荐）✅

```typescript
// 代码中
const response = await fetch('https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/add-position', {
  // ...
})
```

```env
# .env.local 中
# 无需配置 VITE_ADD_POSITION_API
```

**更简洁、更直观！** 🎉

---

## 🎯 下一步

继续按照 **QUICK_START.md** 完成部署和测试即可！

