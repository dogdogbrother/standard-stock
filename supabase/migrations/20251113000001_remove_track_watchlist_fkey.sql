-- 移除 track 表对 watchlist 的外键约束
-- 原因: track（操作记录）应该独立于 watchlist（自选股）
-- 即使股票被移出自选，操作记录也应保留

ALTER TABLE track DROP CONSTRAINT IF EXISTS track_stock_fkey;

-- 添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_track_stock_invt ON track(stock, invt);

-- 添加注释
COMMENT ON TABLE track IS '持仓操作记录表，记录所有买卖操作，独立于自选股列表';

-- 创建视图：自选股及其操作记录（逻辑关联，无外键约束）
CREATE OR REPLACE VIEW watchlist_with_tracks AS
SELECT 
  w.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', t.id,
        'stock', t.stock,
        'invt', t.invt,
        'name', t.name,
        'money', t.money,
        'price', t.price,
        'num', t.num,
        'track_type', t.track_type,
        'created_at', t.created_at
      ) ORDER BY t.created_at DESC
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'::json
  ) AS tracks
FROM watchlist w
LEFT JOIN track t ON w.stock = t.stock AND w.invt = t.invt
GROUP BY w.id, w.stock, w.invt, w.name, w.created_at;

COMMENT ON VIEW watchlist_with_tracks IS '自选股列表及其关联的操作记录（逻辑关联）';

