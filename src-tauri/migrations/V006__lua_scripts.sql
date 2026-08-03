-- V006__lua_scripts.sql - Phase 5 Lua 脚本市场已安装脚本持久化
-- 记录从 GitHub 市场安装的 Lua 脚本元数据，脚本文件本体存于 <安装目录>/data/scripts/

CREATE TABLE lua_scripts (
    script_id     TEXT PRIMARY KEY,            -- 脚本 ID（与文件名一致，如 hello-world）
    name          TEXT NOT NULL,               -- 显示名称
    author        TEXT NOT NULL DEFAULT '',    -- 作者
    version       TEXT NOT NULL DEFAULT '1.0.0',-- 语义化版本
    description   TEXT NOT NULL DEFAULT '',    -- 描述
    permissions   TEXT NOT NULL DEFAULT '[]',  -- 权限声明 JSON 数组（如 ["io","os.execute"]）
    params_schema TEXT NOT NULL DEFAULT '[]',  -- 参数定义 JSON 数组（动态生成表单）
    installed_at  TEXT NOT NULL,               -- 安装时间 ISO8601
    updated_at    TEXT NOT NULL,               -- 更新时间 ISO8601
    source_url    TEXT NOT NULL DEFAULT '',    -- 市场来源 URL（raw.githubusercontent）
    content_hash  TEXT NOT NULL DEFAULT ''     -- 脚本内容 SHA256（用于更新检测）
);
