"use client";

import { useState } from "react";
import { useAppStore } from "@/components/app-store";
import { processInsights, recommendPostsForInsight } from "@/lib/insights";
import { pillarLabel } from "@/lib/persona";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function InsightInbox() {
  const { state, addInsights, assignInsight } = useAppStore();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentWeek = inferCurrentWeek(state.calendarStart);

  function onProcess() {
    if (!raw.trim()) {
      setError("先粘贴一段近期感悟");
      return;
    }
    setError(null);
    const cards = processInsights(raw);
    if (!cards.length) {
      setError("没有识别到可用片段，试着多写几句或分段");
      return;
    }
    addInsights(cards);
    setRaw("");
  }

  return (
    <div className="space-y-5">
      <div className="studio-shell rounded-2xl p-5">
        <h3 className="font-display text-lg text-[var(--ink)]">感悟收件箱</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          不定期粘贴零散想法。我会拆条，按小红书爆款文风润色，并推荐到近期更相关的笔记。
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="insight-raw">近期感悟</Label>
          <Textarea
            id="insight-raw"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="例如：今天下午改简历改到烦，总觉得双非三个字像盖章……"
            className="min-h-32 bg-white/80"
          />
        </div>
        {error ? (
          <p className="mt-2 text-sm text-[var(--coral)]" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          className="mt-4 bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
          onClick={onProcess}
        >
          整理并入库
        </Button>
      </div>

      {!state.insights.length ? (
        <div className="empty-panel rounded-2xl px-6 py-10 text-center text-sm text-[var(--ink-soft)]">
          还没有感悟。贴一段真实想法过来即可。
        </div>
      ) : (
        <ul className="space-y-4">
          {state.insights.map((insight) => {
            const recs = recommendPostsForInsight(
              insight,
              state.posts,
              currentWeek,
            );
            return (
              <li key={insight.id} className="studio-shell rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--coral)]">
                  <span>{pillarLabel(insight.pillar)}</span>
                  {insight.desensitizeNote ? (
                    <span className="text-amber-700">{insight.desensitizeNote}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">原话：{insight.raw}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">
                  润色：{insight.polished}
                </p>
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-[var(--ink)]">推荐挂到</p>
                  {recs.map(({ post, reason }) => (
                    <div
                      key={post.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm"
                    >
                      <span className="text-[var(--ink)]">
                        第{post.week}周 · {post.titleHint}
                      </span>
                      <span className="text-xs text-[var(--ink-soft)]">{reason}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        disabled={insight.assignedPostIds.includes(post.id)}
                        onClick={() => assignInsight(insight.id, post.id)}
                      >
                        {insight.assignedPostIds.includes(post.id)
                          ? "已挂载"
                          : "采纳到该篇"}
                      </Button>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function inferCurrentWeek(calendarStart: string): number {
  const start = new Date(`${calendarStart}T00:00:00`);
  const today = new Date();
  const diffDays = Math.max(
    0,
    Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  return Math.floor(diffDays / 7) + 1;
}
