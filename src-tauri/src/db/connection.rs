//! 数据库连接管理
//!
//! 基于 rusqlite 提供 SQLite 连接，使用 Mutex 保护并发访问。
//! 数据库文件位于 `<可执行文件目录>/data/exero.db`，符合便携式部署需求。

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::{AppError, Result};

/// 数据库连接封装
///
/// 使用 `std::sync::Mutex` 保护底层 `rusqlite::Connection`，
/// 支持多线程安全访问。注意：SQLite 单连接并发能力有限，
/// 长事务会阻塞其他线程，业务层应保持事务短小。
pub struct Database {
    connection: Mutex<Connection>,
    db_path: PathBuf,
}

impl Database {
    /// 打开（或创建）数据库
    ///
    /// - `db_path`: 数据库文件路径。父目录不存在时会自动创建。
    pub fn open(db_path: impl AsRef<Path>) -> Result<Self> {
        let db_path = db_path.as_ref().to_path_buf();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        tracing::info!("打开数据库: {}", db_path.display());

        let conn = Connection::open(&db_path)?;

        // 启用外键约束
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        // 启用 WAL 模式（提高并发读写性能）
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;
        // 设置忙等待（毫秒），避免立即返回 SQLITE_BUSY
        conn.busy_timeout(std::time::Duration::from_secs(5))?;

        tracing::info!("数据库已打开，WAL 模式已启用");

        Ok(Self {
            connection: Mutex::new(conn),
            db_path,
        })
    }

    /// 在便携式部署目录下打开默认数据库
    ///
    /// 路径：`<可执行文件目录>/data/exero.db`
    pub fn open_default() -> Result<Self> {
        let path = Self::default_db_path()?;
        Self::open(path)
    }

    /// 获取默认数据库路径
    pub fn default_db_path() -> Result<PathBuf> {
        let exe_dir = std::env::current_exe()?
            .parent()
            .ok_or_else(|| AppError::Other("无法获取可执行文件目录".into()))?
            .to_path_buf();
        Ok(exe_dir.join("data").join("exero.db"))
    }

    /// 获取数据库文件路径
    pub fn path(&self) -> &Path {
        &self.db_path
    }

    /// 获取受锁保护的连接（仅在闭包内使用）
    ///
    /// # 用法
    /// ```
    /// db.with_conn(|conn| {
    ///     conn.execute("...", params![])?;
    ///     Ok(())
    /// })?;
    /// ```
    pub fn with_conn<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T>,
    {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Other("数据库锁中毒".into()))?;
        f(&conn)
    }

    /// 在事务中执行（自动 commit/rollback）
    pub fn with_transaction<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&rusqlite::Transaction<'_>) -> Result<T>,
    {
        let mut conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Other("数据库锁中毒".into()))?;
        let tx = conn.transaction()?;
        let result = f(&tx)?;
        tx.commit()?;
        Ok(result)
    }

    /// 以可变引用形式获取连接（用于需要 &mut Connection 的 API，如 refinery 迁移）
    ///
    /// # 用法
    /// ```
    /// db.with_conn_mut(|conn| {
    ///     migrations::runner().run(conn).map_err(AppError::from)
    /// })?;
    /// ```
    pub fn with_conn_mut<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut Connection) -> Result<T>,
    {
        let mut conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Other("数据库锁中毒".into()))?;
        f(&mut conn)
    }

    /// 启动时备份数据库
    ///
    /// 使用 SQLite Online Backup API，在不停服的情况下备份到 `backup/exero_YYYYMMDD.db`。
    /// 保留最近 3 份，超出自动删除。
    pub fn backup_on_startup(&self) -> Result<()> {
        let backup_dir = self
            .db_path
            .parent()
            .ok_or_else(|| AppError::Other("无法获取数据库父目录".into()))?
            .join("backup");
        std::fs::create_dir_all(&backup_dir)?;

        let date = chrono::Local::now().format("%Y%m%d");
        let backup_path = backup_dir.join(format!("exero_{}.db", date));

        if backup_path.exists() {
            tracing::info!("今日已备份，跳过: {}", backup_path.display());
            return Ok(());
        }

        tracing::info!("启动备份: {}", backup_path.display());

        let mut backup_conn = Connection::open(&backup_path)?;
        {
            let conn = self
                .connection
                .lock()
                .map_err(|_| AppError::Other("数据库锁中毒".into()))?;
            // 使用 rusqlite::backup API（需要 backup feature）
            let backup = rusqlite::backup::Backup::new(&*conn, &mut backup_conn)?;
            backup.run_to_completion(100, std::time::Duration::from_millis(50), None)?;
        }

        // 清理超过 3 份的旧备份
        Self::cleanup_old_backups(&backup_dir, 3)?;

        tracing::info!("备份完成");
        Ok(())
    }

    /// 清理旧备份，仅保留最近 N 份
    fn cleanup_old_backups(backup_dir: &Path, keep: usize) -> Result<()> {
        let mut backups: Vec<_> = std::fs::read_dir(backup_dir)?
            .filter_map(|entry| entry.ok())
            .filter(|e| {
                e.file_name()
                    .to_str()
                    .map(|n| n.starts_with("exero_") && n.ends_with(".db"))
                    .unwrap_or(false)
            })
            .collect();

        // 按文件名降序排序（最新的在前）
        backups.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

        for old in backups.into_iter().skip(keep) {
            if let Err(e) = std::fs::remove_file(old.path()) {
                tracing::warn!("删除旧备份失败 {}: {}", old.path().display(), e);
            } else {
                tracing::info!("已删除旧备份: {}", old.path().display());
            }
        }

        Ok(())
    }
}
