import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Course, ClassPeriod } from "@/lib/tauri";
import { CourseBlock } from "./CourseBlock";
import { WEEKDAY_SHORT } from "./utils";
import { suppressNextClick, markDragStart, markDragEnd } from "./clickSuppression";

// ============================================================
// 性能优化常量
// ============================================================

/** 节次线对齐吸附阈值（分钟，进入）：光标距节次起点 <= 阈值即吸附 */
const PERIOD_SNAP_ENTER_MIN = 10;
/** 节次线对齐脱离阈值（分钟，离开，> 进入）：一旦吸附，需距离更远才脱离。
 *  hysteresis 滞后区：避免光标在 10px 边界抖动时反复吸附/脱离导致预览块抽搐 */
const PERIOD_SNAP_LEAVE_MIN = 18;

/**
 * 拖拽上下文（SPEC 3.5 页面 2：拖拽编辑）
 *
 * 使用 @dnd-kit 提供触摸/鼠标/键盘三模式支持，
 * 适配 30Hz 触屏（PointerSensor 阈值 8px，避免误触）。
 *
 * 拖拽对齐模式（editMode）：
 * - grid：drop 到节次格 -> onMoveCourse 更新 period_index，清空 start/end_time
 * - free：drop 到任意位置 -> onMoveCourse 保留/更新 start/end_time
 *
 * resize（仅日视图时间轴）：底部手柄拖拽 -> onResizeCourse 更新 end_time
 *
 * V2 性能优化（解决鬼影/抽搐）：
 * 1. rAF 节流 dragMove + pointermove，合并高频回调到下一帧
 * 2. ref 缓存上一次值，值未变化时跳过 setState 避免无意义重渲染
 * 3. 节次线对齐 hysteresis 滞后区（ENTER 10min / LEAVE 18min）避免边界跳变
 * 4. 启用 DragOverlay 始终显示（原位置仅 opacity-40 虚影，不动 transform）
 * 5. dragStart 即时抑制 + dragEnd 后 500ms 禁用窗口，根治 click 误触发编辑弹窗
 */

export interface DragPayload {
  /** 拖拽的课程对象 */
  course: Course;
  /** 源位置标识（格点模式 "day-week-period"，自由模式 "day-week"） */
  sourceId: string;
  /** 整块拖动时携带的原开始时间（分钟，可选）。提供时按 delta.y 计算新 start_time/end_time */
  originalStartMin?: number;
  /** 整块拖动时携带的时长（分钟，可选） */
  durationMin?: number;
  /** 课程块展示用开始时间（HH:MM，DragOverlay 完整渲染用） */
  startTime?: string;
  /** 课程块展示用结束时间（HH:MM，DragOverlay 完整渲染用） */
  endTime?: string;
}

export interface DropTarget {
  /** 目标位置标识 */
  targetId: string;
  /** 目标星期几 */
  dayOfWeek: number;
  /** 目标节次（格点模式） */
  periodIndex: number | null;
  /** 目标开始时间（自由模式） */
  startTime?: string;
  /** 目标结束时间（自由模式） */
  endTime?: string;
}

interface TimelineDndContextProps {
  children: React.ReactNode;
  /** 拖拽结束回调：将课程移动到新位置 */
  onMoveCourse: (
    course: Course,
    target: DropTarget
  ) => void | Promise<void>;
  /** 自由模式 resize 回调：调整课程结束时间 */
  onResizeCourse?: (
    course: Course,
    newEndTime: string
  ) => void | Promise<void>;
  /** 时间轴每小时像素高度（自由模式 resize 计算） */
  freeHourHeight?: number;
  /** 节次定义（自由模式拖拽时做节次线对齐吸附，可选） */
  periods?: ClassPeriod[];
}

// resize 上下文：暴露 handleResizeStart + 当前 resizing 状态
interface ResizeContextValue {
  handleResizeStart: (course: Course, clientY: number) => void;
  /** 当前正在 resize 的课程及像素偏移（null 表示无 resize） */
  resizing: { course: Course; deltaY: number } | null;
}
const ResizeContext = createContext<ResizeContextValue | null>(null);

// 拖拽状态上下文：暴露当前拖拽信息给 DayColumn（用于原位虚影 + 预览块 + 落点高亮线）
export interface DragStateValue {
  /** 当前拖拽的 payload（null 表示无拖拽） */
  payload: DragPayload | null;
  /** 自由模式实时计算的新时间段（null 表示非自由模式或未悬停在有效目标） */
  freePreview: { startTime: string; endTime: string } | null;
  /** 当前 over 的 drop 目标 */
  overTarget: DropTarget | null;
}
const DragStateContext = createContext<DragStateValue | null>(null);

/**
 * 获取拖拽状态（DayColumn 用于渲染原位虚影 + 预览块 + 落点高亮线）
 */
export function useDragState(): DragStateValue {
  const ctx = useContext(DragStateContext);
  return (
    ctx ?? {
      payload: null,
      freePreview: null,
      overTarget: null,
    }
  );
}

/**
 * 拖拽上下文 Provider
 *
 * 包裹时间轴视图，提供拖拽 + resize 能力。
 * 子组件通过 useDraggableCourse / useDroppableCell / useResizableCourse 接入。
 */
export function TimelineDndContext({
  children,
  onMoveCourse,
  onResizeCourse,
  freeHourHeight = 64,
  periods = [],
}: TimelineDndContextProps) {
  const [activePayload, setActivePayload] = useState<DragPayload | null>(null);
  // activePayload 的 ref 镜像：handleDragEnd / handleDragCancel 从 ref 读取，
  // 避免 React 闭包陈旧问题（dnd-kit 可能在 React 渲染前调用 onDragEnd，
  // 此时 state 闭包中的 activePayload 可能尚未更新）
  const activePayloadRef = useRef<DragPayload | null>(null);
  // 拖拽中实时状态：光标位置 + 当前 over 的 drop 目标 + 自由模式预计时间段
  const [dragCursor, setDragCursor] = useState<{ x: number; y: number } | null>(null);
  const [overTarget, setOverTarget] = useState<DropTarget | null>(null);
  const [freePreview, setFreePreview] = useState<{ startTime: string; endTime: string } | null>(null);
  // resize 状态：记录起始信息
  const resizeState = useRef<{
    course: Course;
    startClientY: number;
    originalEndMin: number;
  } | null>(null);

  // ============================================================
  // 性能优化 ref：缓存上一次值，避免相同值触发 setState 引起重渲染抽搐
  // ============================================================
  const lastOverTargetRef = useRef<DropTarget | null>(null);
  const lastFreePreviewRef = useRef<{ startTime: string; endTime: string } | null>(null);
  const lastDragCursorRef = useRef<{ x: number; y: number } | null>(null);
  // hysteresis 状态：记录当前是否已吸附到某节次，避免边界跳变
  const snappedPeriodStartRef = useRef<number | null>(null);
  // rAF 节流：dragMove 高频回调合并到下一帧
  const rafIdRef = useRef<number | null>(null);
  const pendingMoveRef = useRef<DragMoveEvent | null>(null);

  /**
   * 自由模式拖拽：根据 delta.y 计算新时间段，含 5 分钟吸附 + 节次线对齐（hysteresis 滞后区）
   *
   * 算法：
   * 1. deltaMin = (delta.y / hourHeight) * 60
   * 2. snappedDelta = round(deltaMin / 5) * 5（5 分钟粒度吸附）
   * 3. candidateStart = originalStartMin + snappedDelta，钳制到时间轴范围
   * 4. 节次线对齐（hysteresis）：
   *    - 未吸附状态：candidateStart 距节次起点 <= PERIOD_SNAP_ENTER_MIN(10) 则吸附
   *    - 已吸附状态：需距离 > PERIOD_SNAP_LEAVE_MIN(18) 才脱离
   *    避免光标在边界 10px 抖动时反复吸附/脱离导致预览块抽搐
   *
   * @returns 新时间段 {startTime, endTime}（HH:MM），或 null 表示无法计算
   */
  const computeFreeDragTimes = useCallback(
    (
      payload: DragPayload,
      deltaY: number
    ): { startTime: string; endTime: string } | null => {
      if (
        payload.originalStartMin === undefined ||
        payload.durationMin === undefined
      ) {
        return null;
      }
      const deltaMin = Math.round((deltaY / freeHourHeight) * 60);
      const snappedDelta = Math.round(deltaMin / 5) * 5;
      let clampedStartMin = Math.max(
        TIMELINE_START_MIN,
        Math.min(
          payload.originalStartMin + snappedDelta,
          TIMELINE_END_MIN - payload.durationMin
        )
      );
      // 节次线对齐（hysteresis 滞后区）
      if (periods.length > 0) {
        let nearestPeriodStart: number | null = null;
        let nearestDistance = Infinity;
        for (const p of periods) {
          const pStartMin = timeStrToMinutes(p.start_time);
          const distance = Math.abs(pStartMin - clampedStartMin);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPeriodStart = pStartMin;
          }
        }
        if (nearestPeriodStart !== null) {
          const currentlySnapped = snappedPeriodStartRef.current;
          if (currentlySnapped === nearestPeriodStart) {
            // 已吸附到此节次：需距离 > LEAVE 阈值才脱离
            if (nearestDistance > PERIOD_SNAP_LEAVE_MIN) {
              snappedPeriodStartRef.current = null;
            } else {
              // 保持吸附
              const candidateEnd = nearestPeriodStart + payload.durationMin;
              if (candidateEnd <= TIMELINE_END_MIN) {
                clampedStartMin = nearestPeriodStart;
              }
            }
          } else {
            // 未吸附或吸附到其他节次：距离 <= ENTER 阈值则吸附
            if (nearestDistance <= PERIOD_SNAP_ENTER_MIN) {
              const candidateEnd = nearestPeriodStart + payload.durationMin;
              if (candidateEnd <= TIMELINE_END_MIN) {
                clampedStartMin = nearestPeriodStart;
                snappedPeriodStartRef.current = nearestPeriodStart;
              }
            }
          }
        }
      }
      return {
        startTime: minutesToTimeStr(clampedStartMin),
        endTime: minutesToTimeStr(clampedStartMin + payload.durationMin),
      };
    },
    [freeHourHeight, periods]
  );

  const sensors = useSensors(
    // PointerSensor：统一鼠标/触摸/笔输入，8px 激活阈值避免误触
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    // TouchSensor：触摸专用，延迟 200ms + 8px 移动激活
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    // KeyboardSensor：无障碍支持
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const payload = event.active.data.current?.payload as
      | DragPayload
      | undefined;
    if (payload) {
      setActivePayload(payload);
      // 同步 ref 镜像，供 handleDragEnd / handleDragCancel 读取
      activePayloadRef.current = payload;
      // dragStart 瞬间进入"拖拽中"模式，即时拦截所有 click
      markDragStart();
      // 重置 hysteresis 状态
      snappedPeriodStartRef.current = null;
    }
  }, []);

  /**
   * 拖拽 move 回调（rAF 节流）
   *
   * dnd-kit 的 DragMoveEvent 在 30Hz 触屏上每秒派发 30+ 次，
   * 每次 setState 会触发整棵 Provider 子树重渲染导致抽搐。
   * 用 rAF 合并：只保留最新一次事件，下一帧统一处理。
   *
   * 同时用 ref 缓存对比：若 overTarget / freePreview / cursor
   * 与上一次值相同则跳过 setState，避免无意义重渲染。
   */
  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      pendingMoveRef.current = event;
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const evt = pendingMoveRef.current;
        if (!evt) return;
        pendingMoveRef.current = null;

        const target = evt.over?.data.current?.target as DropTarget | undefined;
        const payload = evt.active.data.current?.payload as
          | DragPayload
          | undefined;

        // 节流 setState：仅在值变化时更新 overTarget
        const newTarget = target ?? null;
        if (
          (lastOverTargetRef.current?.targetId ?? null) !==
          (newTarget?.targetId ?? null)
        ) {
          lastOverTargetRef.current = newTarget;
          setOverTarget(newTarget);
        }

        // 自由模式 + 跨列 drop：实时计算预计时间段（5分钟吸附 + 节次线对齐 hysteresis）
        let newPreview: { startTime: string; endTime: string } | null = null;
        if (
          target &&
          payload &&
          target.periodIndex === null &&
          target.targetId !== payload.sourceId
        ) {
          newPreview = computeFreeDragTimes(payload, evt.delta.y);
        }
        const prev = lastFreePreviewRef.current;
        if (
          (prev?.startTime ?? null) !== (newPreview?.startTime ?? null) ||
          (prev?.endTime ?? null) !== (newPreview?.endTime ?? null)
        ) {
          lastFreePreviewRef.current = newPreview;
          setFreePreview(newPreview);
        }
      });
    },
    [computeFreeDragTimes]
  );

  // 监听全局 pointermove 更新光标位置（dnd-kit 未在 DragMoveEvent 暴露 clientX/Y）
  // 用 rAF 节流，避免 30Hz 触屏每帧 setState 导致浮动气泡重渲染抽搐
  useEffect(() => {
    if (!activePayload) return;
    let rafId: number | null = null;
    const handlePointerMove = (e: PointerEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const newCursor = { x: e.clientX, y: e.clientY };
        const prev = lastDragCursorRef.current;
        if (prev?.x !== newCursor.x || prev?.y !== newCursor.y) {
          lastDragCursorRef.current = newCursor;
          setDragCursor(newCursor);
        }
      });
    };
    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [activePayload]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { over } = event;
      // 从 ref 读取 payload（避免闭包陈旧），同时回退到事件 data
      const payload =
        activePayloadRef.current ??
        ((event.active.data.current?.payload as DragPayload | undefined) ??
          null);
      // 清理拖拽状态
      setActivePayload(null);
      activePayloadRef.current = null;
      setDragCursor(null);
      setOverTarget(null);
      setFreePreview(null);
      // 重置 ref 缓存
      lastOverTargetRef.current = null;
      lastFreePreviewRef.current = null;
      lastDragCursorRef.current = null;
      snappedPeriodStartRef.current = null;
      // 取消挂起的 rAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingMoveRef.current = null;
      // dragEnd 后启动 500ms 禁用窗口，拦截后续合成 click
      markDragEnd();
      if (!over || !payload) return;

      const target = over.data.current?.target as DropTarget | undefined;
      if (!target) return;
      if (payload.sourceId === target.targetId) return;

      // 整块拖动：复用预览计算函数，确保最终落点与预览完全一致（5分钟吸附 + 节次线对齐）
      if (target.periodIndex === null) {
        const times = computeFreeDragTimes(payload, event.delta.y);
        if (times) {
          target.startTime = times.startTime;
          target.endTime = times.endTime;
        }
      }

      onMoveCourse(payload.course, target);
    },
    [onMoveCourse, computeFreeDragTimes]
  );

  /**
   * 拖拽取消处理（ESC 键 / 拖出窗口 / dnd-kit 内部 cancel）
   *
   * dnd-kit 在拖拽被取消时派发 onDragCancel 而非 onDragEnd，
   * 若不处理则 markDragEnd() 不会被调用，500ms 禁用窗口不会启动，
   * 随后的 click 会误触发编辑弹窗。
   */
  const handleDragCancel = useCallback(() => {
    setActivePayload(null);
    activePayloadRef.current = null;
    setDragCursor(null);
    setOverTarget(null);
    setFreePreview(null);
    lastOverTargetRef.current = null;
    lastFreePreviewRef.current = null;
    lastDragCursorRef.current = null;
    snappedPeriodStartRef.current = null;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingMoveRef.current = null;
    // cancel 后同样启动 500ms 禁用窗口
    markDragEnd();
  }, []);

  // resize 手柄：pointerdown 记录起始，pointermove 只更新本地视觉状态，
  // pointerup 时一次性持久化（避免拖动中频繁 API 调用导致抽搐）
  const [resizing, setResizing] = useState<{
    course: Course;
    deltaY: number;
  } | null>(null);
  const lastDeltaYRef = useRef(0);

  const handleResizeStart = useCallback(
    (course: Course, clientY: number) => {
      resizeState.current = {
        course,
        startClientY: clientY,
        originalEndMin: timeStrToMinutes(course.end_time || "22:00"),
      };
      lastDeltaYRef.current = 0;
      setResizing({ course, deltaY: 0 });

      const handleMove = (e: PointerEvent) => {
        if (!resizeState.current) return;
        const deltaY = e.clientY - resizeState.current.startClientY;
        lastDeltaYRef.current = deltaY;
        setResizing({ course: resizeState.current.course, deltaY });
      };

      const handleUp = () => {
        // pointerup 时用 ref 记录的最后一次 deltaY 一次性持久化
        if (resizeState.current && onResizeCourse) {
          const deltaMin = Math.round(
            (lastDeltaYRef.current / freeHourHeight) * 60
          );
          const snappedDelta = Math.round(deltaMin / 5) * 5;
          const startMin = timeStrToMinutes(
            resizeState.current.course.start_time || "08:00"
          );
          const newEndMin = Math.max(
            startMin + 15,
            resizeState.current.originalEndMin + snappedDelta
          );
          const clampedEndMin = Math.min(newEndMin, 22 * 60);
          onResizeCourse(
            resizeState.current.course,
            minutesToTimeStr(clampedEndMin)
          );
        }
        resizeState.current = null;
        setResizing(null);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [onResizeCourse, freeHourHeight]
  );

  // 拖拽状态值（供 useDragState 消费）
  const dragStateValue: DragStateValue = {
    payload: activePayload,
    freePreview,
    overTarget,
  };

  // V2：始终启用 DragOverlay，让用户看到"抓着块在动"
  // 原位置课程块通过 isDragging -> opacity-40 变为虚影，不移动 transform
  // 时间轴上的预览块作为"落点提示"（色条+时间标签），不再渲染完整 CourseBlock
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ResizeContext.Provider value={{ handleResizeStart, resizing }}>
        <DragStateContext.Provider value={dragStateValue}>
          {children}
        </DragStateContext.Provider>
      </ResizeContext.Provider>
      {/* 拖拽 overlay：完整课程块跟随光标（preview 模式，不绑定事件）
          自由模式拖拽时显示 freePreview 实时时间段，让用户看到"抓着块在动" */}
      <DragOverlay dropAnimation={null}>
        {activePayload ? (
          <div className="w-48">
            <CourseBlock
              course={activePayload.course}
              startTime={freePreview?.startTime ?? activePayload.startTime ?? "00:00"}
              endTime={freePreview?.endTime ?? activePayload.endTime ?? "00:00"}
              preview
              freeMode={activePayload.originalStartMin !== undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
      {/* 浮动时间气泡：拖拽中显示预计落点时间/位置，跟随光标 */}
      {activePayload && dragCursor && (
        <DragHintBubble
          cursor={dragCursor}
          target={overTarget}
          payload={activePayload}
          freePreview={freePreview}
        />
      )}
    </DndContext>
  );
}

/**
 * 拖拽浮动提示气泡
 *
 * 跟随光标显示预计落点信息：
 * - 自由模式（periodIndex=null 且 freePreview 存在）：显示新时间段
 * - 格点模式：显示目标星期 + 节次
 * - 未悬停在有效 drop 区：显示"松开取消"
 */
function DragHintBubble({
  cursor,
  target,
  payload,
  freePreview,
}: {
  cursor: { x: number; y: number };
  target: DropTarget | null;
  payload: DragPayload;
  freePreview: { startTime: string; endTime: string } | null;
}) {
  // 计算气泡显示文本
  let hint: string;
  if (!target || target.targetId === payload.sourceId) {
    hint = "松开取消";
  } else if (freePreview) {
    // 自由模式：显示实时计算的新时间段
    hint = `${WEEKDAY_SHORT[target.dayOfWeek] ?? ""} ${freePreview.startTime}-${freePreview.endTime}`;
  } else if (target.periodIndex !== null) {
    hint = `${WEEKDAY_SHORT[target.dayOfWeek] ?? ""} 第${target.periodIndex + 1}节`;
  } else {
    hint = WEEKDAY_SHORT[target.dayOfWeek] ?? "移动";
  }

  // 气泡定位：光标右下偏移 16px，避免遮挡课程块；接近视口右/下边缘时翻转
  const offsetX = 16;
  const offsetY = 16;
  const bubbleWidth = 180;
  const bubbleHeight = 32;
  const flipX = cursor.x + offsetX + bubbleWidth > window.innerWidth;
  const flipY = cursor.y + offsetY + bubbleHeight > window.innerHeight;
  const left = flipX ? cursor.x - offsetX - bubbleWidth : cursor.x + offsetX;
  const top = flipY ? cursor.y - offsetY - bubbleHeight : cursor.y + offsetY;

  return (
    <div
      className="pointer-events-none fixed z-[9999] flex items-center gap-1.5 rounded-md bg-popover/95 px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-lg ring-1 ring-border"
      style={{ left, top }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      {hint}
    </div>
  );
}

/** 可调整时长的课程 hook（自由模式专用） */
export function useResizableCourse(course: Course) {
  const ctx = useContext(ResizeContext);

  const setResizeHandleRef = useCallback(
    (el: HTMLDivElement | null) => {
      // ref 仅用于占位，实际监听通过 onPointerDown 注入
      void el;
    },
    []
  );

  const resizeListeners = {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      ctx?.handleResizeStart(course, e.clientY);
    },
  };

  return {
    setResizeHandleRef,
    resizeListeners,
  };
}

/**
 * 获取当前 resize 状态
 *
 * 供日视图时间轴在拖动过程中实时调整被 resize 课程块的高度，
 * 避免每次 pointermove 都触发 onResizeCourse -> 状态更新 -> 重渲染抽搐。
 */
export function useResizeState() {
  const ctx = useContext(ResizeContext);
  return ctx?.resizing ?? null;
}

/**
 * 可拖拽课程 hook
 *
 * 在 CourseBlock 上调用，注入拖拽 props。
 */
export function useDraggableCourse(payload: DragPayload) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: payload.sourceId,
    data: { payload },
  });

  return {
    dragAttributes: attributes,
    dragListeners: listeners,
    setNodeRef,
    isDragging,
  };
}

/**
 * 可放置单元格 hook
 *
 * 在周视图/日视图的格子上调用，接收拖入的课程。
 */
export function useDroppableCell(target: DropTarget) {
  const { setNodeRef, isOver } = useDroppable({
    id: target.targetId,
    data: { target },
  });

  return {
    setDropNodeRef: setNodeRef,
    isOver,
  };
}

// ============================================================
// 时间字符串与分钟互转（resize / 整块拖动计算用）
// ============================================================

/** 时间轴范围（分钟）：7:00-22:00，与 WeekView 保持一致 */
const TIMELINE_START_MIN = 7 * 60;
const TIMELINE_END_MIN = 22 * 60;

function timeStrToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
