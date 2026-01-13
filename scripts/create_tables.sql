-- ================================================
-- 基金数据表创建脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- ================================================

-- 1. 基金列表表
CREATE TABLE IF NOT EXISTS fund_list (
  id BIGSERIAL PRIMARY KEY,
  fund_code TEXT UNIQUE NOT NULL,
  fund_name TEXT,
  fund_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fund_list IS '基金列表表 - 存储所有公募基金的基本信息';
COMMENT ON COLUMN fund_list.fund_code IS '基金代码（唯一）';
COMMENT ON COLUMN fund_list.fund_name IS '基金简称';
COMMENT ON COLUMN fund_list.fund_type IS '基金类型（股票型、混合型、债券型等）';

-- 2. 基金持仓表
CREATE TABLE IF NOT EXISTS fund_holdings (
  id BIGSERIAL PRIMARY KEY,
  fund_code TEXT NOT NULL,
  stock_code TEXT NOT NULL,
  stock_name TEXT,
  holding_ratio FLOAT,  -- 核心字段：占净值比例
  holding_shares FLOAT,  -- 可选：如果空间紧张可以不存
  holding_value FLOAT,   -- 可选：如果空间紧张可以不存
  report_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fund_code, stock_code, report_date)
);

COMMENT ON TABLE fund_holdings IS '基金持仓表 - 存储基金的股票持仓明细';
COMMENT ON COLUMN fund_holdings.fund_code IS '基金代码';
COMMENT ON COLUMN fund_holdings.stock_code IS '股票代码';
COMMENT ON COLUMN fund_holdings.stock_name IS '股票名称';
COMMENT ON COLUMN fund_holdings.holding_ratio IS '占净值比例（%）';
COMMENT ON COLUMN fund_holdings.holding_shares IS '持股数';
COMMENT ON COLUMN fund_holdings.holding_value IS '持仓市值';
COMMENT ON COLUMN fund_holdings.report_date IS '报告期（季度）';

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_fund_list_fund_code ON fund_list(fund_code);
CREATE INDEX IF NOT EXISTS idx_fund_holdings_fund_code ON fund_holdings(fund_code);
CREATE INDEX IF NOT EXISTS idx_fund_holdings_stock_code ON fund_holdings(stock_code);
CREATE INDEX IF NOT EXISTS idx_fund_holdings_report_date ON fund_holdings(report_date);

-- 4. 启用行级安全策略（可选，根据需求开启）
-- ALTER TABLE fund_list ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fund_holdings ENABLE ROW LEVEL SECURITY;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✓ 基金数据表创建完成！';
  RAISE NOTICE '  - fund_list: 基金列表';
  RAISE NOTICE '  - fund_holdings: 基金持仓（含报告期）';
  RAISE NOTICE '';
  RAISE NOTICE '说明：不需要 fund_scale 表';
  RAISE NOTICE '      fund_holdings.report_date 已记录报告期';
  RAISE NOTICE '      fund_holdings.holding_value 已记录持仓市值';
END $$;

