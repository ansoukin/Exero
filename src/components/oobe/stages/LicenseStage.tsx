/**
 * OOBE 阶段：MIT 许可证协议（重启前）
 *
 * 致敬 Windows EULA：用户需勾选"同意"才能继续
 * 使用 Switch 组件替代原生 checkbox，与程序 UI/UX 风格统一
 */

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { useOobeStore } from "@/stores/oobe";
import { OobeShell } from "../OobeWizard";
import { Switch } from "@/components/ui/switch";

const MIT_LICENSE_TEXT = `MIT License

Copyright (c) 2026 Exero

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export function LicenseStage() {
  const next = useOobeStore((s) => s.next);
  const goTo = useOobeStore((s) => s.goTo);
  const [agreed, setAgreed] = useState(false);

  return (
    <OobeShell
      stage="license"
      title="许可证协议"
      subtitle="请阅读以下开源协议条款，同意后继续"
      canNext={agreed}
      onNext={next}
      onBack={() => goTo("splash")}
    >
      <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-border/50 bg-card/50 p-6 scrollbar-fluent">
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
          {MIT_LICENSE_TEXT}
        </pre>
      </div>
      {/* 同意协议开关（Switch 风格，与设置页开关统一） */}
      <div
        onClick={() => setAgreed(!agreed)}
        className="flex cursor-pointer items-center justify-between rounded-2xl border border-border/50 bg-card/50 p-5 transition-colors duration-200 hover:border-primary/30"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className={agreed ? "h-5 w-5 text-primary" : "h-5 w-5 text-muted-foreground"} />
          <div>
            <p className="text-sm font-medium">我已阅读并同意</p>
            <p className="mt-0.5 text-xs text-muted-foreground">MIT 开源许可证条款</p>
          </div>
        </div>
        {/* Switch 点击时阻止冒泡，避免与外层卡片 onClick 冲突导致状态相互抵消 */}
        <div onClick={(e) => e.stopPropagation()}>
          <Switch checked={agreed} onCheckedChange={setAgreed} />
        </div>
      </div>
    </OobeShell>
  );
}
