import { CopyStudio } from "@/components/copy-studio";

export default function Home() {
  return (
    <main className="flex-1">
      <CopyStudio />
      <footer className="border-t border-[var(--ink-soft)]/10 px-5 py-8 text-center text-xs text-[var(--ink-soft)]">
        爆文工坊 · 本地模板生成，可直接复制到小红书发布 · 请根据真实体验改写后再发
      </footer>
    </main>
  );
}
