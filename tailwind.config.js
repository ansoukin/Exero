/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Win11 8 色主题色板（Phase 6 主题切换时使用，Phase 2 默认 blue 作为 primary）
        win: {
          blue: "hsl(var(--win-blue))",
          green: "hsl(var(--win-green))",
          orange: "hsl(var(--win-orange))",
          purple: "hsl(var(--win-purple))",
          red: "hsl(var(--win-red))",
          cyan: "hsl(var(--win-cyan))",
          pink: "hsl(var(--win-pink))",
          yellow: "hsl(var(--win-yellow))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // 页面切换淡入（opacity + translateY 均为合成层属性，30Hz 兼容）
        "page-fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "page-fade-in": "page-fade-in 200ms ease-out",
      },
      // SPEC 3.1：8px 网格系统，圆角 6-8px，200ms 动画过渡（兼容 30Hz 屏幕）
      spacing: {
        "18": "4.5rem",
      },
      // 默认过渡时长 200ms（SPEC 3.1），覆盖 Tailwind 默认 150ms
      transitionDuration: {
        DEFAULT: "200ms",
        "200": "200ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
