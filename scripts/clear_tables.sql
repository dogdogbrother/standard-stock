-- ================================================
-- 清空基金数据表
-- 在 Supabase SQL Editor 中执行此脚本
-- ================================================

-- 警告：此操作会删除所有基金数据，请谨慎执行！

-- 1. 清空所有表（CASCADE 会自动处理外键关系）
TRUNCATE TABLE fund_list CASCADE;
TRUNCATE TABLE fund_holdings CASCADE;

-- 2. 验证清空结果
DO $$
DECLARE
  fund_list_count INTEGER;
  fund_holdings_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fund_list_count FROM fund_list;
  SELECT COUNT(*) INTO fund_holdings_count FROM fund_holdings;
  
  RAISE NOTICE '清空结果：';
  RAISE NOTICE '  - fund_list: % 条', fund_list_count;
  RAISE NOTICE '  - fund_holdings: % 条', fund_holdings_count;
  
  IF fund_list_count = 0 AND fund_holdings_count = 0 THEN
    RAISE NOTICE '✓ 所有表已清空，可以重新运行脚本！';
  ELSE
    RAISE NOTICE '⚠ 清空未完成，请检查';
  END IF;
END $$;

