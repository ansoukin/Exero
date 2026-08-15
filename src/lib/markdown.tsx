/**
 * 共享 Markdown 渲染组件映射（Beta9 · 任务8）
 *
 * 用于 ReactMarkdown 的 components prop，统一 Release Notes 等内容的渲染风格。
 * 风格：shadcn/ui + Tailwind，主题色跟随 CSS 变量。
 *
 * 抽取自 AboutSection，供 ChangelogPage 二级页面复用，避免重复实现。
 */
import type { Components } from "react-markdown";

export const markdownComponents: Components = {
  h1: ({ node, ...props }) => (
    <h1 className="mb-2 mt-3 text-base font-semibold text-foreground" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold text-foreground" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mb-1.5 mt-2 text-sm font-semibold text-foreground" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="mb-1 mt-2 text-sm font-medium text-foreground" {...props} />
  ),
  h5: ({ node, ...props }) => (
    <h5 className="mb-1 mt-2 text-xs font-medium text-foreground" {...props} />
  ),
  h6: ({ node, ...props }) => (
    <h6 className="mb-1 mt-2 text-xs font-medium text-muted-foreground" {...props} />
  ),
  p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
  a: ({ node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    />
  ),
  ul: ({ node, ...props }) => (
    <ul className="mb-2 ml-5 list-disc space-y-0.5" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="mb-2 ml-5 list-decimal space-y-0.5" {...props} />
  ),
  li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground"
      {...props}
    />
  ),
  hr: ({ node, ...props }) => <hr className="my-3 border-border" {...props} />,
  strong: ({ node, ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  del: ({ node, ...props }) => <del className="line-through" {...props} />,
  code: ({ node, className, children, ...props }) => {
    const isInline = !className?.includes("language-");
    return isInline ? (
      <code
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code className="font-mono text-[0.85em]" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ node, ...props }) => (
    <pre
      className="my-2 overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-xs"
      {...props}
    />
  ),
  table: ({ node, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-muted/50" {...props} />,
  th: ({ node, ...props }) => (
    <th className="border border-border px-2 py-1 text-left font-medium" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border border-border px-2 py-1" {...props} />
  ),
  img: ({ node, alt, ...props }) => (
    <img alt={alt ?? ""} className="my-2 max-w-full rounded-md" {...props} />
  ),
};
