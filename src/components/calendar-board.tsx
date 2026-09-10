"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/components/app-store";
import { phaseLabel, pillarLabel } from "@/lib/persona";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CalendarBoard() {
  const { state, setSelectedPostId } = useAppStore();
  const [phase, setPhase] = useState<number>(0);
  const [weekJump, setWeekJump] = useState(1);

  const phaseFilter = [
    { id: 0, label: "全部" },
    ...state.persona.phases.map((p) => ({ id: p.id, label: p.label })),
  ];

  const weeks = useMemo(() => {
    const map = new Map<number, typeof state.posts>();
    for (const p of state.posts) {
      if (phase && p.phase !== phase) continue;
      const list = map.get(p.week) ?? [];
      list.push(p);
      map.set(p.week, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [state.posts, phase]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {phaseFilter.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={phase === p.id ? "default" : "outline"}
            className={
              phase === p.id
                ? "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
                : ""
            }
            onClick={() => setPhase(p.id)}
          >
            {p.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <span>跳到第</span>
          <input
            type="number"
            min={1}
            max={52}
            value={weekJump}
            onChange={(e) => setWeekJump(Number(e.target.value) || 1)}
            className="h-8 w-16 rounded-md border border-[var(--ink-soft)]/20 bg-white/80 px-2"
          />
          <span>周</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              document
                .getElementById(`week-${weekJump}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            前往
          </Button>
        </div>
      </div>

      <p className="text-sm text-[var(--ink-soft)]">
        起点 {state.calendarStart} · 内容阶段非公历季度 · 点选笔记后可去「生成」出文案与封面图
      </p>

      <div className="space-y-5">
        {weeks.map(([week, posts]) => {
          const meta = state.weekMeta.find((w) => w.week === week);
          return (
            <section
              key={week}
              id={`week-${week}`}
              className="studio-shell rounded-2xl p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base text-[var(--ink)]">
                  第 {week} 周
                </h3>
                <span className="text-xs text-[var(--ink-soft)]">
                  {posts[0]?.weekStart}
                </span>
                <Badge variant="secondary">
                  {phaseLabel(posts[0]?.phase ?? 1, state.persona)}
                </Badge>
                <Badge variant="outline">
                  规划 {meta?.postsPerWeek ?? posts.length} 篇/周
                </Badge>
              </div>
              <ul className="grid gap-2 md:grid-cols-2">
                {posts
                  .slice()
                  .sort((a, b) => a.indexInWeek - b.indexInWeek)
                  .map((post) => {
                    const selected = state.selectedPostId === post.id;
                    return (
                      <li key={post.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedPostId(post.id)}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            selected
                              ? "border-[var(--coral)] bg-[var(--coral)]/8"
                              : "border-transparent bg-white/60 hover:border-[var(--ink-soft)]/15"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs text-[var(--coral)]">
                            <span>{pillarLabel(post.pillar)}</span>
                            <span className="text-[var(--ink-soft)]">
                              {post.format === "tips"
                                ? "干货"
                                : post.format === "emotion"
                                  ? "情绪"
                                  : "故事"}
                            </span>
                            <span className="ml-auto text-[var(--ink-soft)]">
                              {post.status === "published"
                                ? "已发布"
                                : post.status === "drafted"
                                  ? "已起草"
                                  : "待写"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
                            {post.titleHint}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-soft)]">
                            {post.angle}
                            {post.materials.length
                              ? ` · 素材 ${post.materials.length}`
                              : ""}
                          </p>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
