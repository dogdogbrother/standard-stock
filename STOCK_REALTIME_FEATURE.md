# 持股实时行情功能

## 功能说明

在持股信息模块中，现在可以实时显示股票的最新价和涨跌幅。

## 实现细节

### 1. Supabase Edge Function

创建了 `stock-detail` Edge Function 来代理东方财富接口：

**文件位置**: `supabase/functions/stock-detail/index.ts`

**接口参数**:
- `secids`: 股票代码列表，格式：`0.000001,1.600000`（前缀 0=深市，1=沪市）
- `fields`: 返回字段，默认 `f2,f3,f12,f14`
  - f2: 最新价（需除以100）
  - f3: 涨跌幅（需除以100）
  - f12: 股票代码
  - f14: 股票名称

### 2. 前端实现

**文件位置**: `src/views/profile/components/PositionSection.vue`

**核心功能**:

1. **市场判断**: 根据股票代码判断所属市场
   - 60、68 开头 → 沪市（前缀 1）
   - 00、30、002 开头 → 深市（前缀 0）

2. **数据获取**: 批量获取所有持股的实时数据

3. **数据处理**:
   - 最新价：原始值 / 100（例如：13500 → 135.00）
   - 涨跌幅：原始值 / 100 + '%'（例如：131 → 1.31%）

4. **UI 显示**:
   - 最新价：保留 2 位小数，不带人民币符号
   - 涨跌幅：正数显示 +，负数显示 -，带 % 符号
   - 颜色标识：红色（涨）、绿色（跌）

## 环境变量配置

在 `.env.local` 文件中添加：

```env
# Supabase 配置
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stock Detail API（可选，如果不配置会使用默认的 Supabase URL）
VITE_STOCK_DETAIL_API=https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-detail

# 本地开发环境（如果使用 Supabase 本地开发）
# VITE_STOCK_DETAIL_API=http://localhost:54321/functions/v1/stock-detail
```

如果未配置 `VITE_STOCK_DETAIL_API`，将使用默认值：`https://qixncbgvrkfjxopqqpiz.supabase.co/functions/v1/stock-detail`

**注意**：调用 Supabase Edge Function 需要在请求头中添加 Authorization：
```javascript
headers: {
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'Content-Type': 'application/json'
}
```

## 部署 Edge Function

```bash
# 部署到 Supabase
supabase functions deploy stock-detail
```

## 数据示例

### 请求示例
```
GET /stock-detail?secids=1.601689,0.000001&fields=f2,f3,f12
```

### 响应示例
```json
{
  "data": {
    "diff": [
      {
        "f2": 13500,   // 最新价 135.00
        "f3": 131,     // 涨跌幅 1.31%
        "f12": "601689"
      },
      {
        "f2": 9850,    // 最新价 98.50
        "f3": -52,     // 涨跌幅 -0.52%
        "f12": "000001"
      }
    ]
  }
}
```

## UI 效果

持股列表中每个股票显示：
- ✅ 成本价
- ✅ 最新价（带涨跌颜色）
- ✅ 涨跌幅（带 +/- 符号和颜色）
- ✅ 持股数

## 注意事项

1. 数据获取失败不影响持股列表的正常显示
2. 涨跌颜色：红涨绿跌（中国股市习惯）
3. 最新价和涨跌幅在数据加载前显示 `--`

