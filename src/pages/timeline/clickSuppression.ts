/**
 * 拖拽/长按事件后的 click 拦截工具（V2.2：双击触发编辑 + 禁用窗口）
 *
 * 问题背景：
 * 浏览器事件顺序 pointerdown -> pointerup -> click。
 * dnd-kit PointerSensor 激活阈值 8px，未达阈值时 pointerup 仍会派发 click，
 * 误触发 CourseBlock.onClick -> 打开编辑弹窗。
 * 长按 500ms 触发后 pointerup 重置 isLongPress，随后 click 也误触发。
 *
 * V2.2 方案（当前，从根源解决）：
 * 1. CourseBlock.onClick 改为双击触发（300ms 内两次点击才打开编辑弹窗）
 *    → 拖拽/长按后的合成 click 只是"第一次点击"，不会触发编辑
 * 2. 本模块作为第一道防线：dragStart 瞬间进入"拖拽中"模式拦截所有 click
 * 3. dragEnd 后启动 500ms 禁用窗口，窗口内 click 仍被拦截（额外保险）
 * 4. 双击检测（CourseBlock 内部）作为第二道防线
 *
 * 双保险架构：shouldHandleClick() 拦截拖拽期间的 click，
 * 双击检测拦截拖拽后的合成 click，两者互补确保零误触发。
 */

/** 拖拽禁用窗口时长（ms）：dragEnd / longPress 后保持拦截的时间 */
const SUPPRESS_WINDOW_MS = 500;

/** 拖拽中标记（dragStart 置 true，dragEnd 置 false） */
let isDragging = false;
/** 禁用窗口到期时间戳（0 表示无窗口）；在此时间之前所有 click 都被拦截 */
let suppressUntil = 0;

/**
 * 标记拖拽开始（dragStart 瞬间调用）
 * 进入"拖拽中"模式，期间所有 click 全部拦截
 */
export function markDragStart(): void {
  isDragging = true;
  // dragStart 也启动禁用窗口作为保险（虽然 isDragging 已拦截）
  suppressUntil = Date.now() + SUPPRESS_WINDOW_MS;
}

/**
 * 标记拖拽结束（dragEnd 调用）
 * 退出"拖拽中"模式，但启动 500ms 禁用窗口拦截后续合成 click
 */
export function markDragEnd(): void {
  isDragging = false;
  // 启动 500ms 禁用窗口，拦截 dragEnd 后浏览器派发的合成 click
  suppressUntil = Date.now() + SUPPRESS_WINDOW_MS;
}

/**
 * 长按触发时调用（启动 500ms 禁用窗口）
 * 兼容旧 API，内部等价于 markDragEnd 的窗口逻辑
 */
export function suppressNextClick(): void {
  suppressUntil = Date.now() + SUPPRESS_WINDOW_MS;
}

/**
 * 检查 click 是否应放行
 *
 * 拦截条件（满足任一即拦截）：
 * 1. isDragging === true（拖拽进行中）
 * 2. Date.now() < suppressUntil（在禁用窗口内）
 *
 * 注意：不再自动复位 isDragging，由 markDragEnd 显式复位；
 * suppressUntil 是时间戳自然过期，无需手动复位。
 *
 * @returns true 放行 onClick，false 拦截
 */
export function shouldHandleClick(): boolean {
  // 拖拽中：拦截所有 click
  if (isDragging) {
    return false;
  }
  // 禁用窗口内：拦截
  if (Date.now() < suppressUntil) {
    return false;
  }
  return true;
}

/**
 * 检查当前是否处于拖拽中或禁用窗口内（供调试/状态查询用）
 */
export function isClickSuppressed(): boolean {
  return isDragging || Date.now() < suppressUntil;
}
