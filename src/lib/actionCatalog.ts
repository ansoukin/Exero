/**
 * 动态动作目录（Beta3 · 扩展包架构）
 *
 * 从后端 list_action_catalog 拉取所有扩展包声明的动作，
 * 与本地 nodeCatalog.ts 的元数据（图标 + summarize 函数）合并。
 *
 * 合并策略：
 * - base-pack 的 20 种动作：id 与 ActionTypeKind 对应，使用本地 NodeMeta（含精确图标和 summarize）
 * - 扩展包新增动作：使用 ICON_MAP 查找图标，summarize 用模板解析
 *
 * NodePalette 使用此 hook 渲染节点库，实现"动作类型不再硬编码"。
 */

import { useEffect, useState } from "react";
import {
  AppWindow,
  XCircle,
  Globe,
  FileText,
  Volume2,
  Music,
  Keyboard,
  Power,
  RotateCcw,
  Lock,
  Moon,
  LogOut,
  Trash2,
  BatteryCharging,
  Bell,
  MessageSquare,
  GitBranch,
  Repeat,
  Variable,
  Code,
  type LucideIcon,
} from "lucide-react";

import { extensionPackCommands, type ActionManifest } from "@/lib/tauri";
import {
  NODE_REGISTRY,
  type NodeCategory,
  type NodeMeta,
  type NodePort,
} from "@/lib/nodeCatalog";

// ============================================================
// 图标名称 → 组件映射（base-pack 20 种 + 默认）
// ============================================================

const ICON_MAP: Record<string, LucideIcon> = {
  AppWindow,
  XCircle,
  Globe,
  FileText,
  Volume2,
  Music,
  Keyboard,
  Power,
  RotateCcw,
  Lock,
  Moon,
  LogOut,
  Trash2,
  BatteryCharging,
  Bell,
  MessageSquare,
  GitBranch,
  Repeat,
  Variable,
  Code,
};

// ============================================================
// 类别映射
// ============================================================

const VALID_CATEGORIES: NodeCategory[] = [
  "app",
  "media",
  "system",
  "notification",
  "control",
  "lua",
];

function normalizeCategory(cat: string): NodeCategory {
  return (VALID_CATEGORIES as string[]).includes(cat)
    ? (cat as NodeCategory)
    : "lua"; // 未知类别归入 lua（通用扩展）
}

// ============================================================
// 端口转换
// ============================================================

function toNodePorts(
  ports: ActionManifest["ports"],
): { inputs: NodePort[]; outputs: NodePort[] } {
  return {
    inputs: ports.inputs.map((p) => ({
      id: p.id,
      position: p.position,
      label: p.label ?? undefined,
    })),
    outputs: ports.outputs.map((p) => ({
      id: p.id,
      position: p.position,
      label: p.label ?? undefined,
    })),
  };
}

// ============================================================
// 模板 summarize 解析器
// ============================================================

/**
 * 从模板字符串（如 "{path}"）创建 summarize 函数
 *
 * 模板中的 {key} 占位符会被替换为 params[key] 的字符串值。
 * 空模板返回空字符串。
 */
function createTemplateSummarizer(
  template: string,
): (params: Record<string, unknown>) => string {
  if (!template) return () => "";
  return (params) => {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      const v = params[key];
      if (v === null || v === undefined) return "";
      return String(v);
    });
  };
}

// ============================================================
// ActionManifest → NodeMeta 转换
// ============================================================

/**
 * 将后端 ActionManifest 转换为前端 NodeMeta
 *
 * 优先使用本地 NODE_REGISTRY 的元数据（base-pack 20 种动作），
 * 找不到则用 ICON_MAP + 模板 summarize 构造（扩展包新增动作）。
 */
function manifestToNodeMeta(manifest: ActionManifest): NodeMeta {
  // base-pack 动作：id 对应 ActionTypeKind，从本地查找
  const local = NODE_REGISTRY.find((m) => m.kind === manifest.id);
  if (local) return local;

  // 扩展包新增动作：构造 NodeMeta
  const icon = ICON_MAP[manifest.icon] ?? Code;
  const { inputs, outputs } = toNodePorts(manifest.ports);

  return {
    kind: manifest.id as NodeMeta["kind"], // 扩展包动作 id（类型放宽）
    label: manifest.label,
    category: normalizeCategory(manifest.category),
    icon,
    defaultParams: manifest.default_params as Record<string, unknown>,
    inputs,
    outputs,
    summarize: createTemplateSummarizer(manifest.summarize_template),
  };
}

// ============================================================
// useActionCatalog Hook
// ============================================================

export interface UseActionCatalogResult {
  /** 合并后的节点元数据列表（本地 + 扩展包） */
  catalog: NodeMeta[];
  /** 加载中 */
  loading: boolean;
  /** 加载错误 */
  error: string | null;
  /** 重新加载 */
  reload: () => void;
}

/**
 * 从后端拉取完整动作目录，与本地元数据合并
 *
 * 后端返回的 ActionManifest[] 包含 base-pack 的 20 种 + 扩展包新增动作。
 * 转换为 NodeMeta[] 供 NodePalette 渲染。
 */
export function useActionCatalog(): UseActionCatalogResult {
  const [manifests, setManifests] = useState<ActionManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 后端是否成功响应（区分"空目录"与"调用失败"）
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await extensionPackCommands.listActionCatalog();
      setManifests(data);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // 失败时清空，标记 loaded=false 触发本地回退
      setManifests([]);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 后端成功响应：使用后端目录（可能为空，表示无扩展包）
  // 后端调用失败：回退到本地 NODE_REGISTRY（保证编辑器可用）
  const catalog = loaded ? manifests.map(manifestToNodeMeta) : NODE_REGISTRY;

  return { catalog, loading, error, reload: load };
}

// ============================================================
// 按类别分组工具
// ============================================================

/** 按类别分组节点 */
export function groupByCategory(
  catalog: NodeMeta[],
): { category: NodeCategory; items: NodeMeta[] }[] {
  const groups = new Map<NodeCategory, NodeMeta[]>();
  for (const meta of catalog) {
    const list = groups.get(meta.category) ?? [];
    list.push(meta);
    groups.set(meta.category, list);
  }
  // 按 VALID_CATEGORIES 顺序输出，未知类别追加到末尾
  const result: { category: NodeCategory; items: NodeMeta[] }[] = [];
  for (const cat of VALID_CATEGORIES) {
    const items = groups.get(cat);
    if (items && items.length > 0) {
      result.push({ category: cat, items });
    }
  }
  return result;
}
