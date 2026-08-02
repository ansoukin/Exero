-- V003__courses.sql - 课程与课表数据模型（SPEC V2 2.2 节）
-- 5 张表：semesters / class_periods / weekly_templates / courses / schedule_overrides
-- 字段名严格按 SPEC V2 定义，与旧版差异：
--   semesters.week_count（非 total_weeks）
--   class_periods.name（非 label）
--   courses.subject（非 subject_name）, room（非 location）
--   schedule_overrides.type（非 override_type）, target_*（非 new_*）

-- ============================================================
-- 学期表
-- ============================================================
CREATE TABLE semesters (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,                       -- 如 "2025-2026 第一学期"
    start_date TEXT NOT NULL,                 -- 学期开始日期 ISO "2026-09-01"
    end_date TEXT NOT NULL,                   -- 学期结束日期 ISO "2027-01-20"
    week_count INTEGER NOT NULL,              -- 总周数（SPEC V2）
    is_active INTEGER NOT NULL DEFAULT 0,     -- 0=false, 1=true（当前激活学期）
    created_at TEXT NOT NULL,                 -- ISO 8601 时间戳
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_semesters_active ON semesters(is_active);

-- ============================================================
-- 节次定义表（格点模式基础：第 N 节的时间段）
-- 按学期可配置：不同学期可有不同作息时间
-- ============================================================
CREATE TABLE class_periods (
    id TEXT PRIMARY KEY NOT NULL,
    semester_id TEXT NOT NULL,
    period_index INTEGER NOT NULL,            -- 第几节（1, 2, 3...）
    start_time TEXT NOT NULL,                 -- "08:00"
    end_time TEXT NOT NULL,                   -- "08:45"
    name TEXT,                                -- 可选名称如 "早读"/"晚自习"（SPEC V2）
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
    UNIQUE(semester_id, period_index)
);

CREATE INDEX idx_periods_semester ON class_periods(semester_id);

-- ============================================================
-- 周课表模板表（SPEC V2：普通周/特殊周）
-- 普通周不需要记录（courses.template_id = NULL 即代表普通周）
-- 此表只存特殊周模板（考试周/活动周等），可被多个周次复用
-- ============================================================
CREATE TABLE weekly_templates (
    id TEXT PRIMARY KEY NOT NULL,
    semester_id TEXT NOT NULL,
    name TEXT NOT NULL,                       -- 如 "期中考试周"/"活动周"
    description TEXT,                         -- 可选描述
    color TEXT,                               -- 颜色标识（hex，用于 UI 区分）
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
);

CREATE INDEX idx_templates_semester ON weekly_templates(semester_id);

-- ============================================================
-- 课程条目表（课表的每一格课程）
-- template_id 关联周模板（NULL = 普通周默认模板）
-- 同时存 period_index（节次定位）和 start_time/end_time（精确时间定位），拖拽时互斥更新
-- ============================================================
CREATE TABLE courses (
    id TEXT PRIMARY KEY NOT NULL,
    semester_id TEXT NOT NULL,
    template_id TEXT,                         -- 关联周模板（NULL = 普通周默认模板）
    subject TEXT NOT NULL,                    -- 科目名 "数学"（SPEC V2）
    day_of_week INTEGER NOT NULL,             -- 0=周日, 1=周一 ... 6=周六
    period_index INTEGER,                     -- 格点模式：第几节（自由模式为 NULL）
    start_time TEXT,                          -- 自由模式："14:30"（格点模式由 period_index 决定）
    end_time TEXT,                            -- 自由模式结束时间
    week_pattern TEXT NOT NULL DEFAULT 'all', -- 周次模式: "all"/"odd"/"even"/"1,3,5,7"
    room TEXT,                                -- 教室地点（SPEC V2）
    teacher TEXT,                             -- 教师
    color TEXT,                               -- 颜色标识（hex）
    flow_id TEXT,                             -- 关联快捷指令（课前/课中/课后触发，可空）
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES weekly_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (flow_id) REFERENCES automation_flows(id) ON DELETE SET NULL
);

CREATE INDEX idx_courses_semester ON courses(semester_id);
CREATE INDEX idx_courses_day ON courses(semester_id, day_of_week);
CREATE INDEX idx_courses_template ON courses(template_id);
CREATE INDEX idx_courses_flow ON courses(flow_id);

-- ============================================================
-- 临时调课记录表（某天的临时调整，不修改常规课表）
-- SPEC V2：type(cancel/move/add), target_period_index, target_start_time, target_end_time
-- ============================================================
CREATE TABLE schedule_overrides (
    id TEXT PRIMARY KEY NOT NULL,
    semester_id TEXT NOT NULL,
    date TEXT NOT NULL,                       -- 生效日期 ISO "2026-07-22"
    type TEXT NOT NULL,                       -- "cancel" 取消 / "move" 调整 / "add" 新增（SPEC V2）
    course_id TEXT,                           -- 原课程 ID（NULL 表示新增临时课程）
    target_period_index INTEGER,              -- 调整后节次（move 时）
    target_start_time TEXT,                   -- 调整后开始时间（自由模式 move 时）
    target_end_time TEXT,                     -- 调整后结束时间（自由模式 move 时）
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_overrides_date ON schedule_overrides(semester_id, date);
CREATE INDEX idx_overrides_course ON schedule_overrides(course_id);
