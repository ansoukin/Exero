import { useEffect, useState, useCallback, useRef } from "react";
import { CalendarDays, AlertCircle, Loader2, CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  semesterCommands,
  classPeriodCommands,
  courseCommands,
  overrideCommands,
  weeklyTemplateCommands,
  type Semester,
  type ClassPeriod,
  type Course,
  type ScheduleOverride,
  type WeeklyTemplate,
} from "@/lib/tauri";
import { useTimelineStore } from "@/stores/timeline";
import { useOnboardingStore } from "@/stores/onboarding";
import { TimelineToolbar } from "./timeline/TimelineToolbar";
import { WeekView } from "./timeline/WeekView";
import { MonthView } from "./timeline/MonthView";
import { YearView } from "./timeline/YearView";
import { DayView } from "./timeline/DayView";
import type { DropTarget } from "./timeline/TimelineDndContext";
import { CourseFormDialog } from "./timeline/CourseFormDialog";
import { CourseActionMenu, type CourseActionMenuPosition } from "./timeline/CourseActionMenu";
import { OverrideDialog } from "./timeline/OverrideDialog";
import { WeeklyTemplateDialog } from "./timeline/WeeklyTemplateDialog";
import { todayIso } from "./timeline/utils";
import type { LongPressPosition } from "./timeline/useLongPress";

/**
 * 时间轴页面（SPEC V2 3.5 页面 2）
 *
 * 三视图：周 / 月 / 年（三级递进）
 * 周视图：整块拖动改位置 + 底边 resize 手柄改时长
 * 长按 500ms / 右键弹出操作菜单（双通道）
 * 临时调课（不修改常规课表）
 * 学期制多周课表 + 周模板（普通周/特殊周）
 */
export default function TimelinePage() {
  const view = useTimelineStore((s) => s.view);
  const activeSemesterId = useTimelineStore((s) => s.activeSemesterId);
  const setActiveSemester = useTimelineStore((s) => s.setActiveSemester);
  const activeTemplateId = useTimelineStore((s) => s.activeTemplateId);
  const setActiveTemplate = useTimelineStore((s) => s.setActiveTemplate);
  const openOnboarding = useOnboardingStore((s) => s.open);
  const onboardingOpen = useOnboardingStore((s) => s.isOpen);
  const prevOnboardingOpen = useRef(false);

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [templates, setTemplates] = useState<WeeklyTemplate[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 周模板管理对话框
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // 对话框 / 菜单状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formDefaultDay, setFormDefaultDay] = useState<number>(1);
  const [formDefaultPeriod, setFormDefaultPeriod] = useState<number | null>(null);

  const [menuPosition, setMenuPosition] = useState<CourseActionMenuPosition | null>(null);
  const [menuCourse, setMenuCourse] = useState<Course | null>(null);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideCourse, setOverrideCourse] = useState<Course | null>(null);

  // 加载学期列表 + 激活学期
  const loadSemesters = useCallback(async () => {
    setSemestersLoading(true);
    setError(null);
    try {
      const list = await semesterCommands.list();
      setSemesters(list);
      // 若 store 中无选中学期，优先取 is_active 或第一个
      if (!activeSemesterId && list.length > 0) {
        const active = list.find((s) => s.is_active) ?? list[0];
        setActiveSemester(active.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSemestersLoading(false);
    }
  }, [activeSemesterId, setActiveSemester]);

  // 加载学期相关数据（节次/课程/调课/周模板）
  const loadSemesterData = useCallback(async (semesterId: string) => {
    setDataLoading(true);
    setError(null);
    try {
      const [periodsData, coursesData, overridesData, templatesData] = await Promise.all([
        classPeriodCommands.list(semesterId),
        courseCommands.list(semesterId),
        overrideCommands.list(semesterId),
        weeklyTemplateCommands.list(semesterId),
      ]);
      setPeriods(periodsData);
      setCourses(coursesData);
      setOverrides(overridesData);
      setTemplates(templatesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  // 向导从打开→关闭时刷新学期列表（完成/跳过/加载演示后立即同步空状态）
  useEffect(() => {
    if (prevOnboardingOpen.current && !onboardingOpen) {
      loadSemesters();
    }
    prevOnboardingOpen.current = onboardingOpen;
  }, [onboardingOpen, loadSemesters]);

  useEffect(() => {
    if (activeSemesterId) {
      loadSemesterData(activeSemesterId);
    } else {
      // 无选中学期时清空数据
      setPeriods([]);
      setCourses([]);
      setOverrides([]);
      setTemplates([]);
    }
  }, [activeSemesterId, loadSemesterData]);

  const activeSemester = semesters.find((s) => s.id === activeSemesterId);
  const totalWeeks = activeSemester?.week_count ?? 1;

  function handleRefresh() {
    loadSemesters();
    if (activeSemesterId) loadSemesterData(activeSemesterId);
  }

  // 点击课程 → 打开编辑表单
  const handleCourseClick = useCallback((course: Course) => {
    setEditingCourse(course);
    setFormDefaultDay(course.day_of_week);
    setFormDefaultPeriod(course.period_index);
    setFormOpen(true);
  }, []);

  // 点击空格 → 打开新建表单
  const handleCellClick = useCallback(
    (dayOfWeek: number, periodIndex: number | null) => {
      setEditingCourse(null);
      setFormDefaultDay(dayOfWeek);
      setFormDefaultPeriod(periodIndex);
      setFormOpen(true);
    },
    []
  );

  // 长按/右键课程 → 弹出操作菜单（触屏长按 500ms，鼠标右键即时）
  const handleCourseLongPress = useCallback(
    (course: Course, pos: LongPressPosition) => {
      setMenuPosition({ x: pos.x, y: pos.y });
      setMenuCourse(course);
    },
    []
  );

  // 表单保存成功 → 刷新数据
  const handleFormSaved = useCallback(() => {
    if (activeSemesterId) loadSemesterData(activeSemesterId);
  }, [activeSemesterId, loadSemesterData]);

  // 菜单动作：编辑
  const handleMenuEdit = useCallback(
    (course: Course) => {
      setEditingCourse(course);
      setFormDefaultDay(course.day_of_week);
      setFormDefaultPeriod(course.period_index);
      setFormOpen(true);
    },
    []
  );

  // 菜单动作：复制（打开新建表单，预填原课程数据）
  const handleMenuDuplicate = useCallback(
    (course: Course) => {
      // 复制：新建一个相同属性的课程，用表单预填
      const duplicated: Course = {
        ...course,
        id: "", // 空 ID 表示新建
      };
      setEditingCourse(duplicated);
      setFormDefaultDay(course.day_of_week);
      setFormDefaultPeriod(course.period_index);
      setFormOpen(true);
    },
    []
  );

  // 菜单动作：临时取消当天（二级菜单直接触发，直接创建 cancel override）
  const handleMenuCancelOccurrence = useCallback(
    async (course: Course) => {
      if (!activeSemesterId) return;
      if (!confirm(`确定取消「${course.subject}」当天课程？`)) return;
      try {
        await overrideCommands.create({
          semester_id: activeSemesterId,
          date: todayIso(),
          course_id: course.id,
          type: "cancel",
          target_period_index: null,
          target_start_time: null,
          target_end_time: null,
          note: null,
        });
        await loadSemesterData(activeSemesterId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeSemesterId, loadSemesterData]
  );

  // 菜单动作：临时换时间（二级菜单触发，打开对话框）
  const handleMenuMoveOccurrence = useCallback(
    (course: Course) => {
      setOverrideCourse(course);
      setOverrideOpen(true);
    },
    []
  );

  // 菜单动作：永久删除
  const handleMenuDelete = useCallback(
    async (course: Course) => {
      if (!confirm(`确定永久删除「${course.subject}」？此操作不可撤销。`)) return;
      try {
        await courseCommands.delete(course.id);
        if (activeSemesterId) await loadSemesterData(activeSemesterId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeSemesterId, loadSemesterData]
  );

  // 调课保存成功 → 刷新数据
  const handleOverrideSaved = useCallback(() => {
    if (activeSemesterId) loadSemesterData(activeSemesterId);
  }, [activeSemesterId, loadSemesterData]);

  /**
   * 拖拽移动课程（SPEC 3.5：拖拽编辑）
   *
   * 格点模式：更新 day_of_week + period_index，清空 start/end_time
   * 自由模式：更新 day_of_week + start/end_time，清空 period_index
   */
  const handleMoveCourse = useCallback(
    async (course: Course, target: DropTarget) => {
      try {
        if (target.periodIndex !== null && target.periodIndex !== undefined) {
          // 格点模式 drop
          await courseCommands.update(course.id, {
            day_of_week: target.dayOfWeek,
            period_index: target.periodIndex,
            start_time: null,
            end_time: null,
          });
        } else if (target.startTime && target.endTime) {
          // 自由模式 drop（带明确时间）
          await courseCommands.update(course.id, {
            day_of_week: target.dayOfWeek,
            period_index: null,
            start_time: target.startTime,
            end_time: target.endTime,
          });
        } else {
          // 自由模式 drop 到列（无明确时间，保留原时长，仅换日）
          const origStart = course.start_time || "08:00";
          const origEnd = course.end_time || "08:45";
          await courseCommands.update(course.id, {
            day_of_week: target.dayOfWeek,
            period_index: null,
            start_time: origStart,
            end_time: origEnd,
          });
        }
        // 刷新数据
        if (activeSemesterId) await loadSemesterData(activeSemesterId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeSemesterId, loadSemesterData]
  );

  /**
   * 自由模式 resize：调整课程结束时间
   */
  const handleResizeCourse = useCallback(
    async (course: Course, newEndTime: string) => {
      try {
        await courseCommands.update(course.id, {
          end_time: newEndTime,
        });
        if (activeSemesterId) await loadSemesterData(activeSemesterId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeSemesterId, loadSemesterData]
  );

  function renderView() {
    if (!activeSemester) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
          {/* 空状态（SPEC 11.2：日历图标 + 虚线边框占位） */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
            <CalendarDays className="h-10 w-10 opacity-40" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-medium text-foreground">
              {semestersLoading ? "加载学期中..." : "还没有学期数据"}
            </p>
            <p className="text-sm">
              创建学期后即可开始排课，或加载示例数据体验
            </p>
          </div>
          {!semestersLoading && (
            <Button
              onClick={() => openOnboarding(1)}
              className="mt-2 gap-2"
              size="lg"
            >
              <CalendarPlus className="h-4 w-4" />
              创建学期
            </Button>
          )}
        </div>
      );
    }

    if (dataLoading) {
      return (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载课程数据...
        </div>
      );
    }

    switch (view) {
      case "day":
        return (
          <DayView
            semesterId={activeSemester.id}
            semesterStart={activeSemester.start_date}
            courses={courses}
            periods={periods}
            overrides={overrides}
            onCourseClick={handleCourseClick}
            onCourseLongPress={handleCourseLongPress}
            onCellClick={handleCellClick}
            onMoveCourse={handleMoveCourse}
            onResizeCourse={handleResizeCourse}
          />
        );
      case "week":
        return (
          <WeekView
            semesterId={activeSemester.id}
            semesterStart={activeSemester.start_date}
            courses={courses}
            periods={periods}
            overrides={overrides}
            onCourseClick={handleCourseClick}
            onCourseLongPress={handleCourseLongPress}
            onCellClick={handleCellClick}
          />
        );
      case "month":
        return (
          <MonthView
            semesterId={activeSemester.id}
            semesterStart={activeSemester.start_date}
            totalWeeks={totalWeeks}
            courses={courses}
            periods={periods}
            overrides={overrides}
            onCourseClick={handleCourseClick}
            onCourseLongPress={handleCourseLongPress}
          />
        );
      case "year":
        return (
          <YearView
            semesterStart={activeSemester.start_date}
            semesterEnd={activeSemester.end_date}
            courses={courses}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 页面标题栏 */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">时间轴</h1>
            <p className="text-xs text-muted-foreground">
              日 / 周 / 月 / 年四视图 · 拖拽编辑 · 多周课表
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-9">
          刷新
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/5 px-6 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">数据加载失败：{error}</span>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            重试
          </Button>
        </div>
      )}

      {/* 工具栏（视图/学期/周模板/周次切换） */}
      <TimelineToolbar
        semesters={semesters}
        semestersLoading={semestersLoading}
        totalWeeks={totalWeeks}
        templates={templates}
        onSemesterChange={(id) => loadSemesterData(id)}
        onOpenTemplateDialog={() => setTemplateDialogOpen(true)}
      />

      {/* 视图主体 */}
      {renderView()}

      {/* 课程新建/编辑表单 */}
      <CourseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        course={editingCourse && editingCourse.id ? editingCourse : null}
        semesterId={activeSemesterId ?? ""}
        periods={periods}
        defaultDayOfWeek={formDefaultDay}
        defaultPeriodIndex={formDefaultPeriod}
        onSaved={handleFormSaved}
      />

      {/* 长按操作菜单 */}
      <CourseActionMenu
        position={menuPosition}
        course={menuCourse}
        onClose={() => {
          setMenuPosition(null);
          setMenuCourse(null);
        }}
        onEdit={handleMenuEdit}
        onDuplicate={handleMenuDuplicate}
        onCancelOccurrence={handleMenuCancelOccurrence}
        onMoveOccurrence={handleMenuMoveOccurrence}
        onDelete={handleMenuDelete}
      />

      {/* 临时调课对话框 */}
      <OverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        course={overrideCourse}
        semesterId={activeSemesterId ?? ""}
        periods={periods}
        defaultDate={todayIso()}
        onSaved={handleOverrideSaved}
      />

      {/* 周模板管理对话框（SPEC V2：普通周/特殊周切换） */}
      <WeeklyTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        semesterId={activeSemesterId ?? ""}
        templates={templates}
        activeTemplateId={activeTemplateId}
        onSelect={setActiveTemplate}
        onSaved={() => activeSemesterId && loadSemesterData(activeSemesterId)}
      />
    </div>
  );
}
