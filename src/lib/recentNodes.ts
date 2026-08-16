/**
 * 最近使用节点记录（B9 第三阶段任务11）
 *
 * 动作面板"最近使用"置顶分组的数据源：
 * - localStorage 持久化（纯 UI 偏好，不入 settings 表）
 * - 拖拽到画布 / 点击创建 时记录（FlowEditor 调用）
 * - 容量 5，去重置顶
 */

const STORAGE_KEY = "palette.recentKinds";
const MAX_RECENT = 5;

/** 读取最近使用的节点 kind 列表（新→旧） */
export function getRecentKinds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

/** 记录一次使用：去重后置顶，超出容量截断 */
export function recordRecentKind(kind: string): void {
  try {
    const next = [kind, ...getRecentKinds().filter((k) => k !== kind)].slice(
      0,
      MAX_RECENT,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage 不可用（隐私模式等）时静默降级为不记录
  }
}
