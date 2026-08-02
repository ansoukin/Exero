/**
 * 表单字段更新工具
 *
 * 提供 immutability 友好的字段更新函数，避免在每个表单中重复展开运算符。
 */

/** 更新单个字段 */
export function updateField<T extends Record<string, unknown>>(
  params: T,
  key: keyof T,
  value: unknown,
): T {
  return { ...params, [key]: value };
}

/** 更新多个字段（浅合并） */
export function updateFields<T extends Record<string, unknown>>(
  params: T,
  updates: Partial<T>,
): T {
  return { ...params, ...updates };
}

/** 字符串字段变更助手（从 input event 提取 value） */
export function strValue(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): string {
  return e.target.value;
}

/** 数字字段变更助手（NaN 时返回 0） */
export function numValue(e: React.ChangeEvent<HTMLInputElement>): number {
  const n = Number(e.target.value);
  return Number.isNaN(n) ? 0 : n;
}

/** 复选框变更助手 */
export function boolValue(e: React.ChangeEvent<HTMLInputElement>): boolean {
  return e.target.checked;
}
