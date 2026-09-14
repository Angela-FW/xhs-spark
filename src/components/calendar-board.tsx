"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/components/app-store";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SwipeDeleteRow } from "@/components/swipe-delete-row";
import { pillarLabel } from "@/lib/persona";
import { weekStartForWeek } from "@/lib/year-calendar";
import { Button } from "@/components/ui/button";

export function CalendarBoard({
  onOpenGenerate,
}: {
  onOpenGenerate: (postId: string) => void;
}) {
  const { state, setSelectedPostId, generateMoreWeek, deletePost } = useAppStore();
  const { requireAuth } = useAuth();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
      <div className="space-y-5">
        {weeks.map(([week, posts]) => {
          const weekDate =
            posts.find((p) => p.status !== "published")?.weekStart ??
            posts[0]?.weekStart ??
            weekStartForWeek(state.calendarStart, week);
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
                    const statusLabel =
                      post.status === "published"
                        ? post.publishedAt
                          ? `已发布 ${post.publishedAt}`
                          : "已发布"
                        : post.status === "drafted"
                          ? "已起草"
                          : "待写";
                    const openNote = async () => {
                      if (post.status !== "published" && !(await requireAuth())) {
                        return;
                      }
                      onOpenGenerate(post.id);
                    };
                    const actionLabel =
                      post.status === "published"
                        ? "查看"
                        : post.status === "drafted"
                          ? "继续"
                          : "生成";
                    const actionClass =
                      post.status === "published"
                        ? ""
                        : "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]";
                    return (
                      <li key={post.id}>
                        <SwipeDeleteRow onDelete={() => setPendingDeleteId(post.id)}>
                        <div
                          className={`rounded-xl border px-3 py-2.5 transition ${
                            selected
                              ? "border-[var(--coral)] bg-[var(--coral)]/8"
                              : "border-transparent bg-white/60 hover:border-[var(--ink-soft)]/15"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedPostId(post.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--coral)]">
                                <span>{pillarLabel(post.pillar)}</span>
                                <span className="text-[var(--ink-soft)]">
                                  {post.format === "tips"
                                    ? "干货"
                                    : post.format === "emotion"
                                      ? "情绪"
                                      : "故事"}
                                </span>
                                <span className="text-[var(--ink-soft)]">
                                  {statusLabel}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-medium text-[var(--ink)]">
                                {post.titleHint}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--ink-soft)]">
                                {post.angle}
                                {post.materials.length
                                  ? ` · 素材 ${post.materials.length}`
                                  : ""}
                              </p>
                            </button>
                            <Button
                              type="button"
                              size="xs"
                              variant={
                                post.status === "published" ? "outline" : "default"
                              }
                              className={`mt-0.5 hidden shrink-0 rounded-[8px] sm:inline-flex ${actionClass}`}
                              onClick={() => void openNote()}
                            >
                              {actionLabel}
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant={
                              post.status === "published" ? "outline" : "default"
                            }
                            className={`mt-3 h-10 w-full rounded-[8px] sm:hidden ${actionClass}`}
                            onClick={() => void openNote()}
                          >
                            {actionLabel}
                          </Button>
                        </div>
                        </SwipeDeleteRow>
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
      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="确定删除这篇笔记？"
        message={"删除后不可恢复。"}
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        onConfirm={() => {
          if (pendingDeleteId) deletePost(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
