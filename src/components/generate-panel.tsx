"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ImageIcon, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import {
  generateNoteFromPost,
  formatFullNote,
  type GeneratedNote,
} from "@/lib/note-gen";
import {
  buildCoverImageUrl,
  buildCoverImageUrlAlt,
  buildCoverPrompt,
  buildImg2ImgUrl,
  editCoverFromFile,
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
  const [draftExtra, setDraftExtra] = useState("");
  const [note, setNote] = useState<GeneratedNote | null>(null);
  const [titleIndex, setTitleIndex] = useState(0);
  const [seed, setSeed] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [useAlt, setUseAlt] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [refUrl, setRefUrl] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"text" | "ref">("text");
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [justGenerated, setJustGenerated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pollinations-key") ?? "";
    setApiKey(saved);
  }, []);

  useEffect(() => {
    setTitleIndex(0);
    setImgError(false);
    setUseAlt(false);
    setSeed(0);
    setResultUrl(null);
    setGenError(null);
    setMode("text");
    setDraftExtra("");
    setJustGenerated(false);
    if (post) {
      setNote(generateNoteFromPost(post, ""));
    } else {
      setNote(null);
    }
  }, [post?.id]);

  useEffect(() => {
    return () => {
      if (refPreview?.startsWith("blob:")) URL.revokeObjectURL(refPreview);
      if (resultUrl?.startsWith("blob:")) URL.revokeObjectURL(resultUrl);
    };
  }, [refPreview, resultUrl]);

  function runGenerateCopy() {
    if (!post) return;
    const next = generateNoteFromPost(post, draftExtra);
    setNote(next);
    setTitleIndex(0);
    setJustGenerated(true);
    window.setTimeout(() => {
      bodyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const textCoverUrl = useMemo(() => {
    if (!post) return "";
    const opts = { seed: seed || undefined, key: apiKey || undefined };
    return useAlt
      ? buildCoverImageUrlAlt(post, opts)
      : buildCoverImageUrl(post, opts);
  }, [post, seed, apiKey, useAlt]);

  const displayUrl =
    mode === "ref" && resultUrl
      ? resultUrl
      : mode === "ref" && refUrl.trim() && post
        ? buildImg2ImgUrl(post, refUrl.trim(), {
            seed: seed || undefined,
            key: apiKey || undefined,
          })
        : textCoverUrl;

  async function onPickFile(file: File | null) {
    if (refPreview?.startsWith("blob:")) URL.revokeObjectURL(refPreview);
    setRefFile(file);
    setResultUrl(null);
    setGenError(null);
    if (!file) {
      setRefPreview(null);
      return;
    }
    setRefPreview(URL.createObjectURL(file));
    setMode("ref");
  }

  async function generateFromReference() {
    if (!post) return;
    setGenError(null);
    setImgError(false);

    // Prefer uploaded file → POST edits
    if (refFile) {
      setBusy(true);
      try {
        const url = await editCoverFromFile(post, refFile, {
          seed: seed || Date.now() % 100000,
          key: apiKey || undefined,
        });
        if (resultUrl?.startsWith("blob:")) URL.revokeObjectURL(resultUrl);
        setResultUrl(url);
        setMode("ref");
      } catch (err) {
        setGenError(err instanceof Error ? err.message : "图生图失败");
      } finally {
        setBusy(false);
      }
      return;
    }

    // Public URL → GET kontext
    if (refUrl.trim()) {
      setMode("ref");
      setResultUrl(null);
      setSeed((s) => s + 1 || Date.now() % 100000);
      return;
    }

    setGenError("请先上传一张参考图，或填写可公网访问的图片链接");
  }

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
            value={draftExtra}
            onChange={(e) => setDraftExtra(e.target.value)}
            className="min-h-24 bg-white/80"
            placeholder="这周真实发生了什么，写完后点下方按钮，会写进正文"
          />
          <p className="text-xs text-[var(--ink-soft)]">
            填写不会自动生效，需点击「生成正文」才会进入文案。
          </p>
        </div>

        <Button
          type="button"
          className="mt-4 h-11 gap-2 bg-[var(--coral)] px-6 text-white hover:bg-[var(--coral-deep)]"
          onClick={runGenerateCopy}
        >
          <Sparkles className="size-4" />
          {justGenerated ? "重新生成正文" : "生成正文"}
        </Button>
      </div>

      <div ref={bodyRef} className="studio-shell rounded-2xl p-5">
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
          <h4 className="font-display text-base text-[var(--ink)]">
            正文（可直接复制发笔记）
          </h4>
          <CopyBtn text={note.body} />
        </div>
        {justGenerated ? (
          <p className="mb-2 text-xs text-[var(--coral)]">已按你的补充重新生成</p>
        ) : null}
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
              variant={mode === "text" ? "default" : "outline"}
              className={
                mode === "text"
                  ? "bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
                  : ""
              }
              onClick={() => {
                setMode("text");
                setImgError(false);
              }}
            >
              纯文生图
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSeed((s) => s + 1 || Date.now() % 100000);
                setImgError(false);
                if (mode === "ref" && refFile) void generateFromReference();
              }}
            >
              <RefreshCw className="size-3.5" />
              换一张
            </Button>
            <CopyBtn text={buildCoverPrompt(post)} label="复制提示词" />
          </div>
        </div>

        <p className="text-xs text-[var(--ink-soft)]">
          可纯文字生成，或上传你的照片/实拍图，按当前笔记主题做图生图。免费接口可能限流；上传图生图失败时可填
          API Key。
        </p>

        <div className="mt-4 rounded-xl border border-dashed border-[var(--ink-soft)]/25 bg-white/55 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--ink)]">参考图（可选）</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-3.5" />
                上传图片
              </Button>
              {(refFile || refPreview || refUrl) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onPickFile(null);
                    setRefUrl("");
                    setMode("text");
                  }}
                >
                  <X className="size-3.5" />
                  清除
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {refPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={refPreview}
              alt="参考图预览"
              className="mt-3 max-h-40 rounded-lg object-contain"
            />
          ) : null}

          <div className="mt-3 space-y-2">
            <Label htmlFor="refurl">或填写公网图片链接</Label>
            <Input
              id="refurl"
              value={refUrl}
              onChange={(e) => {
                setRefUrl(e.target.value);
                if (e.target.value.trim()) setMode("ref");
              }}
              className="bg-white/80"
              placeholder="https://…（可选，与上传二选一即可）"
            />
          </div>

          <Button
            type="button"
            className="mt-3 bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
            disabled={busy}
            onClick={() => void generateFromReference()}
          >
            {busy ? "基于参考图生成中…" : "基于参考图生成封面"}
          </Button>
          {genError ? (
            <p className="mt-2 text-sm text-[var(--coral)]" role="alert">
              {genError}
            </p>
          ) : null}
        </div>

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
            placeholder="可留空；上传图生图若失败再填"
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl bg-white/70">
          {busy ? (
            <div className="px-4 py-16 text-center text-sm text-[var(--ink-soft)]">
              正在按参考图生成，请稍候…
            </div>
          ) : imgError ? (
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
              key={displayUrl}
              src={displayUrl}
              alt="生成的封面图"
              className="mx-auto max-h-[480px] w-full object-contain"
              onError={() => {
                if (mode === "text" && !useAlt) {
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
