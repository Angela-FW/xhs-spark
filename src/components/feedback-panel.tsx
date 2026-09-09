"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/components/app-store";
import { PendingBanner } from "@/components/dialogue-panel";
import { pillarLabel } from "@/lib/persona";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FeedbackPanel() {
  const { state, submitFeedback } = useAppStore();
  const publishedOrSelected = useMemo(() => {
    const published = state.posts.filter((p) => p.status === "published");
    if (published.length) return published;
    return state.posts.filter((p) => p.id === state.selectedPostId);
  }, [state.posts, state.selectedPostId]);

  const [postId, setPostId] = useState(publishedOrSelected[0]?.id ?? "");
  const [reads, setReads] = useState("");
  const [likes, setLikes] = useState("");
  const [collects, setCollects] = useState("");
  const [comments, setComments] = useState("");
  const [followers, setFollowers] = useState("");
  const [vibe, setVibe] = useState<"strong" | "ok" | "flop">("ok");
  const [commentQuotes, setCommentQuotes] = useState("");
  const [wantMore, setWantMore] = useState("");
  const [wantLess, setWantLess] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = postId || publishedOrSelected[0]?.id;
    if (!id) {
      setError("请先在日历里选一篇，或把某篇标为已发布");
      return;
    }
    setError(null);
    submitFeedback({
      postId: id,
      reads: num(reads),
      likes: num(likes),
      collects: num(collects),
      comments: num(comments),
      followers: num(followers),
      vibe,
      commentQuotes,
      wantMore,
      wantLess,
    });
  }

  return (
    <div className="space-y-4">
      <PendingBanner />
      <form onSubmit={onSubmit} className="studio-shell space-y-4 rounded-2xl p-5">
        <div>
          <h3 className="font-display text-lg text-[var(--ink)]">数据 + 看法</h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            不定期录入小红书数据与你的判断。系统会先改未来规划预览，等你确认。
          </p>
        </div>

        <div className="space-y-2">
          <Label>关联笔记</Label>
          <Select
            value={postId || publishedOrSelected[0]?.id}
            onValueChange={(v) => setPostId(v ?? "")}
          >
            <SelectTrigger className="w-full bg-white/80">
              <SelectValue placeholder="选择笔记" />
            </SelectTrigger>
            <SelectContent>
              {(publishedOrSelected.length
                ? publishedOrSelected
                : state.posts.slice(0, 20)
              ).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  第{p.week}周 · {pillarLabel(p.pillar)} · {p.titleHint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <NumField label="阅读" value={reads} onChange={setReads} />
          <NumField label="点赞" value={likes} onChange={setLikes} />
          <NumField label="收藏" value={collects} onChange={setCollects} />
          <NumField label="评论" value={comments} onChange={setComments} />
          <NumField label="涨粉" value={followers} onChange={setFollowers} />
        </div>

        <div className="space-y-2">
          <Label>主观感受</Label>
          <Select
            value={vibe}
            onValueChange={(v) => setVibe((v as typeof vibe) ?? "ok")}
          >
            <SelectTrigger className="w-full bg-white/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strong">共鸣强</SelectItem>
              <SelectItem value="ok">一般</SelectItem>
              <SelectItem value="flop">翻车/不适</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>评论原话摘录</Label>
          <Textarea
            value={commentQuotes}
            onChange={(e) => setCommentQuotes(e.target.value)}
            className="min-h-20 bg-white/80"
            placeholder="读者怎么说？"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>想加强</Label>
            <Input
              value={wantMore}
              onChange={(e) => setWantMore(e.target.value)}
              className="bg-white/80"
              placeholder="如：面试复盘、双非共鸣"
            />
          </div>
          <div className="space-y-2">
            <Label>想减少</Label>
            <Input
              value={wantLess}
              onChange={(e) => setWantLess(e.target.value)}
              className="bg-white/80"
              placeholder="如：鸡汤、空泛重启"
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-[var(--coral)]" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          className="bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
        >
          生成未来规划预览
        </Button>
      </form>

      {state.feedback.length ? (
        <div className="studio-shell rounded-2xl p-5">
          <h4 className="font-display text-base text-[var(--ink)]">历史反馈</h4>
          <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
            {state.feedback.slice(0, 8).map((f) => (
              <li key={f.id} className="rounded-xl bg-white/60 px-3 py-2">
                {f.createdAt.slice(0, 10)} · {f.vibe} · 阅读 {f.reads ?? "-"} /
                赞 {f.likes ?? "-"} / 藏 {f.collects ?? "-"}
                {f.wantMore ? ` · 加强 ${f.wantMore}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/80"
      />
    </div>
  );
}

function num(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
