-- counter.lua
-- Phase 5 示例脚本：变量系统演示
--
-- 演示：
--   1. exero.get_var(name, global?) 读取变量（默认局部，global=true 读全局）
--   2. exero.set_var(name, value, global?) 写入变量
--   3. 跨动作链共享的全局变量（同一 flow 内多次执行本脚本，计数累加）
--
-- 严格沙箱下可正常运行。
-- 使用全局变量 "counter" 保存累计值，跨动作链持久存在。

local increment = tonumber(args.increment) or 1
local reset = args.reset == true

if reset then
    -- 重置计数器
    exero.set_var("counter", 0, true)
    exero.log("计数器已重置为 0")
    exero.set_result({
        counter = 0,
        reset = true,
    })
    return
end

-- 读取当前计数值（全局变量，初始为 0）
local current = exero.get_var("counter", true) or 0
if type(current) ~= "number" then
    current = tonumber(current) or 0
end

local new_value = current + increment

-- 写回全局变量
exero.set_var("counter", new_value, true)

exero.log(string.format("计数器: %d + %d = %d", current, increment, new_value))
exero.notify("info", "计数器更新", string.format("当前值：%d", new_value))

exero.set_result({
    counter = new_value,
    previous = current,
    increment = increment,
})
