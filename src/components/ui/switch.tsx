import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Switch 开关组件（轻量实现，不依赖 @radix-ui/react-switch）
 *
 * SPEC 3.1：200ms 动画过渡，触控目标 ≥ 48px（轨道高度 24px + padding）。
 * 用原生 input checkbox + peer 样式实现，无障碍友好。
 */
export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  /** 是否选中 */
  checked: boolean;
  /** 切换回调 */
  onCheckedChange: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <label
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
          checked ? "bg-primary" : "bg-input",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          {...props}
        />
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
