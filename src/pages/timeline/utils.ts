/**
 * 时间轴工具函数
 *
 * 包含星期计算、周次判定、时间格式化、周次模式匹配等纯函数。
 * 所有函数无副作用，便于单元测试。
 */

/** 星期中文标签（索引 0=周日 ... 6=周六） */
export const WEEKDAY_LABELS = [
  "周日",
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
] as const;

/** 星期短标签（用于周视图表头，索引 = getDay() 返回值 0=周日） */
export const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** 周一为首的星期短标签（月视图表头用，按周一到周日排列） */
export const WEEKDAY_SHORT_MON_FIRST = ["一", "二", "三", "四", "五", "六", "日"] as const;

/**
 * 从 ISO 日期字符串获取星期几（0=周日 ... 6=周六）
 *
 * 注意：直接用 new Date() 解析 "2026-07-22" 会被当作 UTC，
 * 在东八区会得到比预期早 8 小时的时刻，但 getDay() 取本地时区星期，
 * 对纯日期字符串需显式补时间避免边界错误。
 */
export function getWeekday(isoDate: string): number {
  // 补 T00:00:00 确保按本地时区解析
  const d = new Date(isoDate + "T00:00:00");
  return d.getDay();
}

/** 获取今天是星期几（0=周日 ... 6=周六） */
export function todayWeekday(): number {
  return new Date().getDay();
}

/**
 * 计算指定 ISO 日期在学期中的周次（1-based）
 *
 * 通过学期开始日期推算：周次 = floor((date - start_date) / 7) + 1
 * 若日期早于学期开始，返回 1；若超出学期，返回 totalWeeks。
 */
export function weekOfDate(
  isoDate: string,
  semesterStart: string,
  totalWeeks: number
): number {
  const start = new Date(semesterStart + "T00:00:00");
  const date = new Date(isoDate + "T00:00:00");
  const diffMs = date.getTime() - start.getTime();
  if (diffMs < 0) return 1;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return Math.max(1, Math.min(totalWeeks, week));
}

/**
 * 获取某周次的起始日期（周日为周首日，ISO 日期）
 *
 * SPEC 未明确周首日，国内课表惯用周一为首。
 * 此处采用周一为首：周次起始 = 学期开始所在周的周一。
 */
export function weekStartDate(
  semesterStart: string,
  week: number
): string {
  const start = new Date(semesterStart + "T00:00:00");
  const startDay = start.getDay(); // 0=周日
  // 回退到本周周一（周日 0 → -1 天，周一 1 → 0 天，周二 2 → -1 天...）
  const offsetToMonday = startDay === 0 ? -6 : 1 - startDay;
  const monday = new Date(start);
  monday.setDate(start.getDate() + offsetToMonday + (week - 1) * 7);
  return toIsoDate(monday);
}

/** 获取某周次的所有 7 天日期（周一到周日，ISO 日期数组） */
export function weekDates(semesterStart: string, week: number): string[] {
  const monday = weekStartDate(semesterStart, week);
  const mondayDate = new Date(monday + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    return toIsoDate(d);
  });
}

/** Date → ISO 日期 "YYYY-MM-DD"（本地时区） */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 今日 ISO 日期 */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/**
 * 判断课程在指定周次是否上课
 *
 * week_pattern 取值：
 * - "all"：每周都上
 * - "odd"：单周（奇数周）
 * - "even"：双周（偶数周）
 * - "1,3,5"：逗号分隔的周次列表
 */
export function isCourseInWeek(weekPattern: string, week: number): boolean {
  const pattern = weekPattern.trim().toLowerCase();
  if (pattern === "all" || pattern === "") return true;
  if (pattern === "odd") return week % 2 === 1;
  if (pattern === "even") return week % 2 === 0;
  // 逗号分隔的周次列表
  const weeks = pattern.split(",").map((s) => parseInt(s.trim(), 10));
  return weeks.includes(week);
}

/**
 * 格式化时间段显示
 *
 * @param start "08:00"
 * @param end "08:45"
 * @returns "08:00 - 08:45"
 */
export function formatTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

/** 月份中文标签 */
export const MONTH_LABELS = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
] as const;

/**
 * 获取指定月份的日历网格（含前后月填充，共 42 天 = 6 周）
 *
 * SPEC V2：周首日为周一（国内课表惯例），网格从该月第一天所在周的周一开始。
 *
 * @param year 年
 * @param month 月（0-based）
 * @returns ISO 日期数组（从周一开始，共 42 天）
 */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const firstDay = first.getDay(); // 0=周日
  // 周一为首：周日(0) → 回退 6 天，周一(1) → 回退 0 天，周二(2) → 回退 1 天...
  const offsetToMonday = firstDay === 0 ? 6 : firstDay - 1;
  const startDate = new Date(first);
  startDate.setDate(first.getDate() - offsetToMonday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return toIsoDate(d);
  });
}

/**
 * 比较两个 ISO 日期是否同一天
 */
export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

/**
 * 判断 ISO 日期是否今日
 */
export function isToday(isoDate: string): boolean {
  return isoDate === todayIso();
}

// ============================================================
// 调课合并逻辑
// ============================================================

import type {
  Course,
  ScheduleOverride,
  ClassPeriod,
} from "@/lib/tauri";

/**
 * 展示用课程项（合并常规课程与临时调课后的结果）
 */
export interface DisplayCourse {
  /** 原始课程（move 后指向原课程，add 时为新建的临时课程对象） */
  course: Course;
  /** 实际开始时间（格点模式来自节次定义，自由模式来自 override 或 course.start_time） */
  startTime: string;
  /** 实际结束时间 */
  endTime: string;
  /** 实际节次（格点模式定位用，自由模式为 null） */
  periodIndex: number | null;
  /** 是否被取消（cancel override） */
  cancelled: boolean;
  /** 是否为临时新增/移动后的课程 */
  isOverride: boolean;
  /** 关联的调课记录（如有） */
  override?: ScheduleOverride;
}

/**
 * 计算指定日期的最终展示课程列表
 *
 * 合并规则：
 * 1. 取该星期的所有常规课程（按 week_pattern 过滤当前周次）
 * 2. 应用该日期的 cancel override → 标记为取消
 * 3. 应用该日期的 move override → 原位置取消，按 target_period_index/target_start_time 生成临时显示项
 * 4. 应用该日期的 add override → 直接生成临时显示项
 *
 * @param courses 学期所有常规课程
 * @param overrides 该日期的调课记录
 * @param periods 节次定义（用于解析格点模式的时间段）
 * @param dayOfWeek 该日期的星期几（0=周日）
 * @param week 当前周次（用于 week_pattern 过滤）
 * @returns 展示用课程项列表
 */
export function resolveDayCourses(
  courses: Course[],
  overrides: ScheduleOverride[],
  periods: ClassPeriod[],
  dayOfWeek: number,
  week: number
): DisplayCourse[] {
  // 1. 过滤当天常规课程（按星期 + 周次模式）
  const dayCourses = courses.filter(
    (c) => c.day_of_week === dayOfWeek && isCourseInWeek(c.week_pattern, week)
  );

  // 2. 构建 override 索引：course_id → override
  const cancelSet = new Set<string>();
  const moveMap = new Map<string, ScheduleOverride>();
  const addOverrides: ScheduleOverride[] = [];
  for (const ov of overrides) {
    if (ov.type === "cancel" && ov.course_id) {
      cancelSet.add(ov.course_id);
    } else if (ov.type === "move" && ov.course_id) {
      moveMap.set(ov.course_id, ov);
    } else if (ov.type === "add") {
      addOverrides.push(ov);
    }
  }

  // 3. 解析节次时间查找函数
  const findPeriod = (idx: number | null): ClassPeriod | undefined =>
    idx === null ? undefined : periods.find((p) => p.period_index === idx);

  // 4. 生成展示项
  const result: DisplayCourse[] = [];

  for (const course of dayCourses) {
    const isCancelled = cancelSet.has(course.id);
    const moveOv = moveMap.get(course.id);

    if (moveOv) {
      // move：原课程被移动到新位置
      // 原位置标记为取消
      result.push({
        course,
        startTime: getCourseStartTime(course, periods),
        endTime: getCourseEndTime(course, periods),
        periodIndex: course.period_index,
        cancelled: true,
        isOverride: false,
      });

      // 新位置生成临时显示项
      const newPeriod = findPeriod(moveOv.target_period_index);
      result.push({
        course,
        startTime:
          moveOv.target_start_time ?? newPeriod?.start_time ?? "00:00",
        endTime: moveOv.target_end_time ?? newPeriod?.end_time ?? "00:00",
        periodIndex: moveOv.target_period_index ?? null,
        cancelled: false,
        isOverride: true,
        override: moveOv,
      });
    } else {
      // 正常或取消
      result.push({
        course,
        startTime: getCourseStartTime(course, periods),
        endTime: getCourseEndTime(course, periods),
        periodIndex: course.period_index,
        cancelled: isCancelled,
        isOverride: false,
      });
    }
  }

  // 5. 新增 add override（构造临时 Course 对象）
  for (const ov of addOverrides) {
    const newPeriod = findPeriod(ov.target_period_index);
    const tempCourse: Course = {
      id: `override-${ov.id}`,
      semester_id: ov.semester_id,
      template_id: null,
      subject: ov.note || "临时课程",
      day_of_week: dayOfWeek,
      period_index: ov.target_period_index,
      start_time: ov.target_start_time,
      end_time: ov.target_end_time,
      week_pattern: "all",
      room: null,
      teacher: null,
      color: null,
      flow_id: null,
      note: ov.note,
      created_at: ov.created_at,
      updated_at: ov.created_at,
    };
    result.push({
      course: tempCourse,
      startTime: ov.target_start_time ?? newPeriod?.start_time ?? "00:00",
      endTime: ov.target_end_time ?? newPeriod?.end_time ?? "00:00",
      periodIndex: ov.target_period_index ?? null,
      cancelled: false,
      isOverride: true,
      override: ov,
    });
  }

  return result;
}

/** 获取课程开始时间（格点模式从节次定义解析，自由模式用 start_time） */
function getCourseStartTime(course: Course, periods: ClassPeriod[]): string {
  if (course.start_time) return course.start_time;
  if (course.period_index !== null) {
    return periods.find((p) => p.period_index === course.period_index)?.start_time ?? "00:00";
  }
  return "00:00";
}

/** 获取课程结束时间 */
function getCourseEndTime(course: Course, periods: ClassPeriod[]): string {
  if (course.end_time) return course.end_time;
  if (course.period_index !== null) {
    return periods.find((p) => p.period_index === course.period_index)?.end_time ?? "00:00";
  }
  return "00:00";
}

/**
 * 将 "HH:MM" 转换为分钟数（用于自由模式时间轴定位）
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * 将分钟数转换为 "HH:MM"
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
