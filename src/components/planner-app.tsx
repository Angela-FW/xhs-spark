"use client";

import { useEffect, useRef, useState } from "react";
import { AppStoreProvider, useAppStore } from "@/components/app-store";
import { CalendarBoard } from "@/components/calendar-board";
import { InsightInbox } from "@/components/insight-inbox";
import { DialoguePanel } from "@/components/dialogue-panel";
import { FeedbackPanel } from "@/components/feedback-panel";
import { GeneratePanel } from "@/components/generate-panel";
import { PERSONA } from "@/lib/persona";
import { Button } from "@/components/ui/button";

const TABS = [
  { id: "calendar", label: "日历" },
  { id: "insights", label: "感悟" },
  { id: "dialogue", label: "对话" },
  { id: "feedback", label: "校准" },
  { id: "generate", label: "生成" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function PlannerInner() {
  const [tab, setTab] = useState<TabId>("calendar");
  const { exportJson, importJson, resetAll, state } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative">
      <header className="hero-panel relative overflow-hidden px-5 pb-8 pt-8 sm:px-8 sm:pt-10">
        <div className="hero-glow" aria-hidden />
        <div className="hero-grain" aria-hidden />
        <div
          className={`mx-auto max-w-3xl transition-all duration-700 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <p className="brand-mark text-4xl tracking-wide sm:text-5xl">重启笔记</p>
          <h1 className="font-display mt-3 text-xl text-[var(--ink)] sm:text-2xl">
            文案 + 一年规划，按反馈校准
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
            {PERSONA.age}岁 · {PERSONA.education} · {PERSONA.stage}
            。从 {state.calendarStart} 起排内容阶段；生成小红书文案与免费封面图，不生成视频。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const blob = new Blob([exportJson()], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `restart-planner-backup-${state.calendarStart}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              导出备份
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              导入备份
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const a = document.createElement("a");
                a.href = "/app-icon.png";
                a.download = "重启笔记图标.png";
                a.click();
              }}
            >
              下载桌面图标
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm("确定清空本地规划并恢复种子日历？")) resetAll();
              }}
            >
              重置
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  importJson(await file.text());
                } catch {
                  alert("导入失败，请检查备份文件");
                }
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <nav className="studio-shell sticky top-2 z-20 -mt-2 mb-5 flex gap-1 overflow-x-auto rounded-2xl p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm transition ${
                tab === t.id
                  ? "bg-[var(--coral)] text-white"
                  : "text-[var(--ink-soft)] hover:bg-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="pb-16">
          {tab === "calendar" ? <CalendarBoard /> : null}
          {tab === "insights" ? <InsightInbox /> : null}
          {tab === "dialogue" ? <DialoguePanel /> : null}
          {tab === "feedback" ? <FeedbackPanel /> : null}
          {tab === "generate" ? <GeneratePanel /> : null}
        </div>
      </div>
    </div>
  );
}

export function PlannerApp() {
  return (
    <AppStoreProvider>
      <PlannerInner />
    </AppStoreProvider>
  );
}
