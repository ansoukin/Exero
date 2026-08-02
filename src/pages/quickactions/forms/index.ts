/**
 * 节点参数表单注册中心（Phase 4 可视化编辑器属性面板）
 *
 * 每种 ActionType 注册一个专属表单组件，根据选中节点的 kind 动态渲染。
 * 表单只负责 params 字段编辑，容错策略 / 备注等公共字段在 PropertyPanel 统一处理。
 */

import type { ComponentType } from "react";

import type { ActionTypeKind } from "@/lib/tauri";

import { AppFileForms } from "@/pages/quickactions/forms/appFile";
import { MediaInputForms } from "@/pages/quickactions/forms/mediaInput";
import { SystemPowerForms } from "@/pages/quickactions/forms/systemPower";
import { NotificationForms } from "@/pages/quickactions/forms/notification";
import { ControlFlowForms } from "@/pages/quickactions/forms/controlFlow";
import { LuaScriptForm } from "@/pages/quickactions/forms/luaScript";

/** 表单组件公共 Props */
export interface ActionFormProps {
  /** 当前节点参数 */
  params: Record<string, unknown>;
  /** 参数变更回调（整体替换） */
  onChange: (params: Record<string, unknown>) => void;
}

/** 表单组件类型 */
export type ActionFormComponent = ComponentType<ActionFormProps>;

/**
 * 表单注册表：kind → 表单组件
 *
 * 聚合 6 类 20 种表单，未注册的 kind 在 PropertyPanel 中回退到 JSON 编辑器。
 */
export const ActionFormRegistry: Partial<Record<ActionTypeKind, ActionFormComponent>> = {
  // 应用与文件
  ...AppFileForms,
  // 媒体与输入
  ...MediaInputForms,
  // 系统与电源
  ...SystemPowerForms,
  // 通知
  ...NotificationForms,
  // 控制流
  ...ControlFlowForms,
  // Lua 脚本
  LuaScript: LuaScriptForm,
};
