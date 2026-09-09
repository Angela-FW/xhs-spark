"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateCopy,
  formatFullPost,
  STYLE_OPTIONS,
  TONE_OPTIONS,
  type CopyInput,
  type CopyStyle,
  type CopyTone,
  type GeneratedCopy,
} from "@/lib/xhs-copy";

const DEFAULT_INPUT: CopyInput = {
  topic: "",
  audience: "25-35岁注重生活品质的女性",
  sellingPoints: "显白提亮, 清爽不厚重, 通勤也能化, 性价比高",
  style: "planting",
  tone: "girl-next-door",
  keywords: "通勤妆, 素颜感, 学生党友好",
};

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onCopy}
      className="gap-1.5 border-[var(--ink-soft)]/20 bg-white/70"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "已复制" : label ?? "复制"}
    </Button>
  );
}

export function CopyStudio() {
  const [input, setInput] = useState<CopyInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<GeneratedCopy | null>(null);
  const [titleIndex, setTitleIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function update<K extends keyof CopyInput>(key: K, value: CopyInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function onGenerate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.topic.trim()) {
      setError("先写一个主题或产品名，文案才更贴");
      return;
    }
    setError(null);
    startTransition(() => {
      const next = generateCopy(input);
      setResult(next);
      setTitleIndex(0);
    });
  }

  function onExample() {
    setInput({
      topic: "夏日清透素颜霜",
      audience: "上班通勤、怕厚重底妆的宝子",
      sellingPoints: "伪素颜、不假白、持妆6小时、毛孔隐形、敏感肌友好",
      style: "review",
      tone: "sincere",
      keywords: "素颜霜, 夏日妆教, 敏感肌化妆, 通勤妆容",
    });
    setError(null);
  }

  return (
    <div className="relative">
      <section className="hero-panel relative overflow-hidden px-5 pb-10 pt-8 sm:px-8 sm:pb-14 sm:pt-12">
        <div className="hero-glow" aria-hidden />
        <div className="hero-grain" aria-hidden />
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-700 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <p className="brand-mark mb-4 text-4xl tracking-wide sm:text-5xl md:text-6xl">
            爆文工坊
          </p>
          <h1 className="font-display text-xl font-medium text-[var(--ink)] sm:text-2xl">
            小红书爆款文案，一键长成
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
            填主题、选风格，立刻拿到标题、正文、话题标签和封面思路——按平台语感写，不写空话。
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-4 max-w-5xl px-4 sm:-mt-6 sm:px-6">
        <form
          onSubmit={onGenerate}
          className={`studio-shell rounded-2xl p-5 sm:p-7 transition-all duration-700 delay-150 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg text-[var(--ink)]">创作面板</h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                卖点可用逗号分隔，生成后可一键复制发笔记
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={onExample}
              className="text-[var(--coral)] hover:bg-[var(--coral)]/10 hover:text-[var(--coral)]"
            >
              填入示例
            </Button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="topic">主题 / 产品</Label>
              <Input
                id="topic"
                value={input.topic}
                onChange={(e) => update("topic", e.target.value)}
                placeholder="例如：夏日清透素颜霜、周末露营穿搭、职场沟通技巧"
                className="h-11 bg-white/80"
              />
            </div>

            <div className="space-y-2">
              <Label>内容风格</Label>
              <Select
                value={input.style}
                onValueChange={(v) => update("style", v as CopyStyle)}
              >
                <SelectTrigger className="h-11 w-full bg-white/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label} · {opt.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>语气人设</Label>
              <Select
                value={input.tone}
                onValueChange={(v) => update("tone", v as CopyTone)}
              >
                <SelectTrigger className="h-11 w-full bg-white/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">目标人群</Label>
              <Input
                id="audience"
                value={input.audience}
                onChange={(e) => update("audience", e.target.value)}
                placeholder="谁会点开这篇？"
                className="h-11 bg-white/80"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">关键词（选题/搜索）</Label>
              <Input
                id="keywords"
                value={input.keywords}
                onChange={(e) => update("keywords", e.target.value)}
                placeholder="用逗号分隔，如：敏感肌, 夏日护肤"
                className="h-11 bg-white/80"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="points">核心卖点 / 体验点</Label>
              <Textarea
                id="points"
                value={input.sellingPoints}
                onChange={(e) => update("sellingPoints", e.target.value)}
                placeholder="写下 3–5 个点，逗号或换行均可"
                className="min-h-24 bg-white/80"
              />
            </div>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-[var(--coral)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 gap-2 bg-[var(--coral)] px-6 text-white hover:bg-[var(--coral-deep)]"
            >
              {isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {isPending ? "生成中…" : result ? "再生成一版" : "生成爆款文案"}
            </Button>
          </div>
        </form>

        <div className="h-8" />

        {!result ? (
          <div
            className={`empty-panel mb-16 rounded-2xl px-6 py-12 text-center transition-all duration-700 delay-300 ${
              mounted ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="font-display text-lg text-[var(--ink)]">还没有文案</p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              填好主题后点生成，标题、正文、标签会一起出来
            </p>
          </div>
        ) : (
          <div className="result-enter mb-16 space-y-5">
            <div className="studio-shell rounded-2xl p-5 sm:p-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs tracking-widest text-[var(--coral)] uppercase">
                    {result.styleLabel}
                  </p>
                  <h3 className="font-display mt-1 text-lg text-[var(--ink)]">
                    标题备选（点选后复制整篇）
                  </h3>
                </div>
                <CopyButton
                  text={formatFullPost(result, titleIndex)}
                  label="复制整篇笔记"
                />
              </div>
              <ul className="space-y-2">
                {result.titles.map((title, i) => (
                  <li key={title}>
                    <button
                      type="button"
                      onClick={() => setTitleIndex(i)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                        titleIndex === i
                          ? "border-[var(--coral)] bg-[var(--coral)]/8 text-[var(--ink)] shadow-sm"
                          : "border-transparent bg-white/55 text-[var(--ink-soft)] hover:border-[var(--ink-soft)]/15 hover:bg-white/80"
                      }`}
                    >
                      <span className="mr-2 text-xs text-[var(--coral)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="studio-shell rounded-2xl p-5 sm:p-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-display text-lg text-[var(--ink)]">正文</h3>
                <CopyButton text={result.body} />
              </div>
              <pre className="whitespace-pre-wrap rounded-xl bg-white/70 p-4 text-sm leading-7 text-[var(--ink)]">
                {result.body}
              </pre>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="studio-shell rounded-2xl p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg text-[var(--ink)]">话题标签</h3>
                  <CopyButton text={result.tags.join(" ")} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-[var(--coral)]/10 px-2.5 py-1 text-xs text-[var(--coral-deep)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="studio-shell rounded-2xl p-5 sm:p-6">
                <h3 className="font-display text-lg text-[var(--ink)]">封面思路</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--ink-soft)]">
                  {result.coverIdeas.map((idea) => (
                    <li key={idea} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--coral)]" />
                      <span>{idea}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="studio-shell rounded-2xl p-5 sm:p-6">
              <h3 className="font-display text-lg text-[var(--ink)]">发布提醒</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {result.tips.map((tip) => (
                  <li
                    key={tip}
                    className="rounded-xl bg-white/60 px-3 py-2.5 text-sm leading-6 text-[var(--ink-soft)]"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
