-- 删除 track 表的唯一约束（如果存在）
-- track 表是操作历史记录表，同一股票可以有多次操作记录

-- 删除可能存在的唯一约束
ALTER TABLE track DROP CONSTRAINT IF EXISTS track_stock_invt_unique;
ALTER TABLE track DROP CONSTRAINT IF EXISTS track_stock_invt_key;

-- 如果表有主键约束导致问题，确保使用自增 ID
-- 检查是否有 id 字段，如果没有则添加
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'track' AND column_name = 'id') THEN
        ALTER TABLE track ADD COLUMN id BIGSERIAL PRIMARY KEY;
    END IF;
END $$;

-- 添加 created_at 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'track' AND column_name = 'created_at') THEN
        ALTER TABLE track ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
    END IF;
END $$;

-- 为了优化查询，添加复合索引（但不是唯一约束）
CREATE INDEX IF NOT EXISTS idx_track_stock_invt ON track(stock, invt);
CREATE INDEX IF NOT EXISTS idx_track_created_at ON track(created_at DESC);

-- 更新注释
COMMENT ON TABLE track IS '持仓操作历史记录表，每次加仓或减仓都会生成一条新记录';

