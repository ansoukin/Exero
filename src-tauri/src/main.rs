// 桌面自动化助手 Exero - Windows 主入口
// 在 Windows 上禁用控制台窗口（不影响日志输出到文件）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    exero_lib::run()
}
