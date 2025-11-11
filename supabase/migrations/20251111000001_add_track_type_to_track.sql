-- 创建 track_type 枚举类型
CREATE TYPE track_type AS ENUM ('increase', 'reduce');

-- 在 track 表中添加 track_type 字段
ALTER TABLE track 
ADD COLUMN track_type track_type;

-- 添加注释
COMMENT ON COLUMN track.track_type IS '追踪类型：increase(看涨) 或 reduce(看跌)';

-- 如果需要设置默认值，可以取消下面这行的注释
-- ALTER TABLE track ALTER COLUMN track_type SET DEFAULT 'increase';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_track_type ON track(track_type);

