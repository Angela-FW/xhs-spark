"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ImageIcon, RefreshCw, Sparkles } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { useAuth } from "@/components/auth-provider";
import { CoverKeysModal } from "@/components/cover-keys-modal";
import {
  generateNoteFromPost,
  generateTitleCandidates,
  formatFullNote,
  type GeneratedNote,
} from "@/lib/note-gen";
import { generateNoteBodyForPost } from "@/lib/note-ai";
import {
  buildCoverPrompt,
  generateCoverImage,
} from "@/lib/cover-image";
import {
  canGenerateAiCover,
  hasUsableCoverKeys,
  loadCoverKeys,
  toCoverCredentials,
} from "@/lib/cover-keys";
import { composeTypographicCover, parseCoverBrief } from "@/lib/cover-compose";
import { pillarLabel, phaseLabel } from "@/lib/persona";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";

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

export function GeneratePanel({ onClose }: { onClose?: () => void }) {
  const { state, setPostStatus, saveDraft } = useAppStore();
  const { requireAuth } = useAuth();
  const post = state.posts.find((p) => p.id === state.selectedPostId) ?? null;
  const [draftExtra, setDraftExtra] = useState("");
  const [note, setNote] = useState<GeneratedNote | null>(null);
  const [titleIndex, setTitleIndex] = useState(0);
  const [titleSeed, setTitleSeed] = useState(0);
  const [bodySeed, setBodySeed] = useState(0);
  const [seed, setSeed] = useState(0);
  const [coverPrompt, setCoverPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bodyBusy, setBodyBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [bodyHint, setBodyHint] = useState<string | null>(null);
  const [justGenerated, setJustGenerated] = useState(false);
  const [keysModalOpen, setKeysModalOpen] = useState(false);
  const [pendingCoverSeed, setPendingCoverSeed] = useState<number | null>(null);
  const [keysReady, setKeysReady] = useState(() => hasUsableCoverKeys());
  const [confirmPublish, setConfirmPublish] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyReqId = useRef(0);
  const requireAuthRef = useRef(requireAuth);
  requireAuthRef.current = requireAuth;

  useEffect(() => {
    const sync = () => setKeysReady(canGenerateAiCover(loadCoverKeys()));
    sync();
    window.addEventListener("restart-cover-keys", sync);
    return () => window.removeEventListener("restart-cover-keys", sync);
  }, []);

  useEffect(() => {
    setTitleSeed(0);
    setBodySeed(0);
    setSeed(0);
    setResultUrl(null);
    setGenError(null);
    setBodyHint(null);
    setJustGenerated(false);
    setBodyBusy(false);
    const reqId = ++bodyReqId.current;

    const hasSavedBody = Boolean(post?.draft?.titles?.length && post.draft.body?.trim());
    if (hasSavedBody && post?.draft) {
      setNote({
        titles: post.draft.titles,
        body: post.draft.body,
        tags: post.draft.tags,
        coverIdeas: [],
        coverPrompt: "",
      });
      setTitleIndex(post.draft.titleIndex ?? 0);
      setDraftExtra(post.draft.extra ?? "");
      setCoverPrompt("");
      return;
    }

    if (!post) {
      setNote(null);
      setTitleIndex(0);
      setDraftExtra("");
      setCoverPrompt("");
      return;
    }

    const shell = generateNoteFromPost(post, state.persona, post.draft?.extra ?? "");
    const keepTitles =
      post.draft?.titles?.length ? post.draft.titles : shell.titles;
    setNote({ ...shell, titles: keepTitles, body: "" });
    setTitleIndex(post.draft?.titleIndex ?? 0);
    setDraftExtra(post.draft?.extra ?? "");
    setCoverPrompt("");
    setBodyBusy(true);
    setBodyHint("正在用模型生成正文…");

    const title =
      keepTitles[post.draft?.titleIndex ?? 0] ?? keepTitles[0] ?? post.titleHint;
    const persona = state.persona;
    const extra = post.draft?.extra ?? "";
    const postRef = post;

    void (async () => {
      if (!(await requireAuthRef.current())) {
        if (reqId !== bodyReqId.current) return;
        setNote({ ...shell, titles: keepTitles });
        setBodyBusy(false);
        setBodyHint("未登录，暂用本地草稿；登录后可点「生成正文」用模型重写");
        return;
      }
      try {
        const { note: next, result } = await generateNoteBodyForPost(
          postRef,
          persona,
          extra,
          title,
          0,
          keepTitles,
        );
        if (reqId !== bodyReqId.current) return;
        setNote(next);
        setJustGenerated(true);
        if (result.source === "ai") {
          setBodyHint(
            result.attempts > 1
              ? `已用模型生成（第 ${result.attempts} 次成功）`
              : "已用模型生成",
          );
        } else {
          setBodyHint(
            `模型连续 ${result.attempts} 次失败，已改用本地模板${
              result.error ? `：${result.error}` : ""
            }`,
          );
        }
      } finally {
        if (reqId === bodyReqId.current) setBodyBusy(false);
      }
    })();
  }, [post?.id, state.persona]);

  useEffect(() => {
    return () => {
      if (resultUrl?.startsWith("blob:")) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  function persistAndClose() {
    if (post && note) {
      saveDraft(post.id, {
        titles: note.titles,
        titleIndex,
        body: note.body,
        tags: note.tags,
        extra: draftExtra,
      });
    }
    onClose?.();
  }

  const selectedTitle =
    note?.titles[titleIndex] ?? note?.titles[0] ?? post?.titleHint ?? "";

  function updateTitle(index: number, value: string) {
    setNote((prev) => {
      if (!prev) return prev;
      const titles = prev.titles.map((t, i) => (i === index ? value : t));
      return { ...prev, titles };
    });
    setTitleIndex(index);
  }

  async function applyBodyForTitle(title: string, nextBodySeed: number) {
    if (!post) return;
    if (!(await requireAuth())) return;
    const reqId = ++bodyReqId.current;
    setBodyBusy(true);
    setBodyHint("正在生成正文…");
    setGenError(null);
    try {
      const { note: next, result } = await generateNoteBodyForPost(
        post,
        state.persona,
        draftExtra,
        title,
        nextBodySeed,
        note?.titles,
      );
      if (reqId !== bodyReqId.current) return;
      setNote(next);
      setJustGenerated(true);
      if (result.source === "ai") {
        setBodyHint(
          result.attempts > 1
            ? `已用模型生成（第 ${result.attempts} 次成功）`
            : "已用模型生成",
        );
      } else {
        setBodyHint(
          `模型连续 ${result.attempts} 次失败，已改用本地模板${
            result.error ? `：${result.error}` : ""
          }`,
        );
      }
      window.setTimeout(() => {
        bodyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } finally {
      if (reqId === bodyReqId.current) setBodyBusy(false);
    }
  }

  function selectTitle(index: number) {
    if (!post || !note) {
      setTitleIndex(index);
      return;
    }
    if (index === titleIndex) return;
    const title = note.titles[index] ?? selectedTitle;
    setTitleIndex(index);
    const nextBodySeed = bodySeed + 1;
    setBodySeed(nextBodySeed);
    void applyBodyForTitle(title, nextBodySeed);
  }

  function runGenerateCopy() {
    if (!post || bodyBusy) return;
    const nextBodySeed = bodySeed + 1;
    setBodySeed(nextBodySeed);
    void applyBodyForTitle(selectedTitle, nextBodySeed);
  }

  function regenerateTitles() {
    if (!post) return;
    setTitleSeed((prevSeed) => {
      const nextSeed = prevSeed + 1;
      setNote((prev) => {
        if (!prev) return prev;
        // Do not pin the current title — otherwise #1 never changes and
        // several template slots ignore seed, so only #2 appears to refresh.
        const titles = generateTitleCandidates(post, state.persona, nextSeed);
        return { ...prev, titles };
      });
      setTitleIndex(0);
      return nextSeed;
    });
  }

  const autoCoverPrompt = useMemo(() => {
    if (!post || !note) return "";
    return [
      "Xiaohongshu vertical cover 3:4",
      `title: ${selectedTitle || post.titleHint}`,
      `theme: ${post.angle}`,
      `body cues: ${note.body.replace(/\s+/g, " ").slice(0, 160)}`,
      "warm paper tones, coral accent, realistic lifestyle photo, no text overlay, no watermark",
    ].join(", ");
  }, [post, note, selectedTitle]);

  const activePrompt = coverPrompt.trim() || autoCoverPrompt;

  async function generateCover(nextSeed?: number) {
    if (!post) return;
    if (!(await requireAuth())) return;
    setGenError(null);

    const promptToUse = coverPrompt.trim() || autoCoverPrompt;
    if (!promptToUse) {
      setGenError("请先生成正文，或填写提示词");
      return;
    }

    const brief = parseCoverBrief(promptToUse);
    // Structured 内容/风格/颜色 → local typography（不走文生图，无需 Key）
    if (brief.wantsText && brief.contentItems.length > 0) {
      const useSeed = nextSeed ?? (seed || Date.now() % 100000);
      setSeed(useSeed);
      setBusy(true);
      try {
        const url = await composeTypographicCover(brief, {
          title: selectedTitle || post.titleHint,
        });
        if (resultUrl?.startsWith("blob:")) URL.revokeObjectURL(resultUrl);
        setResultUrl(url);
      } catch (err) {
        setGenError(err instanceof Error ? err.message : "封面合成失败");
      } finally {
        setBusy(false);
      }
      return;
    }

    // AI 文生图：必须用当前用户自己的 Key
    const creds = toCoverCredentials(loadCoverKeys());
    if (!canGenerateAiCover(creds)) {
      setPendingCoverSeed(nextSeed ?? null);
      setKeysModalOpen(true);
      return;
    }

    const useSeed = nextSeed ?? (seed || Date.now() % 100000);
    setSeed(useSeed);
    setBusy(true);

    try {
      const url = await generateCoverImage(post, {
        seed: useSeed,
        prompt: promptToUse,
        credentials: creds,
      });
      if (resultUrl?.startsWith("blob:")) URL.revokeObjectURL(resultUrl);
      setResultUrl(url);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "生图失败");
    } finally {
      setBusy(false);
    }
  }

  if (!post || !note) {
    return (
      <div className="space-y-4">
        {onClose ? (
          <div className="studio-shell sticky top-2 z-20 -mt-2 flex items-center gap-3 rounded-2xl p-2">
            <Button type="button" size="sm" variant="outline" onClick={persistAndClose}>
              ← 返回笔记日历
            </Button>
          </div>
        ) : null}
        <div className="empty-panel rounded-2xl px-6 py-12 text-center text-sm text-[var(--ink-soft)]">
          先在「笔记日历」里点选一篇笔记，再回来生成文案与封面图。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CoverKeysModal
        open={keysModalOpen}
        onClose={() => {
          setKeysModalOpen(false);
          setPendingCoverSeed(null);
        }}
        onConfigured={() => {
          setKeysReady(true);
          const seedToUse = pendingCoverSeed;
          setPendingCoverSeed(null);
          void generateCover(seedToUse ?? undefined);
        }}
      />
      {onClose ? (
        <div className="studio-shell sticky top-2 z-20 -mt-2 flex items-center justify-between gap-3 rounded-2xl p-2">
          <Button type="button" size="sm" variant="outline" onClick={persistAndClose}>
            ← 返回日历
          </Button>
          <p className="truncate text-sm text-[var(--ink-soft)]">
            关闭时自动保存草稿
          </p>
          <Button
            type="button"
            size="sm"
            className="bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
            onClick={persistAndClose}
          >
            保存并返回
          </Button>
        </div>
      ) : null}
      <div className="studio-shell rounded-2xl p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-display text-base text-[var(--ink)]">标题备选</h4>
            <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
              点选一条作为当前标题；也可直接改字。换标题或点「重新生成正文」都会按当前标题重写。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={regenerateTitles}>
              <RefreshCw className="size-3.5" />
              重新生成标题
            </Button>
            <CopyBtn text={formatFullNote(note, titleIndex)} label="复制整篇" />
          </div>
        </div>
        <ul className="space-y-2">
          {note.titles.map((t, i) => (
            <li key={i}>
              <div
                className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${
                  titleIndex === i
                    ? "border-[var(--coral)] bg-[var(--coral)]/8"
                    : "border-transparent bg-white/60"
                }`}
              >
                <button
                  type="button"
                  aria-label={`选用标题 ${i + 1}`}
                  onClick={() => selectTitle(i)}
                  className={`size-4 shrink-0 rounded-full border ${
                    titleIndex === i
                      ? "border-[var(--coral)] bg-[var(--coral)]"
                      : "border-[var(--ink-soft)]/40 bg-white"
                  }`}
                />
                <Input
                  value={t}
                  onFocus={() => {
                    if (i !== titleIndex) selectTitle(i);
                  }}
                  onChange={(e) => updateTitle(i, e.target.value)}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div ref={bodyRef} className="studio-shell rounded-2xl p-5">
        <div className="studio-shell rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--coral)]">
              第{post.week}周 · {phaseLabel(post.phase, state.persona)} ·{" "}
              {pillarLabel(post.pillar)}
            </p>
            <h3 className="font-display mt-1 text-lg text-[var(--ink)]">
              {selectedTitle || post.titleHint}
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{post.angle}</p>
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
          disabled={bodyBusy}
          onClick={runGenerateCopy}
        >
          <Sparkles className="size-4" />
          {bodyBusy
            ? "生成中…"
            : justGenerated
              ? "重新生成正文"
              : "生成正文"}
        </Button>
      </div>

      <div className="mb-3 flex items-center justify-between">
          <h4 className="font-display text-base text-[var(--ink)]">
            正文
          </h4>
          <CopyBtn text={note.body} />
        </div>
        {bodyHint ? (
          <p className="mb-2 text-xs text-[var(--coral)]">{bodyHint}</p>
        ) : justGenerated ? (
          <p className="mb-2 text-xs text-[var(--coral)]">
            已按当前标题重写正文（含你的补充）
          </p>
        ) : null}
        {bodyBusy && !note.body ? (
          <div className="rounded-xl bg-white/70 p-4 text-sm leading-7 text-[var(--ink-soft)]">
            模型正在写正文，稍等几秒…
          </div>
        ) : (
          <pre className="whitespace-pre-wrap rounded-xl bg-white/70 p-4 text-sm leading-7 text-[var(--ink)]">
            {note.body}
          </pre>
        )}        <div className="mt-3 flex flex-wrap gap-2">
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
              disabled={busy}
              onClick={() => {
                const next = (seed || Date.now() % 100000) + 1;
                void generateCover(next);
              }}
            >
              <RefreshCw className="size-3.5" />
              换一张
            </Button>
            <CopyBtn
              text={activePrompt || buildCoverPrompt(post)}
              label="复制提示词"
            />
          </div>
        </div>

        <p className="mb-4 text-xs text-[var(--ink-soft)]">
          {keysReady
            ? "已配置你的生图 Key（登录后跨设备同步）。"
            : "生图需填写你自己的 Key；登录后会同步到账号，不占用别人额度。"}{" "}
          <button
            type="button"
            className="text-[var(--coral-deep)] underline-offset-2 hover:underline"
            onClick={() => setKeysModalOpen(true)}
          >
            {hasUsableCoverKeys() ? "修改 Key" : "配置 Key"}
          </button>
        </p>

        <div className="space-y-2 rounded-xl border border-[var(--coral)]/25 bg-[var(--coral)]/5 p-4">
          <Label htmlFor="cover-prompt" className="text-sm font-medium text-[var(--ink)]">
            图片提示词（可选）
          </Label>
          <Textarea
            id="cover-prompt"
            value={coverPrompt}
            onChange={(e) => setCoverPrompt(e.target.value)}
            className="min-h-32 bg-white"
            placeholder="可留空。留空时将根据当前标题和正文自动匹配生成封面…"
          />
        </div>

        <Button
          type="button"
          className="mt-4 h-11 w-full bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)] sm:w-auto sm:px-8"
          disabled={busy}
          onClick={() => void generateCover()}
        >
          {busy ? "生成中…" : "生成封面"}
        </Button>
        {genError ? (
          <p className="mt-2 text-sm text-[var(--coral)]" role="alert">
            {genError}
          </p>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl bg-white/70">
          {busy ? (
            <div className="px-4 py-16 text-center text-sm text-[var(--ink-soft)]">
              正在生成，请稍候…
            </div>
          ) : resultUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={resultUrl}
              src={resultUrl}
              alt="生成的封面图"
              className="mx-auto max-h-[480px] w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-sm text-[var(--ink-soft)]">
              <ImageIcon className="size-8 opacity-50" />
              <p>点「生成封面」即可出图</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={post.status === "published"}
          onClick={() => setPostStatus(post.id, "drafted")}
        >
          标为已起草
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-[var(--coral)] text-white hover:bg-[var(--coral-deep)]"
          disabled={post.status === "published"}
          onClick={() => setConfirmPublish(true)}
        >
          {post.status === "published" ? "已发布" : "标为已发布（记下今天）"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmPublish}
        title="确认发布？"
        message={"标记为已发布后，这篇笔记不能再编辑。\n确定现在发布吗？"}
        confirmLabel="确认发布"
        danger
        onConfirm={() => {
          setPostStatus(post.id, "published");
          setConfirmPublish(false);
        }}
        onCancel={() => setConfirmPublish(false)}
      />
    </div>
  );
}
