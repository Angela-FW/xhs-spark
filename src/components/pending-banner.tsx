"use client";

import { useAppStore } from "@/components/app-store";
import { describePending } from "@/lib/calibrate";
import { Button } from "@/components/ui/button";

/** Shared preview banner for pending calendar calibrations (e.g. feedback). */
export function PendingBanner() {
  const { state, confirmPending, discardPending, undoCalibration } = useAppStore();
  if (!state.pending && !state.snapshots[0]) return null;

  return (
    <div className="space-y-3">
      {state.pending ? (
        <div className="rounded-2xl border border-[var(--coral)]/40 bg-[var(--coral)]/8 p-4">
          <p className="text-sm font-medium text-[var(--ink)]">改版预览（待你确认）</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--ink-soft)]">
            {describePending(state.pending)}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
              onClick={confirmPending}
            >
              确认应用
            </Button>
            <Button type="button" variant="outline" onClick={discardPending}>
              放弃
            </Button>
          </div>
        </div>
      ) : null}
      {state.snapshots[0] ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
          <span>最近已确认：{state.snapshots[0].summary}</span>
          <Button type="button" size="sm" variant="ghost" onClick={undoCalibration}>
            撤销最近一次
          </Button>
        </div>
      ) : null}
    </div>
  );
}
