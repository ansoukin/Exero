-- system-info.lua
-- Phase 5 示例脚本：os 库演示（严格沙箱下 os.date / os.time 可用）
--
-- 演示：
--   1. os.time() 获取 Unix 时间戳
--   2. os.date() 格式化时间
--   3. select 类型参数（args.format: "short" | "full"）
--
-- 严格沙箱禁用了 os.execute / os.exit / os.remove / os.getenv 等危险 API，
-- 但 os.date / os.time / os.clock 属于安全 API，保留可用。

local format = args.format or "short"

local now = os.time()
local formatted
if format == "full" then
    -- 完整格式：2026-08-03 14:25:30 周一
    local weekday = os.date("%A", now) -- 英文星期
    formatted = string.format("%s (%s)", os.date("%Y-%m-%d %H:%M:%S", now), weekday)
else
    -- 简短格式：14:25:30
    formatted = os.date("%H:%M:%S", now)
end

exero.log(string.format("系统时间：%s（Unix 时间戳：%d）", formatted, now))

-- 使用 os.clock 获取 Lua 解释器 CPU 时间（演示用）
local cpu_time = os.clock()

exero.set_result({
    timestamp = now,
    formatted = formatted,
    format = format,
    lua_cpu_time = cpu_time,
})
