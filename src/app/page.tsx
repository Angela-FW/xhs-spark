import { PlannerApp } from "@/components/planner-app";

export default function Home() {
  return (
    <main className="flex-1">
      <PlannerApp />
      <footer className="border-t border-[var(--ink-soft)]/10 px-5 py-8 text-center text-xs text-[var(--ink-soft)]">
        重启笔记 · 随便逛无需登录 · 点「生成」再注册 · 登录后同步规划与每人自己的 Key ·
        不生成视频
      </footer>
    </main>
  );
}
