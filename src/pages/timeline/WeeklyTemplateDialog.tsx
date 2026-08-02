import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  weeklyTemplateCommands,
  type WeeklyTemplate,
} from "@/lib/tauri";

// ============================================================
// 常量
// ============================================================

/** 预设颜色色板（与 CourseFormDialog 一致） */
const COLOR_PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#7c3aed",
  "#db2777", "#0891b2", "#c026d3", "#ca8a04",
];

// ============================================================
// 主组件
// ============================================================

interface WeeklyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 所属学期 ID */
  semesterId: string;
  /** 已有周模板列表 */
  templates: WeeklyTemplate[];
  /** 当前选中的模板 ID（NULL=普通周） */
  activeTemplateId: string | null;
  /** 选择模板回调 */
  onSelect: (id: string | null) => void;
  /** 创建/编辑/删除成功后刷新数据 */
  onSaved?: () => void;
}

/**
 * 周模板管理对话框（SPEC V2 3.5 页面 2：周模板切换）
 *
 * 功能：
 * - 列出当前学期的所有周模板（含"普通周"默认项）
 * - 点击模板卡片切换激活模板
 * - 新建特殊周模板（名称 + 描述 + 颜色）
 * - 编辑/删除已有模板
 *
 * 普通周（template_id=NULL）不可删除不可编辑，作为默认基准。
 */
export function WeeklyTemplateDialog({
  open,
  onOpenChange,
  semesterId,
  templates,
  activeTemplateId,
  onSelect,
  onSaved,
}: WeeklyTemplateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新建/编辑表单状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string | null>(null);

  // 打开时重置表单
  useEffect(() => {
    if (!open) return;
    setError(null);
    setEditingId(null);
    setName("");
    setDescription("");
    setColor(null);
  }, [open]);

  async function handleSave() {
    if (!name.trim()) {
      setError("请输入模板名称");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await weeklyTemplateCommands.update(editingId, {
          name: name.trim(),
          description: description.trim() || null,
          color: color,
        });
      } else {
        const created = await weeklyTemplateCommands.create({
          semester_id: semesterId,
          name: name.trim(),
          description: description.trim() || null,
          color: color,
        });
        // 新建后自动选中新模板
        onSelect(created.id);
      }
      onSaved?.();
      // 重置表单
      setEditingId(null);
      setName("");
      setDescription("");
      setColor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template: WeeklyTemplate) {
    if (!confirm(`确定删除周模板「${template.name}」？`)) return;
    setSaving(true);
    try {
      await weeklyTemplateCommands.delete(template.id);
      // 若删除的是当前激活模板，切回普通周
      if (activeTemplateId === template.id) {
        onSelect(null);
      }
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(template: WeeklyTemplate) {
    setEditingId(template.id);
    setName(template.name);
    setDescription(template.description ?? "");
    setColor(template.color);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setName("");
    setDescription("");
    setColor(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>周模板管理</DialogTitle>
          <DialogDescription>
            管理学期周课表模板（普通周/特殊周），切换不同模板查看对应课表
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* 模板列表 */}
          <div className="grid gap-2">
            <Label>模板列表</Label>

            {/* 普通周（默认，不可删除） */}
            <button
              onClick={() => onSelect(null)}
              className={cn(
                "flex items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent/40",
                activeTemplateId === null
                  ? "border-primary bg-primary/5 ring-1 ring-inset ring-primary/30"
                  : "border-border"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">普通周</p>
                  <p className="text-xs text-muted-foreground">默认周课表模板</p>
                </div>
              </div>
              {activeTemplateId === null && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>

            {/* 特殊周模板 */}
            {templates.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex items-center justify-between rounded-md border p-3 transition-colors",
                  activeTemplateId === t.id
                    ? "border-primary bg-primary/5 ring-1 ring-inset ring-primary/30"
                    : "border-border hover:bg-accent/40"
                )}
              >
                <button
                  onClick={() => onSelect(t.id)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: t.color || "#6b7280" }}
                  />
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleEdit(t)}
                    disabled={saving}
                    title="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(t)}
                    disabled={saving}
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {activeTemplateId === t.id && (
                    <Check className="ml-1 h-4 w-4 text-primary" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 分隔线 */}
          <div className="border-t" />

          {/* 新建/编辑表单 */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>{editingId ? "编辑模板" : "新建模板"}</Label>
              {editingId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-7"
                >
                  取消编辑
                </Button>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-name">名称 *</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如期中考试周"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-desc">描述（可选）</Label>
              <Textarea
                id="template-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="模板用途说明"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label>颜色标识</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setColor(null)}
                  className="h-7 w-7 rounded-full border-2 border-border bg-transparent text-xs text-muted-foreground hover:border-foreground"
                  title="无颜色"
                >
                  无
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

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="w-full"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editingId ? "保存修改" : "新建模板"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
