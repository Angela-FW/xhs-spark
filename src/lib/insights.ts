import { PILLARS, type PillarId } from "./persona";
import type { CalendarPost } from "./year-calendar";
import type { InsightCard } from "./store";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function routePillar(text: string): PillarId {
  const scores = PILLARS.map((p) => ({
    id: p.id,
    score: p.keywords.reduce(
      (acc, kw) => acc + (text.includes(kw) ? 1 : 0),
      0,
    ),
  }));
  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score === 0) return "resume";
  return scores[0].id;
}

/** Split Chinese prose into clause-ish pieces. */
function splitClauses(text: string): string[] {
  return text
    .split(/[，,；;。！？\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function softenFiller(s: string): string {
  return s
    .replace(/^(我觉得|我感觉|其实|真的是|就是|然后就|然后)/, "")
    .replace(/一定要加油/g, "先把下一步做清楚")
    .replace(/相信自己/g, "把证据写进经历里")
    .replace(/非常非常/g, "挺")
    .replace(/真的很/g, "很")
    .replace(/已经渐渐/g, "渐渐")
    .replace(/已经是/g, "是")
    .replace(/经过了最近/g, "最近这")
    .trim();
}

/**
 * Real rewrite for Xiaohongshu voice: keep facts, change rhythm and wording.
 * Always returns text different from raw when raw has enough content.
 */
export function polishLine(raw: string, pillar: PillarId = "resume"): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;

  const clauses = splitClauses(cleaned).map(softenFiller).filter(Boolean);
  if (!clauses.length) return ensurePeriod(softenFiller(cleaned));

  // Pattern: day count / adaptation / routine (user's example class)
  const dayHit = cleaned.match(/第\s*(\d+)\s*天/);
  const adaptHit = /适应|习惯|渐渐/.test(cleaned);
  const seaHit = /石沉大海|已读不回|没回音|石沉/.test(cleaned);

  let polished = "";

  if (dayHit && (adaptHit || seaHit || /投简历|面试|日常/.test(cleaned))) {
    const day = dayHit[1];
    const rest = clauses
      .filter((c) => !/第\s*\d+\s*天/.test(c))
      .map((c) =>
        c
          .replace(/渐渐适应了/, "")
          .replace(/已经渐渐适应了/, "")
          .replace(/适应了/, "")
          .trim(),
      )
      .filter(Boolean);

    const scene = rest[0] ? `前些天还在硬扛：${rest[0]}。` : "";
    const now =
      rest.length > 1
        ? `这几天终于摸到一点节奏——${rest.slice(1).join("，")}，居然开始变成日常。`
        : rest[0]
          ? `这几天居然开始把「${rest[0]}」当成日常。`
          : "这几天居然开始摸到一点节奏。";

    polished = `投递第${day}天了。${scene}${now}`.replace(/。。/g, "。");
  } else if (pillar === "life") {
    const head = clauses[0];
    const tail = clauses.slice(1).join("，");
    polished = tail
      ? `${ensurePeriod(head)}说小也不小：${tail}。求职之外，这些事让人还像个活人。`
      : `${ensurePeriod(head)}求职之外，我仍把日子过出一点形状。`;
  } else if (pillar === "rejection" || seaHit) {
    const head = clauses[0];
    const mid = clauses.slice(1, -1).join("，");
    const end = clauses[clauses.length - 1];
    polished = mid
      ? `${ensurePeriod(head)}${mid}。我允许自己难受一小会儿，然后只改一个变量继续。`
      : `${ensurePeriod(head)}难受可以，但我不拿一次结果否定整个人。下一步只改一件事：${end}。`;
  } else if (pillar === "interview") {
    polished = `${ensurePeriod(clauses[0])}现场我记的不是输赢，是哪一句没说清。复盘就三步：哪里卡、怎么改、下次开口第一句是什么。${
      clauses.length > 1 ? clauses.slice(1).join("，") + "。" : ""
    }`;
  } else if (pillar === "age-edu") {
    polished = `${ensurePeriod(clauses[0])}标签我会听见，但不跟它吵架。我改成给证据：能验证的经历、能交付的结果。${
      clauses.length > 1 ? "具体是：" + clauses.slice(1).join("，") + "。" : ""
    }`;
  } else {
    // Generic job/restart rewrite: hook + concrete + soft close
    const hook = clauses[0];
    const body = clauses.slice(1, -1);
    const last = clauses.length > 1 ? clauses[clauses.length - 1] : "";
    const bodyText = body.length ? body.join("，") + "。" : "";
    polished = `${ensurePeriod(hook)}${bodyText}${
      last
        ? `落到动作上：${last.replace(/^(我|就)/, "")}。`
        : "我不急着证明自己，先把下一步做清楚。"
    }`;
  }

  polished = polished
    .replace(/\s+/g, "")
    .replace(/，+/g, "，")
    .replace(/。+/g, "。")
    .replace(/，。/g, "。")
    .replace(/^，/, "");

  if (!/[。！？]$/.test(polished)) polished += "。";

  // Guarantee visible difference from raw
  if (normalizeCmp(polished) === normalizeCmp(cleaned)) {
    polished = rewriteFallback(cleaned, pillar);
  }

  return polished;
}

function normalizeCmp(s: string): string {
  return s.replace(/[。！？，,\s]/g, "");
}

function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[。！？]$/.test(t) ? t : `${t}。`;
}

function rewriteFallback(raw: string, pillar: PillarId): string {
  const short = raw.length > 42 ? `${raw.slice(0, 42)}…` : raw;
  const closers: Record<PillarId, string> = {
    restart: "我不写成鸡汤，只保留这一周真实发生的动作。",
    "age-edu": "标签可以听见，证据更要写清楚。",
    resume: "下一步我只改简历/投递里的一个变量。",
    interview: "下次开口，我先把最硬的一句证据放前面。",
    rejection: "难过计时结束，我就回去改渠道或表达，不改自尊。",
    choice: "决定前我先把非情绪清单过一遍。",
    life: "求职之外，我仍把日子留一点给自己。",
  };
  return `记一笔：${ensurePeriod(short)}${closers[pillar]}`;
}

function needsDesensitize(text: string): string | undefined {
  if (/(公司名|老板姓|同事名字|具体薪资\d{4,})/.test(text)) {
    return "可能含可识别信息，发布前请脱敏（公司/人名/精确薪资）。";
  }
  if (/[A-Za-z]{2,}科技|[一-龥]{2,4}(有限公司|集团)/.test(text)) {
    return "疑似含公司名，建议改成行业+规模描述。";
  }
  return undefined;
}

export function processInsights(rawBlob: string): InsightCard[] {
  const chunks = rawBlob
    .split(/\n{2,}|\n(?=[-•·]|\d+[.、])/u)
    .map((s) => s.replace(/^[-•·\d.、\s]+/, "").trim())
    .filter((s) => s.length >= 8);

  // Prefer whole paragraphs; if user pasted one block, keep as one insight
  const source =
    chunks.length > 1
      ? chunks
      : [rawBlob.trim()].filter((s) => s.length >= 8);

  const unique: string[] = [];
  for (const c of source) {
    if (!unique.some((u) => u.slice(0, 24) === c.slice(0, 24))) unique.push(c);
  }

  return unique.slice(0, 12).map((raw) => {
    const pillar = routePillar(raw);
    const polished = polishLine(raw, pillar);
    return {
      id: uid("ins"),
      raw,
      summary: raw.length > 36 ? `${raw.slice(0, 36)}…` : raw,
      polished,
      pillar,
      createdAt: new Date().toISOString(),
      assignedPostIds: [],
      desensitizeNote: needsDesensitize(raw),
    };
  });
}

export function recommendPostsForInsight(
  insight: InsightCard,
  posts: CalendarPost[],
  fromWeek = 1,
): { post: CalendarPost; reason: string }[] {
  const keywords = collectKeywords(`${insight.raw} ${insight.polished}`);
  const candidates = posts
    .filter((p) => p.status === "planned" && p.week >= fromWeek)
    .filter((p) => p.week <= fromWeek + 5 || p.pillar === insight.pillar);

  const scored = candidates
    .map((post) => {
      let score = 0;
      const reasons: string[] = [];
      const weekGap = post.week - fromWeek;
      const overlap = keywordOverlap(
        keywords,
        collectKeywords(`${post.titleHint} ${post.angle} ${post.hooks.join(" ")}`),
      );

      if (post.pillar === insight.pillar) {
        score += 4;
        reasons.push("支柱一致");
      }

      if (weekGap <= 1) {
        score += 4;
        reasons.push("提交时间很近");
      } else if (weekGap <= 3) {
        score += 2.5;
        reasons.push("近几周可发");
      } else if (weekGap <= 5) {
        score += 1;
        reasons.push("可提前备稿");
      } else {
        score -= 3;
        reasons.push("离当前太远");
      }

      if (overlap > 0) {
        score += Math.min(4, overlap * 1.4);
        reasons.push(`内容匹配 ${overlap} 处`);
      }

      if (post.materials.length === 0) {
        score += 0.6;
        reasons.push("尚无素材");
      }

      return { post, score, reason: reasons.join(" · ") || "可挂载" };
    })
    .sort((a, b) => b.score - a.score || a.post.week - b.post.week);

  return scored.slice(0, 3).map(({ post, reason }) => ({ post, reason }));
}

function collectKeywords(text: string): string[] {
  const hits = new Set<string>();
  for (const pillar of PILLARS) {
    for (const keyword of pillar.keywords) {
      if (keyword.length >= 2 && text.includes(keyword)) hits.add(keyword);
    }
  }
  for (const token of text.split(/[，,。；;：:\s、|]+/)) {
    const cleaned = token.trim();
    if (cleaned.length >= 2 && cleaned.length <= 8) hits.add(cleaned);
  }
  return Array.from(hits);
}

function keywordOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  let count = 0;
  for (const key of a) {
    if (setB.has(key)) count += 1;
  }
  return count;
}
