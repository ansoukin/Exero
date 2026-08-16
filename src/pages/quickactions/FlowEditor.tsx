import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  useReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type XYPosition,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { scaleInVariants } from "@/components/ui/motion";
import { ArrowLeft, Save, Loader2, AlertCircle, Play, Menu, X, Plus, Minus, Maximize } from "lucide-react";
import {
  actionCommands,
  executionCommands,
  flowCommands,
  triggerCommands,
  type AutomationFlow,
} from "@/lib/tauri";
import { getNodeMeta, type NodeKind } from "@/lib/nodeCatalog";
import { recordRecentKind } from "@/lib/recentNodes";
import { NodeIcon } from "@/components/PackIcon";
import { NodePalette } from "@/pages/quickactions/NodePalette";
import { PropertyPanel } from "@/pages/quickactions/PropertyPanel";
import { ActionNodeView, TriggerNodeView } from "@/pages/quickactions/ActionNodeView";
import {
  actionsToGraph,
  createNode,
  graphToActions,
  nodesToTriggers,
  triggersToNodes,
  type ActionNodeData,
} from "@/pages/quickactions/graphTransform";

interface FlowEditorProps {
  flowId: string;
  onExit: () => void;
}

/**
 * 分支连线配色（B9 第三阶段任务3）：连线颜色跟随分支端口胶囊色
 *
 * - IfElse "then"（满足）→ emerald-500
 * - IfElse "else"（否则）→ rose-500
 * - Loop "body"（循环体）→ amber-500
 * - 其余（含 triggered / out）保持 defaultEdgeOptions 主题色
 */
const BRANCH_EDGE_COLORS: Record<string, string> = {
  then: "#10b981",
  else: "#f43f5e",
  body: "#f59e0b",
};

function withBranchEdgeStyle<T extends { sourceHandle?: string | null }>(edge: T): T {
  const color = edge.sourceHandle ? BRANCH_EDGE_COLORS[edge.sourceHandle] : undefined;
  // 显式 style 会整体覆盖 defaultEdgeOptions.style，需写全（含 strokeWidth）
  return color ? { ...edge, style: { stroke: color, strokeWidth: 1.5 } } : edge;
}

/**
 * 可视化编辑器（SPEC 3.5 页面 3 可视化编辑器）
 *
 * 三栏布局：
 * - 左：NodePalette 节点库（拖拽/点击创建）
 * - 中：FlowCanvas 画布（React Flow）
 * - 右：PropertyPanel 属性面板（单击选中节点展示表单）
 *
 * 数据流：
 * - 加载：actionCommands.list → actionsToGraph → nodes/edges state
 * - 编辑：用户操作 nodes/edges → 节点 data.params 更新
 * - 保存：graphToActions → actionCommands.set
 */
export function FlowEditor({ flowId, onExit }: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner flowId={flowId} onExit={onExit} />
    </ReactFlowProvider>
  );
}

/**
 * 自定义画布控制按钮（折叠式，Win11 Fluent 风格）
 *
 * 默认状态：一个圆形按钮（菜单图标）
 * 点击展开：向上弹出 放大/缩小/适应视图 三个控制按钮
 * 再点收回：按钮消失，恢复单个圆形按钮
 */
function FlowControls() {
  const [expanded, setExpanded] = useState(false);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const buttons = [
    { Icon: Plus, label: "放大", onClick: () => zoomIn() },
    { Icon: Minus, label: "缩小", onClick: () => zoomOut() },
    { Icon: Maximize, label: "适应视图", onClick: () => fitView({ padding: 0.2 }) },
  ];

  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col-reverse items-center gap-1.5">
      {expanded &&
        buttons.map((btn, i) => (
          <motion.button
            key={i}
            onClick={btn.onClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
            title={btn.label}
            variants={scaleInVariants}
            initial="hidden"
            animate="visible"
          >
            <btn.Icon className="h-4 w-4" />
          </motion.button>
        ))}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-foreground shadow-sm transition-colors hover:bg-accent interactive"
        title={expanded ? "收起控制" : "展开控制"}
      >
        {expanded ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
    </div>
  );
}

/**
 * 拖拽预览卡片（B9 三阶段终版）
 *
 * 纯静态组件（无动画/无状态），由 createRoot 渲染进命令式 DOM ghost 容器。
 * 内容在拖拽期间永不变化——位置更新全部走容器原生 transform。
 */
function DragGhostCard({ kind }: { kind: NodeKind }) {
  const meta = getNodeMeta(kind);
  return (
    <div className="w-52 -translate-x-1/2 -translate-y-1/2 rotate-[-2deg] rounded-lg border border-primary/50 bg-card px-3 py-2 shadow-xl">
      <div className="flex items-center gap-2">
        <NodeIcon icon={meta?.icon ?? "Package"} size={14} className="text-primary" />
        <span className="truncate text-sm font-medium">
          {meta?.label ?? kind}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">松开放置到画布</p>
    </div>
  );
}

function FlowEditorInner({ flowId, onExit }: FlowEditorProps) {
  const [flow, setFlow] = useState<AutomationFlow | null>(null);
  const [nodes, setNodes] = useNodesState<Node<ActionNodeData>>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // 属性面板折叠状态（默认折叠，点击节点时自动展开）
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  // 拖拽预览（B9 三阶段终版修复）：命令式 DOM ghost
  // React 状态 + portal 方案两轮均"卡边界线"，改为 createRoot 渲染静态卡片，
  // document dragover 直接改 transform，z-index 拉满，零 React 状态/层级变量
  const ghostRef = useRef<{ el: HTMLDivElement; root: Root; cleanup: () => void } | null>(null);
  // screenToFlowPosition：DOM 坐标 → React Flow 流坐标（修正 pan/zoom 下 drop 偏移）
  const { screenToFlowPosition } = useReactFlow();

  // 组件卸载兜底清理 ghost（如拖拽中直接退出编辑器）
  useEffect(() => {
    return () => ghostRef.current?.cleanup();
  }, []);

  // 加载 Flow + Actions
  const loadFlow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flowData, actionsData, triggersData] = await Promise.all([
        flowCommands.get(flowId),
        actionCommands.list(flowId),
        triggerCommands.list(flowId),
      ]);
      setFlow(flowData);
      const { nodes: graphNodes, edges: graphEdges } = actionsToGraph(actionsData);
      // 合并触发器节点到画布（触发器存 triggers 表，Beta9 任务1）
      const triggerNodes = triggersToNodes(triggersData);
      setNodes([...graphNodes, ...triggerNodes]);
      // 分支连线配色（任务3）：then/else/body 连线跟随端口胶囊色
      setEdges(graphEdges.map(withBranchEdgeStyle));
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [flowId, setNodes, setEdges]);

  useEffect(() => {
    loadFlow();
  }, [loadFlow]);

  // 节点库拖拽创建（B9 三阶段终版）：命令式 ghost，
  // document 级 dragover 原生 transform 更新（不经过 React 状态）
  const handleDragStart = useCallback(
    (kind: NodeKind, event: React.DragEvent) => {
      event.dataTransfer.setData("application/x-action-kind", kind);
      event.dataTransfer.effectAllowed = "move";
      // 抑制浏览器默认半透明快照，避免与自定义 ghost 双影
      const blank = document.createElement("canvas");
      blank.width = 1;
      blank.height = 1;
      event.dataTransfer.setDragImage(blank, 0, 0);

      // 防御：清理上一轮残留
      ghostRef.current?.cleanup();

      // ghost 容器：fixed 0,0 起点，transform 定位（GPU 合成，无 layout）
      const el = document.createElement("div");
      el.style.cssText =
        "position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;will-change:transform;";
      el.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      const root = createRoot(el);
      root.render(<DragGhostCard kind={kind} />);
      document.body.appendChild(el);

      const onMove = (e: DragEvent) => {
        el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      };
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        document.removeEventListener("dragover", onMove);
        document.removeEventListener("dragend", cleanup);
        document.removeEventListener("drop", cleanup);
        root.unmount();
        el.remove();
        if (ghostRef.current?.el === el) ghostRef.current = null;
      };
      document.addEventListener("dragover", onMove);
      document.addEventListener("dragend", cleanup);
      document.addEventListener("drop", cleanup);

      ghostRef.current = { el, root, cleanup };
    },
    [],
  );

  // 保存
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const actions = graphToActions(nodes, edges, flowId);
      const triggers = nodesToTriggers(nodes, flowId);
      // 动作存 actions 表，触发器存 triggers 表（Beta9 任务1）
      await Promise.all([
        actionCommands.set(flowId, actions),
        triggerCommands.set(flowId, triggers),
      ]);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, flowId]);

  // 执行
  const handleExecute = useCallback(async () => {
    if (dirty) {
      const ok = confirm("当前有未保存的修改，是否先保存再执行？");
      if (!ok) return;
      await handleSave();
    }
    setExecuting(true);
    setError(null);
    try {
      // 确保 Flow 已启用
      if (flow && !flow.enabled) {
        await flowCommands.enable(flowId);
        setFlow({ ...flow, enabled: true });
      }
      await executionCommands.executeFlow(flowId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecuting(false);
    }
  }, [dirty, flow, flowId, handleSave]);

  // 记录最近使用（任务11）：drop / 点击创建后写入 localStorage 并通知面板刷新
  const recordRecent = useCallback((kind: NodeKind) => {
    recordRecentKind(kind);
    window.dispatchEvent(new Event("palette-recent-updated"));
  }, []);

  // 画布拖放接收
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/x-action-kind") as NodeKind;
      if (!kind) return;

      // 计算放置位置：screenToFlowPosition 修正画布 pan/zoom 偏移
      // （Beta9 任务11：此前用 DOM 坐标直减，缩放/平移后落点偏移）
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const position: XYPosition = {
        x: flowPos.x - 100, // 节点宽度 208px 的一半约 100，光标对准节点中心
        y: flowPos.y - 24,
      };
      const newNode = createNode(kind, position);
      setNodes((nds) => [...nds, newNode]);
      setDirty(true);
      // ghost 清理由 document drop 监听统一处理（handleDragStart 注册）
      recordRecent(kind);
    },
    [setNodes, screenToFlowPosition, recordRecent],
  );

  // 点击节点库直接创建（在画布中央偏移）
  const handlePaletteClick = useCallback(
    (kind: NodeKind) => {
      const position: XYPosition = {
        x: 200 + Math.random() * 80,
        y: 100 + nodes.length * 20,
      };
      const newNode = createNode(kind, position);
      setNodes((nds) => [...nds, newNode]);
      setDirty(true);
      recordRecent(kind);
    },
    [nodes.length, setNodes, recordRecent],
  );

  // 连线创建
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // 单一父节点约束：target 的 in 端口只能有一条入边
      setEdges((eds) => {
        const filtered = eds.filter(
          (e) =>
            !(e.target === connection.target && e.targetHandle === connection.targetHandle),
        );
        return addEdge(withBranchEdgeStyle({ ...connection, type: "bezier" }), filtered);
      });
      setDirty(true);
    },
    [setEdges],
  );

  // 节点变更（拖动位置等）
  const handleNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<ActionNodeData>[]);
      // 位置变更标记 dirty
      if (changes.some((c) => c.type === "position" && c.dragging === false)) {
        setDirty(true);
      }
      // 选中变更
      const selectChange = changes.find((c) => c.type === "select");
      if (selectChange && selectChange.type === "select") {
        setSelectedNodeId(selectChange.selected ? selectChange.id : null);
      }
    },
    [setNodes],
  );

  // 边变更（删除等）
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      if (changes.some((c) => c.type === "remove")) {
        setDirty(true);
      }
    },
    [setEdges],
  );

  // 选中节点对象
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find((n) => n.id === selectedNodeId);
    return node ? { id: node.id, data: node.data as ActionNodeData } : null;
  }, [selectedNodeId, nodes]);

  // 属性面板更新回调
  const handleParamsChange = useCallback(
    (nodeId: string, params: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const meta = getNodeMeta(n.data.kind);
          const summary = meta ? meta.summarize(params) : "";
          return { ...n, data: { ...n.data, params, summary } };
        }),
      );
      setDirty(true);
    },
    [setNodes],
  );

  const handleNoteChange = useCallback(
    (nodeId: string, note: string | null) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, note } } : n)),
      );
      setDirty(true);
    },
    [setNodes],
  );

  const handleFaultStrategyChange = useCallback(
    (nodeId: string, strategy: string | null) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, faultStrategy: strategy } }
            : n,
        ),
      );
      setDirty(true);
    },
    [setNodes],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNodeId(null);
      setDirty(true);
    },
    [setNodes, setEdges],
  );

  // 自定义节点类型注册（actionNode 动作 + triggerNode 触发器）
  const nodeTypes = useMemo(
    () => ({ actionNode: ActionNodeView, triggerNode: TriggerNodeView }),
    [],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onExit} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <div className="h-4 w-px bg-border" />
          <h2 className="text-sm font-semibold">
            {flow?.name || "未命名指令"}
          </h2>
          {dirty && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">
              未保存
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {error}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExecute}
            disabled={executing}
            className="gap-1"
          >
            {executing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            执行
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="gap-1"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            保存
          </Button>
        </div>
      </div>

      {/* 三栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette onDragStart={handleDragStart} onClick={handlePaletteClick} />

        {/* 中栏画布 */}
        <div
          className="relative flex-1"
          onDrop={handleDrop}
          onDragOver={(e) => {
            // preventDefault 允许 drop；ghost 跟随已由 document 级监听接管（任务3）
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setPanelCollapsed(false);
            }}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            // Beta9 任务13：连接线主题色 + 蚂蚁线流动动画（React Flow animated 内置）
            defaultEdgeOptions={{
              type: "bezier",
              animated: true,
              style: { stroke: "hsl(var(--primary) / 0.55)", strokeWidth: 1.5 },
            }}
            // 画布滚轮不拦截：允许滚动整个页面（B9 优化）
            // zoomOnScroll=false 禁用滚轮缩放（改用左下角按钮）；preventScrolling=false 恢复页面滚动
            zoomOnScroll={false}
            preventScrolling={false}
            // 任务7：隐藏右下角 React Flow attribution
            proOptions={{ hideAttribution: true }}
            className="bg-background"
          >
            <Background gap={16} size={1} color="hsl(var(--border))" />
            <FlowControls />
          </ReactFlow>

          {/* 空画布提示 */}
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div className="max-w-sm text-center text-muted-foreground">
                <p className="text-sm font-medium">画布为空</p>
                <p className="mt-1 text-xs">
                  从左侧节点库拖拽或点击节点类型开始构建动作链
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 拖拽预览：命令式 DOM ghost（见 handleDragStart / DragGhostCard），
            不在 React 树内渲染，规避"卡边界线"问题 */}

        <PropertyPanel
          selectedNode={selectedNode}
          nodes={nodes}
          onParamsChange={handleParamsChange}
          onNoteChange={handleNoteChange}
          onFaultStrategyChange={handleFaultStrategyChange}
          onDelete={handleDeleteNode}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed(!panelCollapsed)}
        />
      </div>
    </div>
  );
}
