# 基金数据获取脚本

使用 [AKShare](https://akshare.akfamily.xyz/index.html) 获取公募基金持仓数据，并存储到 Supabase 数据库。

## 📋 功能说明

- ✅ 获取股票型和混合型基金列表（~8,900 只）
- ✅ 获取每只基金的股票持仓明细
- ✅ 自动过滤债券型、指数型、货币型、QDII 等
- ✅ 支持分批获取，避免超时
- ✅ 自动存储到 Supabase 数据库

## 🚀 快速开始（3步）

### 第1步：创建数据库表

在 [Supabase SQL Editor](https://app.supabase.com/project/qixncbgvrkfjxopqqpiz/sql/new) 中执行：

```sql
-- 复制 create_tables.sql 的内容并执行
```

### 第2步：配置环境变量

```bash
cd scripts
copy env.template .env
notepad .env  # 填写 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY
```

**获取 Service Role Key：**
访问 [Supabase API Settings](https://app.supabase.com/project/qixncbgvrkfjxopqqpiz/settings/api)，复制 `service_role` key

### 第3步：运行脚本

#### 3.1 获取基金列表（一次性）

```powershell
.\run_list_only.bat
```

#### 3.2 获取基金持仓（分批执行）

```powershell
.\run_holdings.bat  # 第1批（0-999）
```

修改 `fetch_holdings_only.py` 第 **128 行**：
```python
START_INDEX = 1000  # 第2批
```

```powershell
.\run_holdings.bat  # 第2批（1000-1999）
```

重复直到完成所有基金（共约 9 批）

---

## 📊 数据库表结构

### fund_list（基金列表）
| 字段 | 类型 | 说明 |
|------|------|------|
| fund_code | TEXT | 基金代码（主键） |
| fund_name | TEXT | 基金名称 |
| fund_type | TEXT | 基金类型 |

### fund_holdings（基金持仓）⭐ 核心表
| 字段 | 类型 | 说明 |
|------|------|------|
| fund_code | TEXT | 基金代码 |
| stock_code | TEXT | 股票代码 |
| stock_name | TEXT | 股票名称 |
| holding_ratio | FLOAT | 占净值比例（%）|
| holding_shares | FLOAT | 持股数 |
| holding_value | FLOAT | 持仓市值 |
| report_date | TEXT | 报告期（如 2024Q4）|

**说明：** 通过 `report_date` 字段记录不同时期的持仓，每个季度的持仓变化都会作为新记录插入。

---

## 🔍 数据查询示例

### 查找重仓某只股票的基金

```sql
SELECT 
  fl.fund_name,
  fh.holding_ratio,
  fh.report_date
FROM fund_holdings fh
JOIN fund_list fl ON fh.fund_code = fl.fund_code
WHERE fh.stock_code = '600519'  -- 贵州茅台
  AND fh.report_date = '2024Q4'
ORDER BY fh.holding_ratio DESC
LIMIT 20;
```

### 查看基金的持仓组合

```sql
SELECT 
  stock_code,
  stock_name,
  holding_ratio,
  holding_value
FROM fund_holdings
WHERE fund_code = '000001'
  AND report_date = '2024Q4'
ORDER BY holding_ratio DESC;
```

### 追踪基金持仓变化

```sql
SELECT 
  report_date,
  stock_code,
  stock_name,
  holding_ratio
FROM fund_holdings
WHERE fund_code = '000001'
  AND stock_code = '600519'
ORDER BY report_date DESC;
```

### 查看进度

```sql
-- 已获取持仓的基金数
SELECT COUNT(DISTINCT fund_code) as 已完成基金数 
FROM fund_holdings;

-- 持仓总记录数
SELECT COUNT(*) as 持仓总记录数 FROM fund_holdings;

-- 完成进度
SELECT 
  ROUND(
    (SELECT COUNT(DISTINCT fund_code)::numeric FROM fund_holdings) / 
    (SELECT COUNT(*)::numeric FROM fund_list) * 100, 
    2
  ) || '%' as 完成度;
```

---

## 🛠️ 常用命令

### 安装依赖（首次）

```powershell
cd scripts
pip install -r requirements.txt
```

### 测试环境

```powershell
python test_connection.py
```

### 查看基金类型分布

```powershell
python check_fund_types.py
```

### 清空数据重新开始

在 Supabase SQL Editor 执行：
```sql
-- 执行 clear_tables.sql 的内容
TRUNCATE TABLE fund_list CASCADE;
TRUNCATE TABLE fund_holdings CASCADE;
```

---

## 📝 分批获取进度表

| 批次 | START_INDEX | 范围 | 状态 |
|------|-------------|------|------|
| 第1批 | 0 | 0-999 | ⏳ |
| 第2批 | 1000 | 1000-1999 | ⏸️ |
| 第3批 | 2000 | 2000-2999 | ⏸️ |
| ... | ... | ... | ... |
| 第9批 | 8000 | 8000-8899 | ⏸️ |

**用时估算：** 每批 30-60 分钟，全部约 5-9 小时

---

## ⚠️ 注意事项

1. **分批执行**：每次修改 `START_INDEX`，避免一次运行过久
2. **网络稳定**：建议在网络稳定时段运行
3. **Service Role Key**：注意保密，不要泄露
4. **数据去重**：脚本会自动处理重复数据（UNIQUE 约束）
5. **报告期**：AKShare 返回的是最新一期的持仓数据

---

## 🆘 常见问题

### Q: 持仓保存失败？

A: 运行后查看详细错误信息，可能是：
- 数据重复（409）→ 清空表重新运行
- 权限不足（401）→ 检查 service_role_key
- 数据格式错误（400）→ 检查 AKShare 返回格式

### Q: 网络卡住怎么办？

A: 
- 按 Ctrl+C 中断
- 等待几分钟再试
- 或换个网络环境（手机热点）

### Q: 如何知道哪些基金已完成？

A: 查询数据库：
```sql
SELECT DISTINCT fund_code FROM fund_holdings ORDER BY fund_code;
```

### Q: 中断后如何继续？

A: 修改 `START_INDEX` 到中断的位置继续即可，已有数据不会重复。

---

## 📚 相关资源

- [AKShare 官方文档](https://akshare.akfamily.xyz/index.html)
- [AKShare 基金数据接口](https://akshare.akfamily.xyz/data/fund/fund.html)
- [Supabase 文档](https://supabase.com/docs)

---

## 📂 文件说明

| 文件 | 说明 |
|------|------|
| `fetch_fund_list_only.py` | 获取基金列表并过滤类型 |
| `fetch_holdings_only.py` | 获取基金持仓数据 |
| `run_list_only.bat` | 运行列表获取脚本 |
| `run_holdings.bat` | 运行持仓获取脚本 |
| `create_tables.sql` | 创建数据库表结构 |
| `clear_tables.sql` | 清空数据库表 |
| `test_connection.py` | 测试环境配置 |
| `check_fund_types.py` | 查看基金类型分布 |
| `requirements.txt` | Python 依赖包 |
| `env.template` | 环境变量模板 |
| `.gitignore` | Git 忽略配置 |

---

🎉 **开始使用：**

```powershell
cd C:\code\standard-stock\scripts

# 1. 获取基金列表（一次性）
.\run_list_only.bat

# 2. 获取持仓数据（分批）
.\run_holdings.bat
```
