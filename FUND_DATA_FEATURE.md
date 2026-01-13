# 基金数据获取功能

## 📌 功能概述

本项目新增了基金数据获取功能，使用 Python + AKShare 库获取公募基金数据，并存储到 Supabase 数据库。

## 🎯 功能特性

### 数据来源
- **数据提供商**: [AKShare](https://akshare.akfamily.xyz/) - 开源的金融数据接口库
- **数据类型**: 
  - 公募基金列表（8000+ 只基金）
  - 基金持仓明细（股票持仓）
  - 基金规模数据（资产规模、份额）

### 技术栈
- **语言**: Python 3.8+
- **数据获取**: AKShare
- **数据存储**: Supabase PostgreSQL
- **依赖管理**: pip + requirements.txt

## 📂 文件结构

```
scripts/
├── fund_data_fetcher.py    # 主脚本：获取并存储基金数据
├── test_connection.py      # 测试脚本：验证环境配置
├── requirements.txt        # Python 依赖
├── create_tables.sql       # 数据库表创建脚本
├── env.template           # 环境变量模板
├── run.bat                # Windows 快速启动脚本
├── run.sh                 # Linux/macOS 快速启动脚本
├── README.md              # 详细文档
└── GETTING_STARTED.md     # 快速开始指南
```

## 🚀 快速开始

### 1. 创建数据库表

在 Supabase SQL Editor 中执行 `scripts/create_tables.sql`

### 2. 配置环境变量

```bash
cd scripts
cp env.template .env
# 编辑 .env 填写 Supabase 配置
```

### 3. 运行脚本

**Windows:**
```bash
run.bat
```

**Linux/macOS:**
```bash
chmod +x run.sh
./run.sh
```

详细说明请查看：
- 📖 [快速开始指南](scripts/GETTING_STARTED.md)
- 📖 [完整文档](scripts/README.md)

## 📊 数据库表结构

### fund_list（基金列表）
| 字段 | 类型 | 说明 |
|------|------|------|
| fund_code | TEXT | 基金代码（主键） |
| fund_name | TEXT | 基金名称 |
| fund_type | TEXT | 基金类型 |

### fund_holdings（基金持仓）
| 字段 | 类型 | 说明 |
|------|------|------|
| fund_code | TEXT | 基金代码 |
| stock_code | TEXT | 股票代码 |
| stock_name | TEXT | 股票名称 |
| holding_ratio | FLOAT | 占净值比例(%) |
| holding_value | FLOAT | 持仓市值 |
| report_date | TEXT | 报告期 |

### fund_scale（基金规模）
| 字段 | 类型 | 说明 |
|------|------|------|
| fund_code | TEXT | 基金代码 |
| report_date | TEXT | 报告期 |
| scale | FLOAT | 资产规模（亿元） |
| share | FLOAT | 份额（亿份） |

## 🔧 使用场景

### 场景1：查找重仓某只股票的基金

在"机构"页面可以展示哪些基金重仓了用户关注的股票。

```sql
SELECT fl.fund_name, fh.holding_ratio
FROM fund_holdings fh
JOIN fund_list fl ON fh.fund_code = fl.fund_code
WHERE fh.stock_code = '600519'
ORDER BY fh.holding_ratio DESC;
```

### 场景2：分析基金规模变化

跟踪基金规模的增长或缩减趋势。

```sql
SELECT report_date, scale
FROM fund_scale
WHERE fund_code = '000001'
ORDER BY report_date DESC;
```

### 场景3：基金持仓分析

查看基金的重仓股组合，分析投资风格。

## 🎨 前端集成建议

### 在"机构"页面展示

之前创建的 `src/views/institution/index.vue` 可以用来展示基金数据：

1. **基金搜索**：搜索基金代码或名称
2. **基金持仓**：展示基金的前十大重仓股
3. **机构持仓分析**：查看哪些基金持有某只股票
4. **规模趋势**：展示基金规模变化图表

### API 接口建议

可以创建 Supabase Edge Function 提供数据查询接口：

```typescript
// supabase/functions/fund-holdings/index.ts
// 查询持有某只股票的基金列表
```

## 📝 注意事项

### 数据更新频率
- 基金持仓：每季度更新（季报发布后）
- 基金规模：每季度或每月更新
- 建议定时任务：每月运行一次

### 性能优化
- 首次运行建议使用测试模式（10只基金）
- 全量获取约需 2-4 小时
- 建议在服务器上定时执行，而非本地

### 数据合规
- AKShare 提供的是公开数据
- 仅供个人学习研究使用
- 商业使用请遵守相关法律法规

## 🔗 相关资源

- [AKShare 官方文档](https://akshare.akfamily.xyz/index.html)
- [AKShare 基金数据接口](https://akshare.akfamily.xyz/data/fund/fund.html)
- [Supabase Python 客户端](https://supabase.com/docs/reference/python/introduction)

## 🚀 未来扩展

可以继续扩展的功能：

1. **机构研报数据**：券商研究报告
2. **北向资金数据**：外资持股数据
3. **社保持仓数据**：社保基金持股
4. **QFII 持仓数据**：外资机构持股
5. **机构调研数据**：上市公司调研记录

这些数据在 AKShare 中都有相应接口，可以参考 `fund_data_fetcher.py` 的实现方式进行扩展。

## 💡 贡献

如果你有更好的想法或发现问题，欢迎提交 Issue 或 Pull Request！

