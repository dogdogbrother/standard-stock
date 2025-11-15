-- 修改视图：自选股及其操作记录和股息率信息
-- 添加 dividend 表的关联查询

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
  ) AS tracks,
  json_build_object(
    'year', d.year,
    'num', d.num
  ) AS dividend
FROM watchlist w
LEFT JOIN track t ON w.stock = t.stock AND w.invt = t.invt
LEFT JOIN dividend d ON w.stock = d.stock
GROUP BY w.id, w.stock, w.invt, w.created_at, d.year, d.num;

COMMENT ON VIEW watchlist_with_tracks IS '自选股列表及其关联的操作记录和股息率信息（逻辑关联）';

