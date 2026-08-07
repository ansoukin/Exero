import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
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
import { ArrowLeft, Save, Loader2, AlertCircle, Play } from "lucide-react";
import {
  actionCommands,
  executionCommands,
  flowCommands,
  type ActionTypeKind,
  type AutomationFlow,
} from "@/lib/tauri";
import { getNodeMeta } from "@/lib/nodeCatalog";
import { NodePalette } from "@/pages/quickactions/NodePalette";
import { PropertyPanel } from "@/pages/quickactions/PropertyPanel";
import { ActionNodeView } from "@/pages/quickactions/ActionNodeView";
import {
  actionsToGraph,
  createNode,
  graphToActions,
  type ActionNodeData,
} from "@/pages/quickactions/graphTransform";

interface FlowEditorProps {
  flowId: string;
  onExit: () => void;
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

  // 加载 Flow + Actions
  const loadFlow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flowData, actionsData] = await Promise.all([
        flowCommands.get(flowId),
        actionCommands.list(flowId),
      ]);
      setFlow(flowData);
      const { nodes: graphNodes, edges: graphEdges } = actionsToGraph(actionsData);
      setNodes(graphNodes);
      setEdges(graphEdges);
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

  // 保存
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const actions = graphToActions(nodes, edges, flowId);
      await actionCommands.set(flowId, actions);
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

  // 节点库拖拽创建
  const handleDragStart = useCallback(
    (kind: ActionTypeKind, event: React.DragEvent) => {
      event.dataTransfer.setData("application/x-action-kind", kind);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  // 画布拖放接收
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/x-action-kind") as ActionTypeKind;
      if (!kind) return;

      // 计算放置位置（相对画布）
      const bounds = event.currentTarget.getBoundingClientRect();
      const position: XYPosition = {
        x: event.clientX - bounds.left - 100, // 节点宽度 208px 的一半约 100
        y: event.clientY - bounds.top - 30,
      };
      const newNode = createNode(kind, position);
      setNodes((nds) => [...nds, newNode]);
      setDirty(true);
    },
    [setNodes],
  );

  // 点击节点库直接创建（在画布中央偏移）
  const handlePaletteClick = useCallback(
    (kind: ActionTypeKind) => {
      const position: XYPosition = {
        x: 200 + Math.random() * 80,
        y: 100 + nodes.length * 20,
      };
      const newNode = createNode(kind, position);
      setNodes((nds) => [...nds, newNode]);
      setDirty(true);
    },
    [nodes.length, setNodes],
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
        return addEdge({ ...connection, type: "bezier" }, filtered);
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

  // 自定义节点类型注册
  const nodeTypes = useMemo(() => ({ actionNode: ActionNodeView }), []);

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
            defaultEdgeOptions={{ type: "bezier" }}
            className="bg-background"
          >
            <Background gap={16} size={1} color="hsl(var(--border))" />
            <Controls className="!bg-card !border !shadow-sm" />
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

        <PropertyPanel
          selectedNode={selectedNode}
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
