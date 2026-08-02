-- V005__action_position.sql - Phase 4 可视化编辑器节点位置持久化
-- 给 actions 表新增画布坐标字段，用于 React Flow 节点位置持久化

-- 新增 position_x / position_y 字段（默认 0，兼容历史数据）
ALTER TABLE actions ADD COLUMN position_x REAL NOT NULL DEFAULT 0;
ALTER TABLE actions ADD COLUMN position_y REAL NOT NULL DEFAULT 0;
