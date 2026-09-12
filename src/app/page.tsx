import { PlannerApp } from "@/components/planner-app";

export default function Home() {
  return (
    <main className="flex-1">
      <PlannerApp />
      <footer className="border-t border-[var(--ink-soft)]/10 px-5 py-8 text-center text-xs text-[var(--ink-soft)]">
        重启笔记 · 小红书图文起号 · 选人设、排 4 周路线、生成笔记 ·
        不生成视频
      </footer>
    </main>
  );
}
