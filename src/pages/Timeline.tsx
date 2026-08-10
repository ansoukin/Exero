import { useEffect, useState, useCallback, useRef } from "react";
import { CalendarDays, AlertCircle, Loader2, CalendarPlus, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  semesterCommands,
  classPeriodCommands,
  courseCommands,
  overrideCommands,
  weeklyTemplateCommands,
  flowCommands,
  type Semester,
  type ClassPeriod,
  type Course,
  type ScheduleOverride,
  type WeeklyTemplate,
} from "@/lib/tauri";
import { useTimelineStore, type TimelineView } from "@/stores/timeline";
import { useOnboardingStore } from "@/stores/onboarding";
import { useAppStore } from "@/stores/app";
import { useOobeStore } from "@/stores/oobe";
import { useQuickActionsStore } from "@/stores/quickactions";
import { TimelineToolbar } from "./timeline/TimelineToolbar";
import { WeekView } from "./timeline/WeekView";
import { MonthView } from "./timeline/MonthView";
import { YearView } from "./timeline/YearView";
import { DayView } from "./timeline/DayView";
import { CourseFormDialog } from "./timeline/CourseFormDialog";
import { CourseActionMenu, type CourseActionMenuPosition } from "./timeline/CourseActionMenu";
import { OverrideDialog } from "./timeline/OverrideDialog";
import { WeeklyTemplateDialog } from "./timeline/WeeklyTemplateDialog";
import { todayIso } from "./timeline/utils";
import type { LongPressPosition } from "./timeline/useLongPress";
import { DailyTimelineView } from "./timeline/DailyTimelineView";
import { DailyWeekView } from "./timeline/DailyWeekView";
import { DailyMonthView } from "./timeline/DailyMonthView";
import { DailyYearView } from "./timeline/DailyYearView";
import { DailyActionMenu, type DailyActionMenuPosition } from "./timeline/DailyActionMenu";
import { useDailyTriggers } from "./timeline/useDailyTriggers";
import type { TriggerBlock } from "./timeline/dailyTypes";

/**
 * 时间轴页面（SPEC V2 3.5 页面 2）
 *
 * 校园模式：周/月/年三视图，学期制多周课表，可编辑课程块
 * 日常模式：只读显示快捷指令触发时间块（Phase 2 实现，当前显示占位空状态）
 *
 * 模式判断：从 oobe store 读取 appMode（OOBE 启动时已从 settings.app.mode 读取）
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
  const setPage = useAppStore((s) => s.setPage);
  const setView = useTimelineStore((s) => s.setView);
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  // 应用模式：从 oobe store 读取（OOBE 启动时已从 settings 读取并持久化到 store）
  const appMode = useOobeStore((s) => s.appMode);

  // 日常模式：数据加载（与日期无关，getBlocksForDate 按需解析）
  const {
    loading: dailyLoading,
    error: dailyError,
    refresh: dailyRefresh,
    getBlocksForDate,
  } = useDailyTriggers();
  const setEditingFlow = useQuickActionsStore((s) => s.setEditingFlow);

  // 日常模式：右键菜单状态
  const [dailyMenuPosition, setDailyMenuPosition] =
    useState<DailyActionMenuPosition | null>(null);
  const [dailyMenuBlock, setDailyMenuBlock] = useState<TriggerBlock | null>(
    null
  );

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

  // 日常模式：编辑快捷指令 → 跳转 QuickActions 页并选中 flow
  const handleEditFlow = useCallback(
    (block: TriggerBlock) => {
      setPage("quick-actions");
      // 延迟选中，等待页面切换完成
      setTimeout(() => setEditingFlow(block.flowId), 300);
    },
    [setPage, setEditingFlow]
  );

  // 日常模式：删除快捷指令 → 删除整个 flow（含触发器和动作）
  const handleDeleteFlow = useCallback(
    async (block: TriggerBlock) => {
      if (!confirm(`确定删除快捷指令「${block.flowName}」？此操作不可撤销。`)) return;
      try {
        await flowCommands.delete(block.flowId);
        dailyRefresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [dailyRefresh]
  );

  // 日常模式：右键触发块 → 弹出操作菜单
  const handleDailyBlockContextMenu = useCallback(
    (block: TriggerBlock, pos: { x: number; y: number }) => {
      setDailyMenuBlock(block);
      setDailyMenuPosition(pos);
    },
    []
  );

  // 日常模式：关闭右键菜单
  const handleCloseDailyMenu = useCallback(() => {
    setDailyMenuPosition(null);
    setDailyMenuBlock(null);
  }, []);

  function renderView() {
    // 日常模式：日/周/月/年四视图（只读触发块，右键管理快捷指令）
    if (appMode === "daily") {
      if (dailyLoading) {
        return (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载触发时间...
          </div>
        );
      }

      switch (view) {
        case "day": {
          const blocks = getBlocksForDate(selectedDate);
          return (
            <DailyTimelineView
              blocks={blocks}
              loading={false}
              onBlockContextMenu={handleDailyBlockContextMenu}
            />
          );
        }
        case "week":
          return (
            <DailyWeekView
              getBlocksForDate={getBlocksForDate}
              onBlockContextMenu={handleDailyBlockContextMenu}
            />
          );
        case "month":
          return (
            <DailyMonthView getBlocksForDate={getBlocksForDate} />
          );
        case "year":
          return (
            <DailyYearView getBlocksForDate={getBlocksForDate} />
          );
        default:
          return null;
      }
    }

    // 校园模式：无学期时显示创建学期空状态
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
          {appMode === "daily" ? (
            <Clock className="h-6 w-6 text-primary" />
          ) : (
            <CalendarDays className="h-6 w-6 text-primary" />
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">时间轴</h1>
            <p className="text-xs text-muted-foreground">
              {appMode === "daily"
                ? "快捷指令触发时间一览（只读）"
                : "日 / 周 / 月 / 年四视图 · 多周课表"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={appMode === "daily" ? dailyRefresh : handleRefresh}
          className="h-9"
        >
          刷新
        </Button>
      </div>

      {/* 错误提示 */}
      {(error || dailyError) && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/5 px-6 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">数据加载失败：{error || dailyError}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={appMode === "daily" ? dailyRefresh : handleRefresh}
          >
            重试
          </Button>
        </div>
      )}

      {/* 校园模式工具栏：视图/学期/周模板/周次切换 */}
      {appMode === "school" && (
        <TimelineToolbar
          semesters={semesters}
          semestersLoading={semestersLoading}
          totalWeeks={totalWeeks}
          templates={templates}
          onSemesterChange={(id) => loadSemesterData(id)}
          onOpenTemplateDialog={() => setTemplateDialogOpen(true)}
        />
      )}

      {/* 日常模式工具栏：仅视图切换（日/周/月/年） */}
      {appMode === "daily" && (
        <div className="flex flex-wrap items-center gap-3 border-b bg-card/50 px-6 py-3">
          <div className="flex items-center rounded-md border bg-background p-0.5">
            {(["day", "week", "month", "year"] as TimelineView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "h-8 rounded px-3 text-sm font-medium transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "day" ? "日" : v === "week" ? "周" : v === "month" ? "月" : "年"}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* 日常模式右键菜单：编辑/删除快捷指令 */}
      <DailyActionMenu
        position={dailyMenuPosition}
        block={dailyMenuBlock}
        onClose={handleCloseDailyMenu}
        onEdit={handleEditFlow}
        onDelete={handleDeleteFlow}
      />
    </div>
  );
}
