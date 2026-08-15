/**
 * actions ↔ nodes/edges 双向转换（Phase 4 可视化编辑器核心数据层）
 *
 * 后端 `actions` 表是树形结构（parent_id + order + params.branch），
 * React Flow 是图结构（nodes + edges）。本模块负责两者互转。
 *
 * 与后端执行引擎 chain.rs 对齐：
 * - 线性链：子节点 parent_id = 父节点 id，按 order 排序
 * - IfElse 分支：子节点 params.branch = "then" | "else"
 * - Loop 循环体：子节点 parent_id = Loop.id（无 branch 字段）
 *
 * Edge id 约定：`{sourceId}__{sourceHandle}__{targetId}`
 *   - 普通：`{src}__out__{tgt}`
 *   - IfElse.then：`{src}__then__{tgt}`
 *   - IfElse.else：`{src}__else__{tgt}`
 *   - Loop.body：`{src}__body__{tgt}`
 */

import type { Edge, Node } from "@xyflow/react";

import type { Action, ActionTypeKind, Trigger, TriggerTypeKind } from "@/lib/tauri";
import { getNodeMeta, isTriggerKind, type NodeKind } from "@/lib/nodeCatalog";

// ============================================================
// Action → Node
// ============================================================

/** Action 节点数据（React Flow node.data 字段） */
export interface ActionNodeData {
  /** 节点 kind（动作或触发器 TimeTrigger） */
  kind: NodeKind;
  /** 中文显示名 */
  label: string;
  /** 参数（与 action.params 同步） */
  params: Record<string, unknown>;
  /** 备注 */
  note: string | null;
  /** 容错策略 */
  faultStrategy: string | null;
  /** 是否被选中（用于样式） */
  selected?: boolean;
  /** 参数摘要（显示在节点卡片） */
  summary: string;
  [key: string]: unknown;
}

/**
 * Action 数组 → React Flow nodes + edges
 *
 * 节点位置来自 action.position_x / position_y。
 * 连线从 parent_id + params.branch 推导。
 */
export function actionsToGraph(actions: Action[]): {
  nodes: Node<ActionNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<ActionNodeData>[] = actions.map((action) => {
    const meta = getNodeMeta(action.action_type.kind);
    const summary = meta ? meta.summarize(action.params) : "";
    return {
      id: action.id,
      type: "actionNode",
      position: { x: action.position_x, y: action.position_y },
      data: {
        kind: action.action_type.kind,
        label: meta?.label ?? action.action_type.kind,
        params: { ...action.params },
        note: action.note,
        faultStrategy: action.fault_strategy,
        summary,
      },
    };
  });

  // 构建 id → action 索引
  const actionIndex = new Map(actions.map((a) => [a.id, a]));

  // 推导 edges
  const edges: Edge[] = [];
  for (const action of actions) {
    if (!action.parent_id) continue;
    const parent = actionIndex.get(action.parent_id);
    if (!parent) continue;

    const parentMeta = getNodeMeta(parent.action_type.kind);
    // 确定源 handle：
    // - IfElse 用 params.branch（then/else）
    // - Loop 用 body
    // - 其他用 out
    let sourceHandle = "out";
    if (parentMeta) {
      if (parentMeta.kind === "IfElse") {
        const branch = (action.params.branch as string) || "then";
        sourceHandle = branch; // "then" | "else"
      } else if (parentMeta.kind === "Loop") {
        sourceHandle = "body";
      }
    }

    edges.push({
      id: `${parent.id}__${sourceHandle}__${action.id}`,
      source: parent.id,
      sourceHandle,
      target: action.id,
      targetHandle: "in",
      type: "bezier",
    });
  }

  return { nodes, edges };
}

// ============================================================
// Nodes + Edges → Actions
// ============================================================

/**
 * React Flow nodes + edges → Action 数组
 *
 * 位置来自 node.position。
 * parent_id + params.branch 从 edges 推导。
 * order 按 BFS 拓扑序赋值（保证同层级内顺序稳定）。
 */
export function graphToActions(
  nodes: Node<ActionNodeData>[],
  edges: Edge[],
  flowId: string,
): Action[] {
  // 构建邻接表：source → [{ target, sourceHandle, edge }]
  interface EdgeLink {
    target: string;
    sourceHandle: string;
  }
  const adjacency = new Map<string, EdgeLink[]>();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    const list = adjacency.get(edge.source) ?? [];
    list.push({
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? "out",
    });
    adjacency.set(edge.source, list);
  }

  // 反向索引：target → { source, sourceHandle }
  const parentOf = new Map<
    string,
    { parentId: string; sourceHandle: string }
  >();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    // 同一 target 只保留第一个 parent（React Flow 应保证单一父节点）
    if (!parentOf.has(edge.target)) {
      parentOf.set(edge.target, {
        parentId: edge.source,
        sourceHandle: edge.sourceHandle ?? "out",
      });
    }
  }

  // 找到根节点（没有 parent 的节点）
  const roots = nodes.filter((n) => !parentOf.has(n.id));

  // BFS 遍历赋 order
  const orderMap = new Map<string, number>();
  let orderCounter = 0;
  const visited = new Set<string>();
  const queue: string[] = roots.map((r) => r.id);

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    orderMap.set(id, orderCounter++);

    const children = adjacency.get(id) ?? [];
    for (const child of children) {
      if (!visited.has(child.target)) {
        queue.push(child.target);
      }
    }
  }

  // 处理孤立节点（可能因 edge 删除变成游离状态）
  for (const node of nodes) {
    if (!orderMap.has(node.id)) {
      orderMap.set(node.id, orderCounter++);
    }
  }

  // node id → kind 索引（判断 parent 是否触发器节点）
  const nodeKindMap = new Map(nodes.map((n) => [n.id, n.data.kind]));

  // 仅转换动作节点（触发器节点不进 actions 表，单独存 triggers 表）
  const actionNodes = nodes.filter((n) => !isTriggerKind(n.data.kind));

  // 转换为 Action
  return actionNodes.map((node) => {
    const parent = parentOf.get(node.id);
    const params = { ...node.data.params };

    // 根据 parent 的 sourceHandle 写入 params.branch
    if (parent && parent.sourceHandle !== "out" && parent.sourceHandle !== "body") {
      params.branch = parent.sourceHandle; // "then" | "else"
    } else {
      // 非 IfElse 分支，清除可能残留的 branch 字段
      delete params.branch;
    }

    // 触发器节点的子节点（通过 triggered 端口连接）成为动作链根（parent_id=null）
    const parentIsTrigger =
      parent !== undefined &&
      isTriggerKind(nodeKindMap.get(parent.parentId) ?? ("LaunchProgram" as NodeKind));
    const parentId = parentIsTrigger ? null : (parent?.parentId ?? null);

    return {
      id: node.id,
      flow_id: flowId,
      action_type: { kind: node.data.kind as ActionTypeKind, variant: null },
      params,
      order: orderMap.get(node.id) ?? 0,
      parent_id: parentId,
      fault_strategy: (node.data.faultStrategy as never) ?? null,
      note: node.data.note ?? null,
      position_x: node.position.x,
      position_y: node.position.y,
    };
  });
}

// ============================================================
// 创建新节点
// ============================================================

/** 生成新节点 UUID（前端临时 ID，落库时后端会保留） */
export function generateNodeId(): string {
  // 简易 UUID v4 生成（避免引入额外依赖）
  return crypto.randomUUID();
}

/**
 * 创建新节点（从节点库拖到画布时调用）
 *
 * @param kind 动作类型
 * @param position 画布坐标
 */
export function createNode(
  kind: NodeKind,
  position: { x: number; y: number },
): Node<ActionNodeData> {
  const meta = getNodeMeta(kind);
  if (!meta) {
    throw new Error(`未知的节点类型: ${kind}`);
  }
  return {
    id: generateNodeId(),
    // 触发器节点用独立 type，与 actionNode 区分渲染
    type: isTriggerKind(kind) ? "triggerNode" : "actionNode",
    position,
    data: {
      kind,
      label: meta.label,
      params: { ...meta.defaultParams },
      note: null,
      faultStrategy: null,
      summary: meta.summarize(meta.defaultParams),
    },
  };
}

// ============================================================
// 触发器节点转换（Beta9 · 任务1，触发器存 triggers 表）
// ============================================================

/** 将用户友好配置转为 5 字段 cron 表达式（分 时 日 月 周） */
export function buildCronExpression(p: Record<string, unknown>): string {
  const time = (p.time as string) || "00:00";
  const [hh, mm] = time.split(":");
  const H = hh ?? "0";
  const M = mm ?? "0";
  const repeat = (p.repeat as string) || "daily";
  switch (repeat) {
    case "daily":
      return `${M} ${H} * * *`;
    case "weekly": {
      const days = (p.weekdays as number[]) ?? [];
      const w = days.length ? days.join(",") : "*";
      return `${M} ${H} * * ${w}`;
    }
    case "interval": {
      const n = typeof p.intervalDays === "number" ? p.intervalDays : 1;
      return `${M} ${H} */${n} * *`;
    }
    case "once": {
      const date = (p.date as string) || "";
      const [, Mo, D] = date.split("-");
      return `${M} ${H} ${D ?? "*"} ${Mo ?? "*"} *`;
    }
    default:
      return `${M} ${H} * * *`;
  }
}

/** 反解析 cron 表达式到友好配置（尽力匹配，失败返回 custom + 原表达式） */
function parseCronToConfig(expr: string): Record<string, unknown> {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { repeat: "custom", cronExpression: expr };
  const [M, H, D, Mo, W] = parts;
  const time = `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
  if (D === "*" && Mo === "*" && W === "*") return { repeat: "daily", time };
  if (D === "*" && Mo === "*" && W !== "*") {
    const weekdays = W.split(",").map(Number).filter((n) => !Number.isNaN(n));
    return { repeat: "weekly", time, weekdays };
  }
  if (D.startsWith("*/") && Mo === "*" && W === "*") {
    const n = parseInt(D.slice(2), 10);
    return { repeat: "interval", time, intervalDays: Number.isNaN(n) ? 1 : n };
  }
  if (D !== "*" && Mo !== "*" && W === "*") {
    // cron 不含年份，用当前年占位
    const year = new Date().getFullYear();
    return { repeat: "once", time, date: `${year}-${Mo}-${D}` };
  }
  return { repeat: "custom", cronExpression: expr };
}

/** Trigger[] → 触发器节点（加载时合并到画布） */
export function triggersToNodes(triggers: Trigger[]): Node<ActionNodeData>[] {
  const meta = getNodeMeta("TimeTrigger");
  if (!meta) return [];
  return triggers.map((t, idx) => {
    const baseParams = { ...meta.defaultParams };
    let params = baseParams;
    if (t.trigger_type.kind === "Cron") {
      const cp = t.params as { expression?: string };
      const cfg = parseCronToConfig(cp.expression ?? "");
      params = { ...baseParams, triggerType: "Cron", ...cfg };
    } else if (t.trigger_type.kind === "CourseStart") {
      const cp = t.params as { course_id?: string; timing?: string; minutes?: number };
      params = {
        ...baseParams,
        triggerType: "CourseStart",
        courseId: cp.course_id ?? "",
        timing: (cp.timing as string) || "Before",
        minutes: typeof cp.minutes === "number" ? cp.minutes : 0,
      };
    }
    return {
      id: t.id,
      type: "triggerNode",
      // 触发器节点位置：左上方纵列（位置不持久化，每次加载固定布局）
      position: { x: 200, y: 20 + idx * 110 },
      data: {
        kind: "TimeTrigger",
        label: meta.label,
        params,
        note: null,
        faultStrategy: null,
        summary: meta.summarize(params),
      },
    };
  });
}

/** 触发器节点 → Trigger[]（保存时分离到 triggers 表） */
export function nodesToTriggers(
  nodes: Node<ActionNodeData>[],
  flowId: string,
): Trigger[] {
  return nodes
    .filter((n) => isTriggerKind(n.data.kind))
    .map((n) => {
      const p = n.data.params;
      const tt = (p.triggerType as string) || "Cron";
      if (tt === "CourseStart") {
        const timing = (p.timing as string) || "Before";
        const courseParams: Record<string, unknown> = {
          course_id: (p.courseId as string) || "",
          timing,
        };
        if (timing === "Before") {
          courseParams.minutes = typeof p.minutes === "number" ? p.minutes : 0;
        }
        return {
          id: n.id,
          flow_id: flowId,
          trigger_type: { kind: "CourseStart" as TriggerTypeKind, variant: null },
          params: courseParams,
          enabled: true,
        };
      }
      // custom 模式直接用保存的 cronExpression，否则由配置生成
      const expression =
        p.repeat === "custom" && typeof p.cronExpression === "string"
          ? p.cronExpression
          : buildCronExpression(p);
      return {
        id: n.id,
        flow_id: flowId,
        trigger_type: { kind: "Cron" as TriggerTypeKind, variant: null },
        params: { expression, timezone: null },
        enabled: true,
      };
    });
}
