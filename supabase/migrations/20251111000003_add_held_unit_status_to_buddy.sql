-- 在 buddy 表中添加 heldUnitStatus 字段
-- 0 = 待确认, 1 = 已确认

-- 添加字段，默认值为 0（待确认）
ALTER TABLE buddy 
ADD COLUMN held_unit_status INT2 DEFAULT 0 NOT NULL;

-- 添加检查约束，确保值只能是 0 或 1
ALTER TABLE buddy 
ADD CONSTRAINT check_held_unit_status CHECK (held_unit_status IN (0, 1));

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_buddy_held_unit_status ON buddy(held_unit_status);

-- 添加注释
COMMENT ON COLUMN buddy.held_unit_status IS '持有份额状态：0=待确认, 1=已确认';

