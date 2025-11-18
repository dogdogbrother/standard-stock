-- 为 watchlist 表添加 price 字段
-- price 字段用于存储添加自选时的价格（单位：分，整数）

-- 添加 price 字段（如果不存在）
ALTER TABLE watchlist 
ADD COLUMN IF NOT EXISTS price int4;

-- 添加注释
COMMENT ON COLUMN watchlist.price IS '添加自选时的股票价格（单位：分，整数）';

