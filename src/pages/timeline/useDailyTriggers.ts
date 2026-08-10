/**
 * 日常模式数据加载 hook（Beta6 Phase 4）
 *
 * 从后端加载所有 flow 及其触发器，过滤出含 Cron 触发器的 flow。
 * 数据加载与日期无关，提供 getBlocksForDate 方法按需解析指定日期的触发块，
 * 供日/周/月/年四视图共享同一份数据。
 *
 * 数据流：
 * 1. flowCommands.list() 获取所有快捷指令（一次性）
 * 2. 对每个 flow 调用 triggerCommands.list(flowId) 获取触发器（一次性）
 * 3. 过滤出含 Cron 触发器的 flow（用户需求：无时间触发器的 flow 不显示）
 * 4. getBlocksForDate(date) 调用 flowToTriggerBlocks 按需解析（纯函数）
 */

import { useEffect, useState, useCallback } from "react";

import { flowCommands, triggerCommands, type AutomationFlow, type Trigger } from "@/lib/tauri";
import { flowToTriggerBlocks, type TriggerBlock } from "./dailyTypes";

/** 日常模式数据状态 */
interface DailyTriggersState {
  /** 所有含 Cron 触发器的 flow（用于右键菜单展示信息） */
  flowsWithCron: AutomationFlow[];
  /** flow ID -> triggers 映射（仅含 Cron 触发器的 flow） */
  flowTriggersMap: Map<string, Trigger[]>;
  /** 加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新数据 */
  refresh: () => void;
  /** 基于已加载数据解析指定日期的触发块（纯函数，按时间排序） */
  getBlocksForDate: (date: string) => TriggerBlock[];
}

/**
 * 加载日常模式触发数据（不依赖日期）
 *
 * @param refreshKey 刷新键（变化时重新加载）
 * @returns 数据状态 + refresh 函数 + getBlocksForDate 解析方法
 */
export function useDailyTriggers(refreshKey: number = 0): DailyTriggersState {
  const [flowsWithCron, setFlowsWithCron] = useState<AutomationFlow[]>([]);
  const [flowTriggersMap, setFlowTriggersMap] = useState<Map<string, Trigger[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalRefresh, setInternalRefresh] = useState(0);

  const refresh = useCallback(() => {
    setInternalRefresh((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 1. 获取所有快捷指令
        const allFlows = await flowCommands.list();

        // 2. 并行获取每个 flow 的触发器
        const flowTriggerPairs = await Promise.all(
          allFlows.map(async (flow) => {
            try {
              const triggers = await triggerCommands.list(flow.id);
              return { flow, triggers };
            } catch (e) {
              console.error(`[daily] 加载 flow ${flow.id} 触发器失败:`, e);
              return { flow, triggers: [] as Trigger[] };
            }
          })
        );

        // 3. 过滤出含 Cron 触发器的 flow（用户需求：无时间触发器不显示）
        const cronFlows: AutomationFlow[] = [];
        const triggersMap = new Map<string, Trigger[]>();
        for (const { flow, triggers } of flowTriggerPairs) {
          const hasCron = triggers.some((t) => t.trigger_type.kind === "Cron");
          if (hasCron) {
            cronFlows.push(flow);
            triggersMap.set(flow.id, triggers);
          }
        }

        if (cancelled) return;

        setFlowsWithCron(cronFlows);
        setFlowTriggersMap(triggersMap);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, internalRefresh]);

  // 纯函数：基于已加载数据解析指定日期的触发块（按时间排序）
  const getBlocksForDate = useCallback(
    (date: string): TriggerBlock[] => {
      const allBlocks: TriggerBlock[] = [];
      for (const flow of flowsWithCron) {
        const triggers = flowTriggersMap.get(flow.id) || [];
        const flowBlocks = flowToTriggerBlocks(flow, triggers, date);
        allBlocks.push(...flowBlocks);
      }
      allBlocks.sort((a, b) => a.minutes - b.minutes);
      return allBlocks;
    },
    [flowsWithCron, flowTriggersMap]
  );

  return {
    flowsWithCron,
    flowTriggersMap,
    loading,
    error,
    refresh,
    getBlocksForDate,
  };
}
