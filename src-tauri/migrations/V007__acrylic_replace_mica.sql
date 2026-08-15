-- V007__acrylic_replace_mica.sql - Beta9 任务17：Mica 替换为 Acrylic
-- 1. 删除旧 key theme.mica_enabled（已弃用）
-- 2. 插入新 key theme.acrylic_enabled（默认开启，低性能机器可关闭）
-- 注意：原 mica_enabled 默认 false，新 acrylic_enabled 默认 true，不沿用旧值

DELETE FROM settings WHERE key = 'theme.mica_enabled';

INSERT OR IGNORE INTO settings (key, value, value_type) VALUES
    ('theme.acrylic_enabled', 'true', 'bool');
