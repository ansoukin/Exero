/**
 * 触发器属性表单（Beta9 · 任务1）
 *
 * 两种触发类型：
 * - Cron（时间触发）：重复规则 + 时间，前端转 cron 表达式传后端
 * - CourseStart（课表触发）：课程选择 + 触发时机，仅校园模式显示
 *
 * 课表触发的"日历+当日课表"弹窗简化为课程下拉选择（按科目+星期+节次展示），
 * 覆盖核心功能（选课程+时机触发）。
 */

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOobeStore } from "@/stores/oobe";
import { courseCommands, semesterCommands, type Course } from "@/lib/tauri";
import { updateField } from "@/pages/quickactions/forms/helpers";

interface TriggerFormProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function TriggerForm({ params, onChange }: TriggerFormProps) {
  const appMode = useOobeStore((s) => s.appMode);
  const isSchool = appMode === "school";
  const triggerType = (params.triggerType as string) || "Cron";
  const repeat = (params.repeat as string) || "daily";
  const timing = (params.timing as string) || "Before";

  // 加载课程列表（校园模式，需要激活学期）
  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => {
    if (!isSchool) {
      setCourses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sem = await semesterCommands.getActive();
        if (!sem || cancelled) return;
        const list = await courseCommands.list(sem.id);
        if (!cancelled) setCourses(list);
      } catch {
        // 忽略，课程列表保持空
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSchool]);

  // 切换触发类型时若从 CourseStart 切回 Cron 且非校园模式，强制 Cron
  const setTriggerType = (tt: string) => onChange({ ...params, triggerType: tt });
  const setRepeat = (r: string) => onChange({ ...params, repeat: r });

  // weekly 星期勾选
  const toggleWeekday = (day: number) => {
    const days = new Set((params.weekdays as number[]) ?? []);
    if (days.has(day)) days.delete(day);
    else days.add(day);
    onChange(updateField(params, "weekdays", [...days].sort((a, b) => a - b)));
  };

  return (
    <div className="space-y-4">
      {/* 触发类型 */}
      <div className="space-y-1.5">
        <Label className="text-xs">触发类型</Label>
        <Select value={triggerType} onValueChange={setTriggerType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Cron">时间触发</SelectItem>
            {isSchool && <SelectItem value="CourseStart">课表触发</SelectItem>}
          </SelectContent>
        </Select>
        {!isSchool && (
          <p className="text-[10px] text-muted-foreground">
            课表触发仅在校园模式可用（设置页可切换模式）
          </p>
        )}
      </div>

      {triggerType === "Cron" ? (
        <>
          {/* 重复规则 */}
          <div className="space-y-1.5">
            <Label className="text-xs">重复规则</Label>
            <Select value={repeat} onValueChange={setRepeat}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">每天</SelectItem>
                <SelectItem value="weekly">每周指定日</SelectItem>
                <SelectItem value="interval">每 N 天</SelectItem>
                <SelectItem value="once">指定日期</SelectItem>
                <SelectItem value="custom">自定义 Cron 表达式</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 触发时间（custom 模式不显示，直接用 cron 表达式） */}
          {repeat !== "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs">触发时间</Label>
              <Input
                type="time"
                value={(params.time as string) || "08:00"}
                onChange={(e) => onChange(updateField(params, "time", e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* weekly 星期勾选 */}
          {repeat === "weekly" && (
            <div className="space-y-1.5">
              <Label className="text-xs">星期</Label>
              <div className="flex flex-wrap gap-1">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const days = (params.weekdays as number[]) ?? [];
                  const active = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleWeekday(d)}
                      className={cn(
                        "h-7 w-10 rounded-md border text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input hover:bg-accent",
                      )}
                    >
                      {WEEKDAY_LABELS[d]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* interval 间隔天数 */}
          {repeat === "interval" && (
            <div className="space-y-1.5">
              <Label className="text-xs">间隔天数</Label>
              <Input
                type="number"
                min={1}
                value={(params.intervalDays as number) ?? 2}
                onChange={(e) =>
                  onChange(
                    updateField(params, "intervalDays", Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* once 指定日期 */}
          {repeat === "once" && (
            <div className="space-y-1.5">
              <Label className="text-xs">日期</Label>
              <Input
                type="date"
                value={(params.date as string) || ""}
                onChange={(e) => onChange(updateField(params, "date", e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* custom cron 表达式 */}
          {repeat === "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Cron 表达式（分 时 日 月 周）</Label>
              <Input
                value={(params.cronExpression as string) || ""}
                onChange={(e) =>
                  onChange(updateField(params, "cronExpression", e.target.value))
                }
                placeholder="30 17 * * *"
                className="h-8 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                示例：30 17 * * *（每天 17:30）/ 0 9 * * 1-5（工作日 9:00）
              </p>
            </div>
          )}
        </>
      ) : (
        // CourseStart 课表触发配置
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">课程</Label>
            <Select
              value={(params.courseId as string) || undefined}
              onValueChange={(v) => onChange(updateField(params, "courseId", v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="选择课程" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.subject} · {WEEKDAY_LABELS[c.day_of_week]}
                    {c.period_index ? ` 第${c.period_index}节` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {courses.length === 0 && (
              <p className="text-[10px] text-muted-foreground">无可用课程，请先在时间轴创建课程</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">触发时机</Label>
            <Select
              value={timing}
              onValueChange={(v) => onChange(updateField(params, "timing", v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Before">课前 N 分钟</SelectItem>
                <SelectItem value="During">课中（开始时）</SelectItem>
                <SelectItem value="After">课后（结束时）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {timing === "Before" && (
            <div className="space-y-1.5">
              <Label className="text-xs">提前分钟数（0=开始即触发）</Label>
              <Input
                type="number"
                min={0}
                value={(params.minutes as number) ?? 0}
                onChange={(e) =>
                  onChange(
                    updateField(params, "minutes", Math.max(0, Number(e.target.value) || 0)),
                  )
                }
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                跟随课程自身周次模式（单双周/指定周），该日无课则不触发
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
