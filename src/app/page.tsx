import { PlannerApp } from "@/components/planner-app";

export default function Home() {
  return (
    <main className="flex-1">
      <PlannerApp />
      <footer className="border-t border-[var(--ink-soft)]/10 px-5 py-8 text-center text-xs text-[var(--ink-soft)]">
        重启笔记 · 数据存于本机浏览器 · 可导出备份 · 封面图可用 Cloudflare 每日免费额度 ·
        不生成视频
      </footer>
    </main>
  );
}
