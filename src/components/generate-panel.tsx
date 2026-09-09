"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ImageIcon, RefreshCw } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { generateNoteFromPost, formatFullNote } from "@/lib/note-gen";
import {
  buildCoverImageUrl,
  buildCoverImageUrlAlt,
  buildCoverPrompt,
} from "@/lib/cover-image";
import { pillarLabel, phaseLabel } from "@/lib/persona";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "已复制" : label ?? "复制"}
    </Button>
  );
}

export function GeneratePanel() {
  const { state, setPostStatus } = useAppStore();
  const post = state.posts.find((p) => p.id === state.selectedPostId) ?? null;
  const [extra, setExtra] = useState("");
  const [titleIndex, setTitleIndex] = useState(0);
  const [seed, setSeed] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [useAlt, setUseAlt] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("pollinations-key") ?? "";
    setApiKey(saved);
  }, []);

  useEffect(() => {
    setTitleIndex(0);
    setImgError(false);
    setUseAlt(false);
    setSeed(0);
  }, [post?.id]);

  const note = useMemo(
    () => (post ? generateNoteFromPost(post, extra) : null),
    [post, extra],
  );

  const coverUrl = useMemo(() => {
    if (!post) return "";
    const opts = { seed: seed || undefined, key: apiKey || undefined };
    return useAlt
      ? buildCoverImageUrlAlt(post, opts)
      : buildCoverImageUrl(post, opts);
  }, [post, seed, apiKey, useAlt]);

  if (!post || !note) {
    return (
      <div className="empty-panel rounded-2xl px-6 py-12 text-center text-sm text-[var(--ink-soft)]">
        先在「日历」里点选一篇笔记，再回来生成文案与封面图。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="studio-shell rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--coral)]">
              第{post.week}周 · {phaseLabel(post.phase)} · {pillarLabel(post.pillar)}
            </p>
            <h3 className="font-display mt-1 text-lg text-[var(--ink)]">
              {post.titleHint}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{post.angle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPostStatus(post.id, "drafted")}
            >
              标为已起草
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
              onClick={() => setPostStatus(post.id, "published")}
            >
              标为已发布
            </Button>
          </div>
        </div>

        {post.materials.length ? (
          <ul className="mt-3 space-y-1 text-xs text-[var(--ink-soft)]">
            {post.materials.map((m) => (
              <li key={m.id}>素材：{m.polished}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 space-y-2">
          <Label htmlFor="extra">补充当下情况（可选）</Label>
          <Textarea
            id="extra"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            className="min-h-20 bg-white/80"
            placeholder="这周真实发生了什么，可写进正文"
          />
        </div>
      </div>

      <div className="studio-shell rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="font-display text-base text-[var(--ink)]">标题备选</h4>
          <CopyBtn text={formatFullNote(note, titleIndex)} label="复制整篇" />
        </div>
        <ul className="space-y-2">
          {note.titles.map((t, i) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => setTitleIndex(i)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${
                  titleIndex === i
                    ? "border-[var(--coral)] bg-[var(--coral)]/8"
                    : "border-transparent bg-white/60"
                }`}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="studio-shell rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-display text-base text-[var(--ink)]">正文</h4>
          <CopyBtn text={note.body} />
        </div>
        <pre className="whitespace-pre-wrap rounded-xl bg-white/70 p-4 text-sm leading-7 text-[var(--ink)]">
          {note.body}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-[var(--coral)]/10 px-2 py-1 text-xs text-[var(--coral-deep)]"
            >
              {tag}
            </span>
          ))}
          <CopyBtn text={note.tags.join(" ")} label="复制标签" />
        </div>
      </div>

      <div className="studio-shell rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display text-base text-[var(--ink)]">封面生图</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSeed((s) => s + 1 || Date.now() % 100000);
                setImgError(false);
              }}
            >
              <RefreshCw className="size-3.5" />
              换一张
            </Button>
            <CopyBtn text={buildCoverPrompt(post)} label="复制提示词" />
          </div>
        </div>
        <p className="text-xs text-[var(--ink-soft)]">
          默认使用 Pollinations 免费接口（无需服务器）。额度紧张时可在下方填可选
          API Key。不含视频成片。
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor="pkey">Pollinations API Key（可选）</Label>
          <Input
            id="pkey"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              localStorage.setItem("pollinations-key", e.target.value);
            }}
            className="bg-white/80"
            placeholder="可留空；有 Key 时写入本地浏览器"
          />
        </div>
        <div className="mt-4 overflow-hidden rounded-xl bg-white/70">
          {imgError ? (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-sm text-[var(--ink-soft)]">
              <ImageIcon className="size-8 opacity-50" />
              <p>图片加载失败（免费接口可能限流）。可换一张，或改用备用线路。</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setUseAlt((v) => !v);
                  setImgError(false);
                }}
              >
                切换备用线路
              </Button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={coverUrl}
              src={coverUrl}
              alt="生成的封面图"
              className="mx-auto max-h-[480px] w-full object-contain"
              onError={() => {
                if (!useAlt) {
                  setUseAlt(true);
                  setImgError(false);
                } else {
                  setImgError(true);
                }
              }}
            />
          )}
        </div>
        <ul className="mt-3 space-y-1 text-xs text-[var(--ink-soft)]">
          {note.coverIdeas.map((idea) => (
            <li key={idea}>· {idea}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
