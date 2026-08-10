/**
 * 日常模式数据层（Beta6 Phase 4）
 *
 * 日常模式时间轴的数据结构与 cron 解析逻辑。
 * 仅渲染含 Cron 触发器的快捷指令，按时间定位显示只读块。
 *
 * 数据流：
 * 1. 遍历所有 flow，调用 triggerCommands.list(flowId) 拿触发器
 * 2. 过滤 trigger_type.kind === "Cron" 的触发器
 * 3. 解析 cron 表达式，计算在指定日期的触发时间
 * 4. 转换为 TriggerBlock 渲染数据
 */

import { CronExpressionParser } from "cron-parser";
import type { AutomationFlow, Trigger } from "@/lib/tauri";

/** Cron 触发器参数（镜像 Rust CronTriggerParams） */
interface CronTriggerParams {
  /** Cron 表达式（5 字段：分 时 日 月 周） */
  expression: string;
  /** 时区（IANA 标识，null 用系统时区） */
  timezone: string | null;
}

/** 日常模式时间轴触发块（渲染用） */
export interface TriggerBlock {
  /** 块唯一标识（trigger.id + 触发时间，避免重复） */
  id: string;
  /** 所属快捷指令 ID */
  flowId: string;
  /** 快捷指令名称 */
  flowName: string;
  /** 快捷指令图标（lucide 图标名，null 用默认） */
  flowIcon: string | null;
  /** 快捷指令颜色（hex 或 tailwind 色名，null 用默认） */
  flowColor: string | null;
  /** 触发器 ID */
  triggerId: string;
  /** 触发时间（HH:mm 格式，如 "12:00"） */
  time: string;
  /** 触发时间在当天的分钟数（0-1439，用于定位） */
  minutes: number;
  /** 触发器是否启用 */
  enabled: boolean;
}

/** 日视图时间范围（与校园模式 DayView 一致：7:00-22:00） */
export const DAILY_START_MIN = 7 * 60;
export const DAILY_END_MIN = 22 * 60;
export const DAILY_TOTAL_MIN = DAILY_END_MIN - DAILY_START_MIN;
/** 每小时像素高度（与校园模式 DayView 一致：56px） */
export const DAILY_HOUR_HEIGHT = 56;
/** 时间轴总高度 */
export const DAILY_TOTAL_HEIGHT = (DAILY_TOTAL_MIN / 60) * DAILY_HOUR_HEIGHT;

/**
 * 从 Trigger.params 解析 CronTriggerParams
 *
 * Cron 触发器的 params 是 JSON 对象：{ expression: "0 12 * * *", timezone: null }
 */
function parseCronParams(trigger: Trigger): CronTriggerParams | null {
  if (trigger.trigger_type.kind !== "Cron") return null;
  const params = trigger.params as Partial<CronTriggerParams>;
  if (!params.expression) return null;
  return {
    expression: params.expression,
    timezone: params.timezone ?? null,
  };
}

/**
 * 解析 cron 表达式，计算在指定日期的所有触发时间
 *
 * 使用 cron-parser 库遍历表达式，筛选出在 startMin-endMin 范围内的时间。
 * 仅计算「分 时」字段，「日 月 周」字段影响是否在当天触发。
 *
 * @param expression cron 表达式（5 字段）
 * @param date 目标日期（YYYY-MM-DD）
 * @param startMin 时间轴起始分钟（默认 7:00 = 420）
 * @param endMin 时间轴结束分钟（默认 22:00 = 1320）
 * @returns 触发时间数组（HH:mm 格式），当天无触发返回空数组
 */
export function parseCronTimes(
  expression: string,
  date: string,
  startMin: number = DAILY_START_MIN,
  endMin: number = DAILY_END_MIN
): string[] {
  try {
    // cron-parser 的 parseExpression 接受 5 字段表达式
    // 使用当前日期作为起点，遍历接下来 24 小时的触发时间
    const [year, month, day] = date.split("-").map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59);

    const interval = CronExpressionParser.parse(expression, {
      currentDate: startOfDay,
      endDate: endOfDay,
      tz: undefined, // 使用系统时区
    });

    const times: string[] = [];
    while (true) {
      try {
        const next = interval.next();
        const h = next.getHours();
        const m = next.getMinutes();
        const minutes = h * 60 + m;
        // 仅保留在时间轴范围内的触发
        if (minutes >= startMin && minutes <= endMin) {
          times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
      } catch {
        break; // 遍历结束
      }
    }
    return times;
  } catch (e) {
    console.error("[daily] cron 表达式解析失败:", expression, e);
    return [];
  }
}

/**
 * 将 flow + triggers 转换为 TriggerBlock 列表
 *
 * 过滤逻辑：仅处理 Cron 触发器（其他类型不渲染在时间轴）
 *
 * @param flow 快捷指令
 * @param triggers 该 flow 的所有触发器
 * @param date 目标日期（YYYY-MM-DD）
 * @returns 触发块数组（可能为空，如果当天无触发）
 */
export function flowToTriggerBlocks(
  flow: AutomationFlow,
  triggers: Trigger[],
  date: string
): TriggerBlock[] {
  const blocks: TriggerBlock[] = [];

  for (const trigger of triggers) {
    const cronParams = parseCronParams(trigger);
    if (!cronParams) continue; // 非 Cron 触发器，跳过

    const times = parseCronTimes(cronParams.expression, date);
    for (const time of times) {
      const [h, m] = time.split(":").map(Number);
      const minutes = h * 60 + m;
      blocks.push({
        id: `${trigger.id}-${time}`,
        flowId: flow.id,
        flowName: flow.name,
        flowIcon: flow.icon,
        flowColor: flow.color,
        triggerId: trigger.id,
        time,
        minutes,
        enabled: trigger.enabled && flow.enabled,
      });
    }
  }

  return blocks;
}

/**
 * 计算触发块在时间轴上的垂直位置（top 像素）
 *
 * @param minutes 触发时间（当天分钟数）
 * @returns top 像素值
 */
export function blockTopPx(minutes: number): number {
  return ((minutes - DAILY_START_MIN) / 60) * DAILY_HOUR_HEIGHT;
}
