-- 修复视图：在 GROUP BY 中添加 price 字段，确保视图返回 price 数据
-- 问题：之前的视图使用 w.* 但 GROUP BY 中没有包含 price，导致 price 字段无法返回

CREATE OR REPLACE VIEW watchlist_with_tracks AS
SELECT 
  w.id,
  w.stock,
  w.invt,
  w.created_at,
  w.price,  -- 明确包含 price 字段
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
  ) AS tracks,
  json_build_object(
    'year', d.year,
    'num', d.num
  ) AS dividend
FROM watchlist w
LEFT JOIN track t ON w.stock = t.stock AND w.invt = t.invt
LEFT JOIN dividend d ON w.stock = d.stock
GROUP BY w.id, w.stock, w.invt, w.created_at, w.price, d.year, d.num;  -- 在 GROUP BY 中添加 w.price

COMMENT ON VIEW watchlist_with_tracks IS '自选股列表及其关联的操作记录和股息率信息（逻辑关联），包含添加自选时的价格';

