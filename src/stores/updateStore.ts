/**
 * 更新状态 Store（SPEC 7.6）
 *
 * 跨组件共享强制更新状态：
 * - UpdateManager 启动检查检测到强制更新时设置 forceStatus
 * - UpdateSection 手动检查检测到强制更新时设置 forceStatus
 * - UpdateManager 监听 forceStatus 渲染全屏阻断弹窗
 */

import { create } from "zustand";
import type { UpdateStatus } from "@/lib/tauri";

interface UpdateStore {
  /** 强制更新状态（非 null 时触发全屏阻断弹窗） */
  forceStatus: UpdateStatus | null;
  /** 设置/清除强制更新状态 */
  setForceStatus: (status: UpdateStatus | null) => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  forceStatus: null,
  setForceStatus: (status) => set({ forceStatus: status }),
}));
