import { PILLARS, pillarLabel, type PillarId } from "./persona";
import type { PendingCalibration, PillarWeights } from "./store";
import { describePending } from "./calibrate";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clampWeight(n: number) {
  return Math.max(0.4, Math.min(2.2, Math.round(n * 100) / 100));
}

function detectPillars(text: string): { more: PillarId[]; less: PillarId[] } {
  const more: PillarId[] = [];
  const less: PillarId[] = [];
  const isLess = /(少|减少|别再|不要|别写|少写|别碰)/.test(text);
  const isMore = /(多|加强|多写|侧重|先写|继续|增加)/.test(text);

  for (const p of PILLARS) {
    if (p.keywords.some((k) => text.includes(k)) || text.includes(p.label)) {
      if (isLess && !isMore) less.push(p.id);
      else if (isMore) more.push(p.id);
      else if (isLess) less.push(p.id);
      else more.push(p.id);
    }
  }

  // Phrase aliases
  if (/鸡汤|空泛重启|励志/.test(text) && isLess) {
    if (!less.includes("restart")) less.push("restart");
  }
  if (/干货/.test(text) && isMore) {
    if (!more.includes("resume")) more.push("resume");
  }
  return { more, less };
}

function detectRate(text: string): number | null {
  const m = text.match(/每周\s*(\d)\s*篇/);
  if (m) return Math.max(2, Math.min(4, Number(m[1])));
  if (/加更|多发/.test(text)) return 4;
  if (/降频|少发|减更/.test(text)) return 2;
  return null;
}

export function parseDialogue(
  text: string,
  weights: PillarWeights,
  futurePostIds: { id: string; week: number; pillar: PillarId; titleHint: string; angle: string; format: "story" | "tips" | "emotion" }[],
): { ok: true; pending: PendingCalibration; reply: string } | { ok: false; reply: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      reply: "发一句具体指令试试，例如：「下周多写面试复盘」「少一点鸡汤式重启」「这两周改成每周4篇」。",
    };
  }

  const nextWeights = { ...weights };
  const summary: string[] = [];
  const { more, less } = detectPillars(trimmed);

  for (const id of more) {
    nextWeights[id] = clampWeight(nextWeights[id] + 0.18);
    summary.push(`加强「${pillarLabel(id)}」`);
  }
  for (const id of less) {
    nextWeights[id] = clampWeight(nextWeights[id] - 0.18);
    summary.push(`减少「${pillarLabel(id)}」`);
  }

  const rate = detectRate(trimmed);
  const weeksAhead = /一个月|未来一个月|四周/.test(trimmed) ? 8 : 4;
  const future = futurePostIds
    .filter((p) => p.week <= (futurePostIds[0]?.week ?? 1) + weeksAhead)
    .slice(0, 20);

  const patch: PendingCalibration["patch"] = [];
  if (more.length || less.length) {
    const prefer = more[0];
    for (const p of future) {
      if (prefer && less.includes(p.pillar)) {
        patch.push({
          postId: p.id,
          pillar: prefer,
          titleHint: `${pillarLabel(prefer)}｜对话校准改写`,
          angle: `按你的对话指令，从「${pillarLabel(p.pillar)}」调整到「${pillarLabel(prefer)}」`,
          format: /干货|清单|步骤/.test(trimmed) ? "tips" : p.format,
        });
      } else if (prefer && p.pillar === prefer) {
        patch.push({
          postId: p.id,
          angle: `${p.angle}｜对话强调：${trimmed.slice(0, 28)}`,
        });
      }
    }
  }

  if (/锋利|狠一点|更冲/.test(trimmed)) {
    for (const p of future.slice(0, 6)) {
      patch.push({
        postId: p.id,
        titleHint: p.titleHint.replace(/？$/, "？！").includes("｜")
          ? p.titleHint
          : `${p.titleHint}｜说人话版`,
        angle: `${p.angle}｜标题更直接，少铺垫`,
      });
    }
    summary.push("语气偏锋利");
  }
  if (/少情绪|更干货/.test(trimmed)) {
    for (const p of future.slice(0, 8)) {
      patch.push({
        postId: p.id,
        format: "tips",
        angle: `${p.angle}｜压情绪、抬步骤`,
      });
    }
    summary.push("更干货少情绪");
  }

  let postsPerWeekPatch: PendingCalibration["postsPerWeekPatch"];
  if (rate) {
    const weeks = Array.from(new Set(future.map((p) => p.week))).slice(0, 4);
    postsPerWeekPatch = weeks.map((week) => ({ week, postsPerWeek: rate }));
    summary.push(`近四周目标每周 ${rate} 篇`);
  }

  if (!summary.length && !patch.length && !postsPerWeekPatch) {
    return {
      ok: false,
      reply:
        "我还没听懂。可以点这些试试：\n· 下周多写面试复盘\n· 少一点鸡汤式重启叙事\n· 这两周改成每周4篇\n· 更干货、少情绪\n· 未来一个月先别碰 offer",
    };
  }

  // offer freeze
  if (/别碰\s*offer|先别.*offer|不要.*offer/.test(trimmed)) {
    nextWeights.choice = clampWeight(nextWeights.choice - 0.25);
    summary.push("压低 offer/选择 权重");
    for (const p of future.filter((x) => x.pillar === "choice")) {
      patch.push({
        postId: p.id,
        pillar: "resume",
        titleHint: "简历与焦虑｜暂缓 offer 叙事",
        angle: "按对话：近月先困在简历焦虑，不提前写 offer",
      });
    }
  }

  const pending: PendingCalibration = {
    id: uid("pending"),
    source: "dialogue",
    summary: summary.join("；"),
    weightsAfter: nextWeights,
    patch: dedupePatch(patch).slice(0, 12),
    postsPerWeekPatch,
  };

  return {
    ok: true,
    pending,
    reply: `已生成改版预览（尚未写入）：\n${describePending(pending)}\n\n请点「确认应用」后才会改未来规划。`,
  };
}

function dedupePatch(
  patch: PendingCalibration["patch"],
): PendingCalibration["patch"] {
  const map = new Map<string, PendingCalibration["patch"][number]>();
  for (const p of patch) {
    const prev = map.get(p.postId);
    map.set(p.postId, { ...prev, ...p });
  }
  return Array.from(map.values());
}
