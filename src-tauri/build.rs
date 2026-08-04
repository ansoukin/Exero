fn main() {
    // 注入构建日期（编译期 env!，格式 YYYY-MM-DD）
    // 若已由 CI 环境变量提供则优先使用，否则使用本地当前日期
    if std::env::var("BUILD_DATE").is_err() {
        let now = chrono::Local::now().format("%Y-%m-%d").to_string();
        println!("cargo:rustc-env=BUILD_DATE={}", now);
    }
    tauri_build::build()
}
