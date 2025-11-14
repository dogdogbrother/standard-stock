-- 创建一个通用的更新 updated_at 的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 给 buddy 表添加 updated_at 字段和触发器
ALTER TABLE buddy ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS update_buddy_updated_at ON buddy;
CREATE TRIGGER update_buddy_updated_at
    BEFORE UPDATE ON buddy
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 给 money 表添加 updated_at 字段和触发器
ALTER TABLE money ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS update_money_updated_at ON money;
CREATE TRIGGER update_money_updated_at
    BEFORE UPDATE ON money
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 给 position 表添加 updated_at 字段和触发器
ALTER TABLE position ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS update_position_updated_at ON position;
CREATE TRIGGER update_position_updated_at
    BEFORE UPDATE ON position
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 给 track 表添加 updated_at 字段和触发器
ALTER TABLE track ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS update_track_updated_at ON track;
CREATE TRIGGER update_track_updated_at
    BEFORE UPDATE ON track
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 给 buddyOrder 表添加 updated_at 字段和触发器
ALTER TABLE "buddyOrder" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS update_buddyOrder_updated_at ON "buddyOrder";
CREATE TRIGGER update_buddyOrder_updated_at
    BEFORE UPDATE ON "buddyOrder"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 给 unit 表添加 updated_at 字段和触发器
ALTER TABLE unit ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS update_unit_updated_at ON unit;
CREATE TRIGGER update_unit_updated_at
    BEFORE UPDATE ON unit
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 给 watchlist 表添加 updated_at 字段和触发器
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS update_watchlist_updated_at ON watchlist;
CREATE TRIGGER update_watchlist_updated_at
    BEFORE UPDATE ON watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON COLUMN buddy.updated_at IS '更新时间（自动更新）';
COMMENT ON COLUMN money.updated_at IS '更新时间（自动更新）';
COMMENT ON COLUMN position.updated_at IS '更新时间（自动更新）';
COMMENT ON COLUMN track.updated_at IS '更新时间（自动更新）';
COMMENT ON COLUMN "buddyOrder".updated_at IS '更新时间（自动更新）';
COMMENT ON COLUMN unit.updated_at IS '更新时间（自动更新）';
COMMENT ON COLUMN watchlist.updated_at IS '更新时间（自动更新）';

