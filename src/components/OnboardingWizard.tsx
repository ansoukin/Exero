import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  onboardingCommands,
  type OnboardingPeriod,
  type OnboardingSemester,
  type OnboardingCourse,
} from "@/lib/tauri";
import { useOnboardingStore } from "@/stores/onboarding";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles,
  SkipForward,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

/**
 * 课表初始化引导向导（Phase 6a · SPEC 11.2）
 *
 * 触发：首次启动自动 / 设置页"重新初始化" / 时间轴空状态"创建学期"
 * 步骤：0 欢迎页 → 1 学期 → 2 节次 → 3 课程 → 4 完成
 * 数据流：步骤 1-3 缓存内存，步骤 4 调用 complete_onboarding 事务写入
 * UI：模态全屏遮罩 + 居中 800×600 卡片，Win11 Fluent 风格
 */

// ============================================================
// 课程默认色板（与 timeline/CourseBlock 保持一致，按科目名 hash 分配）
// ============================================================
const DEFAULT_COLORS = [
  "hsl(206 100% 42%)",
  "hsl(122 78% 27%)",
  "hsl(14 97% 43%)",
  "hsl(265 53% 37%)",
  "hsl(352 86% 49%)",
  "hsl(187 100% 38%)",
  "hsl(322 100% 44%)",
  "hsl(45 100% 50%)",
];

function hashColor(subjectName: string): string {
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = ((hash << 5) - hash + subjectName.charCodeAt(i)) | 0;
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

// ============================================================
// 节次预设模板（SPEC 11.2 步骤 2）
// ============================================================
const STANDARD_8_PERIODS: OnboardingPeriod[] = [
  { period_index: 1, start_time: "08:00", end_time: "08:45", name: null },
  { period_index: 2, start_time: "08:55", end_time: "09:40", name: null },
  { period_index: 3, start_time: "10:00", end_time: "10:45", name: null },
  { period_index: 4, start_time: "10:55", end_time: "11:40", name: null },
  { period_index: 5, start_time: "14:00", end_time: "14:45", name: null },
  { period_index: 6, start_time: "14:55", end_time: "15:40", name: null },
  { period_index: 7, start_time: "16:00", end_time: "16:45", name: null },
  { period_index: 8, start_time: "16:55", end_time: "17:40", name: null },
];

const FULL_10_PERIODS: OnboardingPeriod[] = [
  { period_index: 1, start_time: "07:30", end_time: "08:15", name: "早读" },
  { period_index: 2, start_time: "08:25", end_time: "09:10", name: null },
  { period_index: 3, start_time: "09:20", end_time: "10:05", name: null },
  { period_index: 4, start_time: "10:25", end_time: "11:10", name: null },
  { period_index: 5, start_time: "11:20", end_time: "12:05", name: null },
  { period_index: 6, start_time: "14:00", end_time: "14:45", name: null },
  { period_index: 7, start_time: "14:55", end_time: "15:40", name: null },
  { period_index: 8, start_time: "16:00", end_time: "16:45", name: null },
  { period_index: 9, start_time: "19:00", end_time: "19:45", name: "晚自习" },
  { period_index: 10, start_time: "19:55", end_time: "20:40", name: "晚自习" },
];

/** 显示日列：周一(1) ~ 周六(6) + 周日(0) */
const DAY_COLUMNS: { day: number; label: string }[] = [
  { day: 1, label: "周一" },
  { day: 2, label: "周二" },
  { day: 3, label: "周三" },
  { day: 4, label: "周四" },
  { day: 5, label: "周五" },
  { day: 6, label: "周六" },
  { day: 0, label: "周日" },
];

// ============================================================
// 日期工具
// ============================================================
function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function weeksBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00").getTime();
  const e = new Date(end + "T00:00:00").getTime();
  const days = Math.max(1, Math.round((e - s) / 86400000));
  return Math.max(1, Math.ceil(days / 7));
}

function defaultSemesterName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 8 ? `${year} 秋季学期` : `${year} 春季学期`;
}

// ============================================================
// 步骤标识与元数据
// ============================================================
type Step = 0 | 1 | 2 | 3 | 4;

const STEP_LABELS = ["欢迎", "学期", "节次", "课程", "完成"];

// ============================================================
// 主组件（外层壳：读 store，渲染 Dialog；常驻 Layout）
// ============================================================
export function OnboardingWizard() {
  const isOpen = useOnboardingStore((s) => s.isOpen);
  const startStep = useOnboardingStore((s) => s.startStep);
  const close = useOnboardingStore((s) => s.close);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="flex max-h-[600px] w-[800px] max-w-[800px] flex-col gap-0 overflow-hidden p-0"
        // 向导使用自定义导航，禁用默认右上角 X 关闭按钮
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">课表初始化向导</DialogTitle>
        {/* WizardInner 随 DialogContent 挂载/卸载：Radix 在关闭动画后卸载内容，
            下次打开时重新挂载，自动获得干净的初始状态（无需手动重置） */}
        <WizardInner startStep={startStep} close={close} />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 内层组件（持有向导状态；随 Dialog 卸载/挂载自动重置）
// ============================================================
function WizardInner({
  startStep,
  close,
}: {
  startStep: 0 | 1;
  close: () => void;
}) {
  const setDemoMode = useOnboardingStore((s) => s.setDemoMode);
  const [step, setStep] = useState<Step>(startStep);

  // 缓存数据（内存，步骤 4 提交时才落库）
  const [semester, setSemester] = useState<OnboardingSemester>(() => ({
    name: defaultSemesterName(),
    start_date: todayISO(),
    end_date: addDaysISO(todayISO(), 140),
    week_count: 20,
    is_active: true,
  }));
  const [periods, setPeriods] = useState<OnboardingPeriod[]>([]);
  const [presetKey, setPresetKey] = useState<"std8" | "full10" | "custom" | null>(null);
  const [courses, setCourses] = useState<Record<string, CourseDraft>>({});
  const [step3Expanded, setStep3Expanded] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 构造提交数据：课程矩阵 → OnboardingCourse[] */
  const buildOnboardingData = () => {
    const courseList: OnboardingCourse[] = Object.values(courses)
      .filter((c) => c.subject.trim().length > 0)
      .map((c) => ({
        subject: c.subject.trim(),
        day_of_week: c.day,
        period_index: c.period,
        start_time: null,
        end_time: null,
        room: c.room?.trim() || null,
        teacher: c.teacher?.trim() || null,
        week_pattern: c.week_pattern || null,
      }));
    return {
      semester,
      periods,
      courses: courseList,
    };
  };

  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onboardingCommands.complete(buildOnboardingData());
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onboardingCommands.skip();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadDemo = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onboardingCommands.loadDemoData();
      // 同步演示模式状态（后端已标记 demo_mode=true）
      setDemoMode(true);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  /** 下一步校验：步骤 1 学期必填，步骤 2 至少 1 节次 */
  const canGoNext = (): boolean => {
    if (step === 1) {
      return (
        semester.name.trim().length > 0 &&
        semester.start_date.length > 0 &&
        semester.end_date.length > 0 &&
        semester.week_count > 0
      );
    }
    if (step === 2) {
      return periods.length > 0 && periods.every((p) => p.start_time && p.end_time);
    }
    return true;
  };

  return (
    <>
      {/* 顶部标题 + 步骤指示器（欢迎页隐藏） */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold">
              {step === 0 ? "欢迎使用 Exero" : "课表初始化向导"}
            </span>
          </div>
          {step > 0 && <StepIndicator step={step} />}
        </div>
      </header>

      {/* 内容区（可滚动） */}
      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-fluent">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {step === 0 && <WelcomeStep onStart={() => setStep(1)} onSkip={handleSkip} onDemo={handleLoadDemo} submitting={submitting} />}

        {step === 1 && <SemesterStep semester={semester} onChange={setSemester} />}

        {step === 2 && (
          <PeriodsStep
            periods={periods}
            onChange={setPeriods}
            presetKey={presetKey}
            onPreset={(key) => {
              setPresetKey(key);
              if (key === "std8") setPeriods(STANDARD_8_PERIODS.map((p) => ({ ...p })));
              else if (key === "full10") setPeriods(FULL_10_PERIODS.map((p) => ({ ...p })));
              else setPeriods([]);
            }}
          />
        )}

        {step === 3 && (
          <CoursesStep
            periods={periods}
            courses={courses}
            onChange={setCourses}
            expanded={step3Expanded}
            onToggleExpand={() => setStep3Expanded((v) => !v)}
          />
        )}

        {step === 4 && <SummaryStep semester={semester} periods={periods} courses={courses} />}
      </div>

      {/* 底部导航（欢迎页无导航） */}
      {step > 0 && (
        <footer className="flex items-center justify-between border-t px-6 py-4">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as Step)} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                上一步
              </Button>
            )}
            {step === 1 && startStep === 0 && (
              <Button variant="ghost" onClick={() => setStep(0)} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                返回欢迎页
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 3 && (
              <Button variant="ghost" onClick={() => setStep(4)} className="gap-1">
                跳过此步
                <SkipForward className="h-4 w-4" />
              </Button>
            )}
            {step < 4 && (
              <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canGoNext()} className="gap-1">
                下一步
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={handleComplete} disabled={submitting} className="gap-1">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                完成并进入主界面
              </Button>
            )}
          </div>
        </footer>
      )}
    </>
  );
}

// ============================================================
// 步骤指示器
// ============================================================
function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={cn(
            "h-1.5 rounded-full transition-all duration-200",
            step >= s ? "w-6 bg-primary" : "w-3 bg-muted"
          )}
          title={STEP_LABELS[s]}
        />
      ))}
      <span className="ml-2 text-xs text-muted-foreground">
        {step}/4
      </span>
    </div>
  );
}

// ============================================================
// 步骤 0：欢迎页
// ============================================================
function WelcomeStep({
  onStart,
  onSkip,
  onDemo,
  submitting,
}: {
  onStart: () => void;
  onSkip: () => void;
  onDemo: () => void;
  submitting: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <CalendarPlus className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">配置你的课表</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          通过 4 步快速完成学期、节次与课程的基础配置。
          也可加载示例数据体验，或跳过稍后手动创建。
        </p>
      </div>

      <div className="flex flex-col gap-3" style={{ minWidth: 260 }}>
        <Button onClick={onStart} size="lg" className="gap-2">
          <ChevronRight className="h-4 w-4" />
          开始配置
        </Button>
        <Button onClick={onDemo} variant="secondary" size="lg" className="gap-2" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          加载示例数据（演示模式）
        </Button>
        <Button onClick={onSkip} variant="ghost" size="lg" className="gap-2" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
          跳过（使用空课表）
        </Button>
      </div>

      <p className="max-w-md text-xs text-muted-foreground/80">
        演示模式将导入预置示例学期与课程；跳过后可在时间轴页面手动创建。
      </p>
    </div>
  );
}

// ============================================================
// 步骤 1：学期配置
// ============================================================
function SemesterStep({
  semester,
  onChange,
}: {
  semester: OnboardingSemester;
  onChange: (s: OnboardingSemester) => void;
}) {
  // 起始日期变化时同步结束日期与周数（仅当结束日期早于起始时才自动修正）
  const handleStartChange = (newStart: string) => {
    let end = semester.end_date;
    if (newStart >= semester.end_date) {
      end = addDaysISO(newStart, 140);
    }
    onChange({
      ...semester,
      start_date: newStart,
      end_date: end,
      week_count: weeksBetween(newStart, end),
    });
  };

  const handleEndChange = (newEnd: string) => {
    onChange({
      ...semester,
      end_date: newEnd,
      week_count: weeksBetween(semester.start_date, newEnd),
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-medium">学期配置</h3>
        <p className="mt-1 text-sm text-muted-foreground">设置当前学期的基础信息</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="sem-name">学期名称</Label>
          <Input
            id="sem-name"
            value={semester.name}
            onChange={(e) => onChange({ ...semester, name: e.target.value })}
            placeholder="如 2026 秋季学期"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sem-start">起始日期</Label>
          <Input
            id="sem-start"
            type="date"
            value={semester.start_date}
            onChange={(e) => handleStartChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sem-end">结束日期</Label>
          <Input
            id="sem-end"
            type="date"
            value={semester.end_date}
            onChange={(e) => handleEndChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sem-weeks">总周数</Label>
          <Input
            id="sem-weeks"
            type="number"
            min={1}
            value={semester.week_count}
            onChange={(e) =>
              onChange({ ...semester, week_count: Math.max(1, parseInt(e.target.value) || 1) })
            }
          />
          <p className="text-xs text-muted-foreground">根据起止日期自动推算，可手动调整</p>
        </div>

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <Label htmlFor="sem-active" className="cursor-pointer">
              设为当前激活学期
            </Label>
            <p className="text-xs text-muted-foreground">课表以此学期为默认展示</p>
          </div>
          <Switch
            id="sem-active"
            checked={semester.is_active}
            onCheckedChange={(v) => onChange({ ...semester, is_active: v })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 步骤 2：节次时间表配置
// ============================================================
function PeriodsStep({
  periods,
  onChange,
  presetKey,
  onPreset,
}: {
  periods: OnboardingPeriod[];
  onChange: (p: OnboardingPeriod[]) => void;
  presetKey: "std8" | "full10" | "custom" | null;
  onPreset: (key: "std8" | "full10" | "custom") => void;
}) {
  const PRESETS = [
    { key: "std8" as const, label: "标准 8 节", desc: "8:00-17:40，无早读无晚自习" },
    { key: "full10" as const, label: "完整模式", desc: "7:30-20:40，含早读+8节+晚自习" },
    { key: "custom" as const, label: "自定义", desc: "从空白开始逐条添加" },
  ];

  const updatePeriod = (idx: number, patch: Partial<OnboardingPeriod>) => {
    const next = periods.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange(next);
  };

  const removePeriod = (idx: number) => {
    const next = periods.filter((_, i) => i !== idx);
    // 重新编号 period_index
    onChange(next.map((p, i) => ({ ...p, period_index: i + 1 })));
  };

  const addPeriod = () => {
    const nextIdx = periods.length + 1;
    onChange([
      ...periods,
      { period_index: nextIdx, start_time: "08:00", end_time: "08:45", name: null },
    ]);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-medium">节次时间表</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          选择预设模板后可编辑，自定义从空白开始
        </p>
      </div>

      {/* 预设按钮 */}
      <div className="grid grid-cols-3 gap-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPreset(p.key)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors duration-200",
              presetKey === p.key
                ? "border-primary bg-primary/5"
                : "border-input hover:bg-accent"
            )}
          >
            <span className="text-sm font-medium">{p.label}</span>
            <span className="text-xs text-muted-foreground">{p.desc}</span>
          </button>
        ))}
      </div>

      {/* 节次列表 */}
      {periods.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[40px_1fr_1fr_1fr_36px] gap-2 px-1 text-xs font-medium text-muted-foreground">
            <span>节次</span>
            <span>开始</span>
            <span>结束</span>
            <span>名称（可选）</span>
            <span></span>
          </div>
          {periods.map((p, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[40px_1fr_1fr_1fr_36px] items-center gap-2"
            >
              <span className="text-center text-sm font-medium text-muted-foreground">
                {p.period_index}
              </span>
              <Input
                type="time"
                value={p.start_time}
                onChange={(e) => updatePeriod(idx, { start_time: e.target.value })}
                className="h-9"
              />
              <Input
                type="time"
                value={p.end_time}
                onChange={(e) => updatePeriod(idx, { end_time: e.target.value })}
                className="h-9"
              />
              <Input
                value={p.name ?? ""}
                onChange={(e) =>
                  updatePeriod(idx, { name: e.target.value || null })
                }
                placeholder="如 早读"
                className="h-9"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={() => removePeriod(idx)}
                title="删除节次"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {presetKey === "custom"
            ? "点击下方按钮添加节次"
            : "请选择上方预设模板开始配置"}
        </p>
      )}

      <Button variant="outline" onClick={addPeriod} className="gap-2" size="sm">
        <Plus className="h-4 w-4" />
        添加节次
      </Button>
    </div>
  );
}

// ============================================================
// 步骤 3：课程录入
// ============================================================

interface CourseDraft {
  day: number;
  period: number;
  subject: string;
  teacher?: string;
  room?: string;
  week_pattern: string;
  advancedOpen: boolean;
}

function cellKey(day: number, period: number): string {
  return `${day}-${period}`;
}

function CoursesStep({
  periods,
  courses,
  onChange,
  expanded,
  onToggleExpand,
}: {
  periods: OnboardingPeriod[];
  courses: Record<string, CourseDraft>;
  onChange: (c: Record<string, CourseDraft>) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  if (!expanded) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">课程录入（可选）</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            可在此步批量录入格点课程，或跳过后在时间轴页面逐条创建。
            自由模式课程（无固定节次）请稍后在时间轴拖拽创建。
          </p>
        </div>
        <Button onClick={onToggleExpand} variant="outline" className="gap-2">
          <ChevronDown className="h-4 w-4" />
          展开课程录入
        </Button>
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        请先返回步骤 2 配置节次后再录入课程。
      </div>
    );
  }

  const setCellSubject = (day: number, period: number, subject: string) => {
    const key = cellKey(day, period);
    if (subject.trim().length === 0) {
      // 清空则移除
      const next = { ...courses };
      delete next[key];
      onChange(next);
      return;
    }
    const existing = courses[key];
    onChange({
      ...courses,
      [key]: {
        ...(existing ?? { day, period, week_pattern: "all" }),
        day,
        period,
        subject,
        advancedOpen: existing?.advancedOpen ?? false,
      },
    });
  };

  const toggleAdvanced = (day: number, period: number) => {
    const key = cellKey(day, period);
    const existing = courses[key];
    if (!existing) return;
    onChange({
      ...courses,
      [key]: { ...existing, advancedOpen: !existing.advancedOpen },
    });
  };

  const setAdvanced = (day: number, period: number, field: "teacher" | "room" | "week_pattern", value: string) => {
    const key = cellKey(day, period);
    const existing = courses[key];
    if (!existing) return;
    onChange({ ...courses, [key]: { ...existing, [field]: value } });
  };

  const filledCount = Object.values(courses).filter((c) => c.subject.trim()).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">课程录入</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            点击格子填入科目名，颜色自动分配。点击已填科目展开高级字段
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          已填 {filledCount} 节
        </span>
      </div>

      {/* 7×N 矩阵 */}
      <div className="overflow-x-auto scrollbar-fluent">
        <div className="min-w-[640px]">
          {/* 表头 */}
          <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 border-b pb-2">
            <div></div>
            {DAY_COLUMNS.map((d) => (
              <div key={d.day} className="text-center text-xs font-medium text-muted-foreground">
                {d.label}
              </div>
            ))}
          </div>
          {/* 行：节次 */}
          {periods.map((p) => (
            <div key={p.period_index} className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 py-1">
              <div className="flex flex-col items-center justify-center rounded bg-muted/50 px-1 py-2 text-center">
                <span className="text-sm font-medium">第{p.period_index}节</span>
                {p.name && (
                  <span className="text-xs text-muted-foreground">{p.name}</span>
                )}
              </div>
              {DAY_COLUMNS.map((d) => {
                const key = cellKey(d.day, p.period_index);
                const cell = courses[key];
                const subject = cell?.subject ?? "";
                const color = subject ? hashColor(subject) : "transparent";
                return (
                  <div
                    key={d.day}
                    className="flex flex-col gap-1"
                  >
                    <input
                      value={subject}
                      onChange={(e) => setCellSubject(d.day, p.period_index, e.target.value)}
                      onDoubleClick={() => subject && toggleAdvanced(d.day, p.period_index)}
                      placeholder="—"
                      className={cn(
                        "h-9 min-h-12 w-full rounded border px-2 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring",
                        subject
                          ? "border-transparent font-medium"
                          : "border-input bg-background hover:bg-accent/50"
                      )}
                      style={
                        subject
                          ? {
                              backgroundColor: `color-mix(in srgb, ${color} 15%, hsl(var(--card)))`,
                              color,
                            }
                          : undefined
                      }
                    />
                    {cell?.advancedOpen && subject && (
                      <div className="flex flex-col gap-1 rounded border bg-card p-1.5">
                        <input
                          value={cell.teacher ?? ""}
                          onChange={(e) => setAdvanced(d.day, p.period_index, "teacher", e.target.value)}
                          placeholder="教师"
                          className="h-7 rounded border bg-background px-1.5 text-xs"
                        />
                        <input
                          value={cell.room ?? ""}
                          onChange={(e) => setAdvanced(d.day, p.period_index, "room", e.target.value)}
                          placeholder="教室"
                          className="h-7 rounded border bg-background px-1.5 text-xs"
                        />
                        <select
                          value={cell.week_pattern ?? "all"}
                          onChange={(e) => setAdvanced(d.day, p.period_index, "week_pattern", e.target.value)}
                          className="h-7 rounded border bg-background px-1 text-xs"
                        >
                          <option value="all">每周</option>
                          <option value="odd">单周</option>
                          <option value="even">双周</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        提示：双击已填科目格展开教师/教室/周模式；清空内容即移除该课程。
      </p>
    </div>
  );
}

// ============================================================
// 步骤 4：完成确认
// ============================================================
function SummaryStep({
  semester,
  periods,
  courses,
}: {
  semester: OnboardingSemester;
  periods: OnboardingPeriod[];
  courses: Record<string, CourseDraft>;
}) {
  const courseCount = useMemo(
    () => Object.values(courses).filter((c) => c.subject.trim()).length,
    [courses]
  );

  const summary = [
    { label: "学期名称", value: semester.name },
    { label: "起止日期", value: `${semester.start_date} ~ ${semester.end_date}` },
    { label: "总周数", value: `${semester.week_count} 周` },
    { label: "节次数", value: `${periods.length} 节` },
    { label: "课程数", value: `${courseCount} 节` },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-medium">完成确认</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          请核对以下信息，点击完成后将事务性写入数据库
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {summary.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="text-sm font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-medium text-primary">即将提交</p>
        <p className="mt-1 text-xs text-muted-foreground">
          创建 1 个学期 + {periods.length} 条节次 + {courseCount} 条课程。
          任一步骤失败将整体回滚，不会产生脏数据。
        </p>
      </div>
    </div>
  );
}
