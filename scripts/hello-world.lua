-- hello-world.lua
-- Phase 5 示例脚本：最简入门
--
-- 演示：
--   1. 通过 args.<name> 读取动态参数
--   2. exero.log 写日志
--   3. exero.notify 发送应用内通知
--   4. exero.set_result 设置脚本返回值（写入动作链 output）
--
-- 严格沙箱下可正常运行（未使用任何被禁用 API）。

local name = args.name or "World"
local greeting = string.format("Hello, %s!", name)

-- 写日志（可在日志页查看）
exero.log(greeting)

-- 发送应用内通知（level: info / warn / error）
exero.notify("info", "Exero Lua", greeting)

-- 设置返回值，后续动作可通过 ctx.output 访问
exero.set_result({
    greeting = greeting,
    timestamp = os.time(),
})
