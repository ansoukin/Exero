import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  overrideCommands,
  type Course,
  type ClassPeriod,
  type ScheduleOverride,
} from "@/lib/tauri";
import { todayIso } from "./utils";

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 要调课的课程 */
  course: Course | null;
  /** 所属学期 ID */
  semesterId: string;
  /** 节次定义（move 时选择新节次） */
  periods: ClassPeriod[];
  /** 默认调课日期（一般为当天） */
  defaultDate?: string;
  /** 成功回调 */
  onSaved?: (override: ScheduleOverride) => void;
}

/**
 * 临时换时间对话框（SPEC 3.5：临时调课，不修改常规课表）
 *
 * 由右键菜单"临时调整 → 换时间"触发，
 * 选择新节次或自由时间，当天临时调整。
 */
export function OverrideDialog({
  open,
  onOpenChange,
  course,
  semesterId,
  periods,
  defaultDate,
  onSaved,
}: OverrideDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(defaultDate ?? todayIso());
  const [useGridMode, setUseGridMode] = useState(true);
  const [newPeriodIndex, setNewPeriodIndex] = useState<number | null>(null);
  const [newStartTime, setNewStartTime] = useState("08:00");
  const [newEndTime, setNewEndTime] = useState("08:45");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDate(defaultDate ?? todayIso());
    setUseGridMode(true);
    setNewPeriodIndex(null);
    setNewStartTime("08:00");
    setNewEndTime("08:45");
    setNote("");
  }, [open, defaultDate]);

  async function handleSave() {
    if (!course) return;
    if (!date) {
      setError("请选择日期");
      return;
    }
    if (useGridMode && newPeriodIndex === null) {
      setError("请选择新节次");
      return;
    }
    if (!useGridMode && (!newStartTime || !newEndTime)) {
      setError("请填写新时间");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const override = await overrideCommands.create({
        semester_id: semesterId,
        date,
        course_id: course.id,
        type: "move",
        target_period_index: useGridMode ? newPeriodIndex : null,
        target_start_time: useGridMode ? null : newStartTime,
        target_end_time: useGridMode ? null : newEndTime,
        note: note.trim() || null,
      });
      onSaved?.(override);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>临时换时间</DialogTitle>
          <DialogDescription>
            调整「{course.subject}」在指定日期的时间，不影响常规课表
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* 日期 */}
          <div className="grid gap-2">
            <Label htmlFor="override-date">生效日期</Label>
            <Input
              id="override-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* 调整到：节次 / 自由时间 */}
          <div className="grid gap-2">
            <Label>调整到</Label>
            <Select
              value={useGridMode ? "grid" : "free"}
              onValueChange={(v) => setUseGridMode(v === "grid")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">节次</SelectItem>
                <SelectItem value="free">自由时间</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {useGridMode ? (
            <div className="grid gap-2">
              <Label>新节次</Label>
              {periods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  当前学期未配置节次
                </p>
              ) : (
                <Select
                  value={newPeriodIndex !== null ? String(newPeriodIndex) : ""}
                  onValueChange={(v) => setNewPeriodIndex(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择新节次" />
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
                <Label htmlFor="new-start">新开始时间</Label>
                <Input
                  id="new-start"
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-end">新结束时间</Label>
                <Input
                  id="new-end"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 备注 */}
          <div className="grid gap-2">
            <Label htmlFor="override-note">备注（可选）</Label>
            <Input
              id="override-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如 调课原因"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认调整
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
