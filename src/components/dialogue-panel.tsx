"use client";

import { useState } from "react";
import { useAppStore } from "@/components/app-store";
import { describePending } from "@/lib/calibrate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

export function DialoguePanel() {
  const { state, sendDialogue } = useAppStore();
  const [text, setText] = useState("");

  function onSend() {
    if (!text.trim()) return;
    sendDialogue(text.trim());
    setText("");
  }

  const shortcuts = [
    "下周多写面试复盘",
    "少一点鸡汤式重启叙事",
    "这两周改成每周4篇",
    "更干货、少情绪",
    "未来一个月先别碰 offer",
  ];

  return (
    <div className="space-y-4">
      <PendingBanner />
      <div className="studio-shell flex h-[min(70vh,640px)] flex-col rounded-2xl p-4 sm:p-5">
        <h3 className="font-display text-lg text-[var(--ink)]">对话校准</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          用自然语言改未来规划。系统先出预览，你确认后才写入。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {shortcuts.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-md bg-white/70 px-2.5 py-1 text-xs text-[var(--ink-soft)] hover:text-[var(--coral)]"
              onClick={() => setText(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl bg-white/50 p-3">
          {state.chat.map((m) => (
            <div
              key={m.id}
              className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${
                m.role === "user"
                  ? "ml-auto bg-[var(--coral)] text-white"
                  : "bg-white text-[var(--ink)]"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入校准指令…"
            className="min-h-14 bg-white/80"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            type="button"
            className="self-end bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
            onClick={onSend}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
