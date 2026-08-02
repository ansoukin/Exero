import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  courseCommands,
  type Course,
  type ClassPeriod,
  type CreateCourseRequest,
  type UpdateCourseRequest,
} from "@/lib/tauri";
import { WEEKDAY_LABELS } from "./utils";

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 编辑模式时的原课程（null = 新建） */
  course?: Course | null;
  /** 所属学期 ID */
  semesterId: string;
  /** 节次定义（格点模式下拉选择） */
  periods: ClassPeriod[];
  /** 预填的星期几（从空格点击进入新建时） */
  defaultDayOfWeek?: number;
  /** 预填的节次（从空格点击进入新建时） */
  defaultPeriodIndex?: number | null;
  /** 关联指令可选列表（flow_id 选项） */
  flows?: Array<{ id: string; name: string }>;
  /** 保存成功回调 */
  onSaved?: (course: Course) => void;
}

/** 预设颜色色板 */
const COLOR_PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#7c3aed",
  "#db2777", "#0891b2", "#c026d3", "#ca8a04",
];

/** 周次模式选项 */
const WEEK_PATTERNS = [
  { value: "all", label: "每周" },
  { value: "odd", label: "单周" },
  { value: "even", label: "双周" },
];

/**
 * 课程新建/编辑表单对话框
 *
 * 支持：
 * - 格点模式：选择节次（从 periods 列表）
 * - 自由模式：手动输入开始/结束时间
 * - 周次模式：每周/单周/双周
 * - 颜色选择
 * - 关联快捷指令（可选）
 */
export function CourseFormDialog({
  open,
  onOpenChange,
  course,
  semesterId,
  periods,
  defaultDayOfWeek = 1,
  defaultPeriodIndex = null,
  flows = [],
  onSaved,
}: CourseFormDialogProps) {
  const isEdit = !!course;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单字段
  const [subjectName, setSubjectName] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(defaultDayOfWeek);
  const [useGridMode, setUseGridMode] = useState(defaultPeriodIndex !== null);
  const [periodIndex, setPeriodIndex] = useState<number | null>(defaultPeriodIndex);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:45");
  const [weekPattern, setWeekPattern] = useState("all");
  const [location, setLocation] = useState("");
  const [teacher, setTeacher] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // 打开时重置表单
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (course) {
      // 编辑模式：填充原数据
      setSubjectName(course.subject);
      setDayOfWeek(course.day_of_week);
      setUseGridMode(course.period_index !== null);
      setPeriodIndex(course.period_index);
      setStartTime(course.start_time ?? "08:00");
      setEndTime(course.end_time ?? "08:45");
      setWeekPattern(course.week_pattern);
      setLocation(course.room ?? "");
      setTeacher(course.teacher ?? "");
      setColor(course.color);
      setFlowId(course.flow_id);
      setNote(course.note ?? "");
    } else {
      // 新建模式：使用默认值
      setSubjectName("");
      setDayOfWeek(defaultDayOfWeek);
      setUseGridMode(defaultPeriodIndex !== null);
      setPeriodIndex(defaultPeriodIndex);
      setStartTime("08:00");
      setEndTime("08:45");
      setWeekPattern("all");
      setLocation("");
      setTeacher("");
      setColor(null);
      setFlowId(null);
      setNote("");
    }
  }, [open, course, defaultDayOfWeek, defaultPeriodIndex]);

  async function handleSave() {
    // 校验
    if (!subjectName.trim()) {
      setError("请输入科目名");
      return;
    }
    if (useGridMode && periodIndex === null) {
      setError("请选择节次");
      return;
    }
    if (!useGridMode && (!startTime || !endTime)) {
      setError("请填写开始和结束时间");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isEdit && course) {
        const req: UpdateCourseRequest = {
          subject: subjectName.trim(),
          day_of_week: dayOfWeek,
          period_index: useGridMode ? periodIndex : null,
          start_time: useGridMode ? null : startTime,
          end_time: useGridMode ? null : endTime,
          week_pattern: weekPattern,
          room: location.trim() || null,
          teacher: teacher.trim() || null,
          color: color,
          flow_id: flowId,
          note: note.trim() || null,
        };
        const updated = await courseCommands.update(course.id, req);
        onSaved?.(updated);
      } else {
        const req: CreateCourseRequest = {
          semester_id: semesterId,
          subject: subjectName.trim(),
          day_of_week: dayOfWeek,
          period_index: useGridMode ? periodIndex : null,
          start_time: useGridMode ? null : startTime,
          end_time: useGridMode ? null : endTime,
          week_pattern: weekPattern,
          room: location.trim() || null,
          teacher: teacher.trim() || null,
          color: color,
          flow_id: flowId,
          note: note.trim() || null,
        };
        const created = await courseCommands.create(req);
        onSaved?.(created);
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!course) return;
    if (!confirm(`确定删除「${course.subject}」？此操作不可撤销。`)) return;
    setSaving(true);
    try {
      await courseCommands.delete(course.id);
      onSaved?.(course); // 通知父组件刷新
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑课程" : "新建课程"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "修改课程信息或删除课程" : "添加一节新课到课表"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* 科目名 */}
          <div className="grid gap-2">
            <Label htmlFor="subject">科目名 *</Label>
            <Input
              id="subject"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="如 数学"
              autoFocus
            />
          </div>

          {/* 星期 + 定位模式 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>星期</Label>
              <Select
                value={String(dayOfWeek)}
                onValueChange={(v) => setDayOfWeek(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>定位方式</Label>
              <Select
                value={useGridMode ? "grid" : "free"}
                onValueChange={(v) => setUseGridMode(v === "grid")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">节次格点</SelectItem>
                  <SelectItem value="free">自由时间</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 节次选择 / 时间输入 */}
          {useGridMode ? (
            <div className="grid gap-2">
              <Label>节次</Label>
              {periods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  当前学期未配置节次，请先在学期设置中添加节次定义
                </p>
              ) : (
                <Select
                  value={periodIndex !== null ? String(periodIndex) : ""}
                  onValueChange={(v) => setPeriodIndex(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择节次" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={String(p.period_index)}>
                        第{p.period_index}节 {p.start_time}-{p.end_time}
                        {p.name ? ` · ${p.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start">开始时间</Label>
                <Input
                  id="start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end">结束时间</Label>
                <Input
                  id="end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 周次模式 */}
          <div className="grid gap-2">
            <Label>周次模式</Label>
            <Select value={weekPattern} onValueChange={setWeekPattern}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_PATTERNS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 地点 + 教师 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="location">教室</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="如 教学楼 A301"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="teacher">教师</Label>
              <Input
                id="teacher"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="如 张老师"
              />
            </div>
          </div>

          {/* 颜色 */}
          <div className="grid gap-2">
            <Label>颜色标识</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                className="h-7 w-7 rounded-full border-2 border-border bg-transparent text-xs text-muted-foreground hover:border-foreground"
                title="自动（按科目名分配）"
              >
                自
              </button>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "hsl(var(--foreground))" : "transparent",
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* 关联指令 */}
          {flows.length > 0 && (
            <div className="grid gap-2">
              <Label>关联快捷指令</Label>
              <Select
                value={flowId ?? "none"}
                onValueChange={(v) => setFlowId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="不关联" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联</SelectItem>
                  {flows.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 备注 */}
          <div className="grid gap-2">
            <Label htmlFor="note">备注</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="课程备注（可选）"
              rows={2}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isEdit && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
              className="mr-auto"
            >
              删除
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
