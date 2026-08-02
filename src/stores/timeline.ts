import { create } from "zustand";

/**
 * 时间轴视图模式（SPEC V2 修订：日/周/月/年四级递进）
 * - day：日视图（默认，纵向时间轴 7:00-22:00 + 节次虚线，拖拽改时间/时长）
 * - week：周视图（7 天×节次网格，传统课表形态，点击钻取日视图）
 * - month：月视图（6×7 日历方格）
 * - year：年视图（12 月方格 + 密度色深）
 *
 * 变更说明：原 V2 为周/月/年三级，周视图承载时间轴。
 * 实测周视图 7 列时间轴拖拽在列边界存在 collision 鬼畜 bug，
 * 且 7 列时间轴信息密度过高。修订为：日视图承载时间轴拖拽，
 * 周视图及以上改为网格视图，专精信息总览，拖拽编辑集中在日视图。
 */
export type TimelineView = "day" | "week" | "month" | "year";

interface TimelineState {
  /** 当前视图 */
  view: TimelineView;
  /** 当前选中的学期 ID */
  activeSemesterId: string | null;
  /** 当前周次（1-based，学期内第几周） */
  currentWeek: number;
  /** 当前选中的周模板 ID（NULL = 普通周默认模板） */
  activeTemplateId: string | null;
  /** 选中日期（ISO "2026-07-22"），月视图聚焦用 */
  selectedDate: string;
  /** 年视图当前显示年份 */
  currentYear: number;
  /** 月视图当前显示年月（month=0..11） */
  currentMonth: number;

  setView: (view: TimelineView) => void;
  setActiveSemester: (id: string | null) => void;
  setCurrentWeek: (week: number) => void;
  setActiveTemplate: (id: string | null) => void;
  setSelectedDate: (date: string) => void;
  setCurrentYear: (year: number) => void;
  setCurrentMonth: (month: number) => void;
  /** 周次往前一周（不低于 1） */
  prevWeek: () => void;
  /** 周次往后一周（不超过 totalWeeks，由调用方传入） */
  nextWeek: (totalWeeks: number) => void;
}

/** 今日 ISO 日期（本地时区） */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  view: "day",
  activeSemesterId: null,
  currentWeek: 1,
  activeTemplateId: null,
  selectedDate: todayIso(),
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),

  setView: (view) => set({ view }),
  setActiveSemester: (activeSemesterId) => set({ activeSemesterId }),
  setCurrentWeek: (currentWeek) => set({ currentWeek }),
  setActiveTemplate: (activeTemplateId) => set({ activeTemplateId }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setCurrentYear: (currentYear) => set({ currentYear }),
  setCurrentMonth: (currentMonth) => set({ currentMonth }),
  prevWeek: () => set((s) => ({ currentWeek: Math.max(1, s.currentWeek - 1) })),
  nextWeek: (totalWeeks) =>
    set((s) => ({ currentWeek: Math.min(totalWeeks, s.currentWeek + 1) })),
}));
