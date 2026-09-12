"use client";

import { useMemo } from "react";
import { useAppStore } from "@/components/app-store";
import { useAuth } from "@/components/auth-provider";
import { pillarLabel } from "@/lib/persona";
import { Button } from "@/components/ui/button";

export function CalendarBoard({
  onOpenGenerate,
}: {
  onOpenGenerate: (postId: string) => void;
}) {
  const { state, setSelectedPostId, generateMoreWeek } = useAppStore();
  const { requireAuth } = useAuth();

  const weeks = useMemo(() => {
    const map = new Map<number, typeof state.posts>();
    for (const p of state.posts) {
      const list = map.get(p.week) ?? [];
      list.push(p);
      map.set(p.week, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [state.posts]);

  const absoluteMaxWeek = useMemo(
    () => state.posts.reduce((max, post) => Math.max(max, post.week), 0),
    [state.posts],
  );
  const frontierVisible = weeks.some(([week]) => week === absoluteMaxWeek);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--ink-soft)]">
        未来 4 周起号路径 · 未发布笔记按天自动顺延 · 点「生成」打开文案页 · 可往后翻继续规划
      </p>

      <div className="space-y-5">
        {weeks.map(([week, posts]) => {
          const weekDate =
            posts.find((p) => p.status !== "published")?.weekStart ??
            posts[0]?.weekStart;
          const isFrontier = week === absoluteMaxWeek;
          return (
            <section
              key={`${week}-${weekDate}-${state.persona.presetId}`}
              id={`week-${week}`}
              className="studio-shell rounded-2xl p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base text-[var(--ink)]">
                  第 {week} 周
                </h3>
                <span className="text-xs text-[var(--ink-soft)]">{weekDate}</span>
              </div>
              <ul className="grid gap-2 md:grid-cols-2">
                {posts
                  .slice()
                  .sort((a, b) => a.indexInWeek - b.indexInWeek)
                  .map((post) => {
                    const selected = state.selectedPostId === post.id;
                    return (
                      <li key={post.id}>
                        <div
                          className={`rounded-xl border px-3 py-3 transition ${
                            selected
                              ? "border-[var(--coral)] bg-[var(--coral)]/8"
                              : "border-transparent bg-white/60 hover:border-[var(--ink-soft)]/15"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedPostId(post.id)}
                            className="w-full text-left"
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
                                  ? post.publishedAt
                                    ? `已发布 ${post.publishedAt}`
                                    : "已发布"
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
                          {post.status !== "published" ? (
                            <div className="mt-2 flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void (async () => {
                                    if (!(await requireAuth())) return;
                                    onOpenGenerate(post.id);
                                  })();
                                }}
                              >
                                生成
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-2 flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenGenerate(post.id);
                                }}
                              >
                                查看
                              </Button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ul>
              {isFrontier ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => generateMoreWeek()}
                  >
                    生成下一周
                  </Button>
                </div>
              ) : null}
            </section>
          );
        })}
        {!frontierVisible ? (
          <div className="flex flex-col items-center gap-3">
            {weeks.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">还没有周计划</p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => generateMoreWeek()}
            >
              生成下一周
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
