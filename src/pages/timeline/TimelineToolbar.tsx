import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  Layers,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Semester, WeeklyTemplate } from "@/lib/tauri";
import {
  useTimelineStore,
  type TimelineView,
} from "@/stores/timeline";
import { weekStartDate } from "./utils";

interface TimelineToolbarProps {
  semesters: Semester[];
  semestersLoading: boolean;
  totalWeeks: number;
  /** 周模板列表（用于显示当前模板名） */
  templates: WeeklyTemplate[];
  /** 学期变化时回调 */
  onSemesterChange?: (id: string) => void;
  /** 打开周模板管理对话框 */
  onOpenTemplateDialog?: () => void;
}

/**
 * 时间轴顶部工具栏（SPEC V2 修订 3.5 页面 2）
 *
 * 三大功能区：
 * 1. 学期切换（左侧）
 * 2. 视图切换（日/周/月/年四级递进，SPEC V2 修订）
 * 3. 周模板切换 + 周次导航（右侧，日/周视图显示周次导航）
 *
 * SPEC V2 变更：
 * - 视图从"周/月/年"修订为"日/周/月/年"
 * - 日视图为时间轴形态（拖拽编辑），周/月/年为网格形态（信息总览）
 */
export function TimelineToolbar({
  semesters,
  semestersLoading,
  totalWeeks,
  templates,
  onSemesterChange,
  onOpenTemplateDialog,
}: TimelineToolbarProps) {
  const view = useTimelineStore((s) => s.view);
  const activeSemesterId = useTimelineStore((s) => s.activeSemesterId);
  const currentWeek = useTimelineStore((s) => s.currentWeek);
  const activeTemplateId = useTimelineStore((s) => s.activeTemplateId);
  const setView = useTimelineStore((s) => s.setView);
  const setActiveSemester = useTimelineStore((s) => s.setActiveSemester);
  const setCurrentWeek = useTimelineStore((s) => s.setCurrentWeek);
  const prevWeek = useTimelineStore((s) => s.prevWeek);
  const nextWeek = useTimelineStore((s) => s.nextWeek);

  const activeSemester = semesters.find((s) => s.id === activeSemesterId);

  // 当前激活的周模板（NULL=普通周）
  const activeTemplate = templates.find((t) => t.id === activeTemplateId);
  const activeTemplateName = activeTemplate?.name ?? "普通周";

  function handleSemesterChange(id: string) {
    setActiveSemester(id);
    setCurrentWeek(1);
    onSemesterChange?.(id);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-card/50 px-6 py-3">
      {/* 学期切换 */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        {semestersLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : semesters.length === 0 ? (
          <span className="text-sm text-muted-foreground">暂无学期</span>
        ) : (
          <select
            value={activeSemesterId ?? ""}
            onChange={(e) => handleSemesterChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.is_active ? " · 当前" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* 视图切换：日 / 周 / 月 / 年（SPEC V2 修订：四级递进） */}
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

      <div className="ml-auto flex items-center gap-2">
        {/* 周模板切换按钮 */}
        {activeSemester && onOpenTemplateDialog && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenTemplateDialog}
            className="h-8 gap-1.5"
            title="管理周模板（普通周/特殊周）"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="max-w-[120px] truncate">{activeTemplateName}</span>
          </Button>
        )}

        {/* 周次导航（日/周视图显示，SPEC V2 修订：日视图也按周导航） */}
        {(view === "day" || view === "week") && activeSemester && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={prevWeek}
              disabled={currentWeek <= 1}
              title="上一周"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[80px] text-center text-sm font-medium">
              第 {currentWeek} 周
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => nextWeek(totalWeeks)}
              disabled={currentWeek >= totalWeeks}
              title="下一周"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              起始 {weekStartDate(activeSemester.start_date, currentWeek)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
