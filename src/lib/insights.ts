import { PILLARS, type PillarId } from "./persona";
import type { CalendarPost } from "./year-calendar";
import type { InsightCard } from "./store";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function routePillar(text: string): PillarId {
  const scores = PILLARS.map((p) => ({
    id: p.id,
    score: p.keywords.reduce((acc, kw) => {
      if (!text.includes(kw)) return acc;
      // Prefer longer / more specific keywords (e.g. 面试 > 稳定)
      return acc + Math.max(1, Math.round(kw.length / 2));
    }, 0),
  }));
  // Soft boosts for common phrases that are easy to misroute
  if (/面试官|一面|二面|终面|自我介绍/.test(text)) {
    const hit = scores.find((s) => s.id === "interview");
    if (hit) hit.score += 3;
  }
  if (/简历|投递|海投|作品集/.test(text)) {
    const hit = scores.find((s) => s.id === "resume");
    if (hit) hit.score += 2;
  }
  if (/稳定性/.test(text) && /面试/.test(text)) {
    const age = scores.find((s) => s.id === "age-edu");
    if (age) age.score = Math.max(0, age.score - 2);
  }
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
    .replace(/^(我觉得|我感觉|其实|真的是|就是|然后就|然后|突然就)/, "")
    .replace(/一定要加油/g, "先把下一步做清楚")
    .replace(/相信自己/g, "把证据写进经历里")
    .replace(/非常非常/g, "挺")
    .replace(/真的很/g, "很")
    .replace(/已经渐渐/g, "渐渐")
    .replace(/已经是/g, "是")
    .replace(/经过了最近/g, "最近这")
    .replace(/总觉得/g, "老觉得")
    .trim();
}

function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[。！？…]$/.test(t) ? t : `${t}。`;
}

function stripPeriod(s: string): string {
  return s.replace(/[。！？…]+$/, "").trim();
}

function normalizeCmp(s: string): string {
  return s.replace(/[。！？，,\s\n]/g, "");
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 131 + input.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(list: T[], offset: number): T {
  return list[offset % list.length];
}

function compactLines(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/，+/g, "，")
    .replace(/。+/g, "。")
    .replace(/，。/g, "。")
    .trim();
}

function hookFor(pillar: PillarId, head: string, seed: number): string {
  const h = stripPeriod(head);
  const byPillar: Record<PillarId, string[]> = {
    restart: [
      `${h}。\n不是鸡汤，是我这周真实卡住的地方。`,
      `${h}。\n离职后最难的，往往不是找工作，是先把自己稳住。`,
    ],
    "age-edu": [
      `${h}。\n标签一出来，人会先紧一下。`,
      `${h}。\n双非也好，年龄也好，我听见了，但不跟它抬杠。`,
    ],
    resume: [
      `${h}。\n改简历改到烦的时候，通常不是不够努力，是方向糊了。`,
      `${h}。\n我终于意识到：写满，不等于写清。`,
    ],
    interview: [
      `${h}。\n面试最折磨的，不是问题难，是说完才知道哪句没落地。`,
      `${h}。\n现场我记的不是输赢，是哪一句没讲清。`,
    ],
    rejection: [
      `${h}。\n已读不回的瞬间，胃会先紧一下。`,
      `${h}。\n难受可以，但我不拿一次结果否定整个人。`,
    ],
    choice: [
      `${h}。\n不是没有选择，是怕选错成本太高。`,
      `${h}。\n两个选项摆一起，人反而更容易停住。`,
    ],
    life: [
      `${h}。\n求职之外，这些小事也在把我拉回地面。`,
      `${h}。\n日子还得过，人才能继续往前走。`,
    ],
  };
  return pick(byPillar[pillar], seed);
}

function closeFor(pillar: PillarId, seed: number): string {
  const byPillar: Record<PillarId, string[]> = {
    restart: [
      "我不急着证明自己重启成功。\n先把眼前这一步做清楚。",
      "今天能推进一格，就算有效。",
    ],
    "age-edu": [
      "标签可以听见。\n证据更要写清楚。",
      "我不跟标签吵架，我改成给可验证的结果。",
    ],
    resume: [
      "下一步我只改一个变量：\n要么删形容词，要么提高匹配度。",
      "少海投一点，把一句话说清楚，往往更管用。",
    ],
    interview: [
      "下次开口，我先把最硬的一句证据放前面。",
      "复盘只问三句：哪里卡、怎么改、下次第一句说什么。",
    ],
    rejection: [
      "难过计时结束，我就回去改渠道或表达。\n不改自尊。",
      "允许难受一小会儿，然后只改一件事继续。",
    ],
    choice: [
      "决定前先过一遍非情绪清单。\n冷静天再动。",
      "先把底线写下来，再谈感觉。",
    ],
    life: [
      "求职之外，我仍把日子留一点给自己。",
      "把一件小事做完，人会踏实一点。",
    ],
  };
  return pick(byPillar[pillar], seed);
}

/**
 * Rewrite scattered thoughts into Xiaohongshu-ready short prose.
 * Keep facts; change rhythm, hooks, and speakable wording.
 */
export function polishLine(raw: string, pillar: PillarId = "resume"): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;

  const clauses = splitClauses(cleaned).map(softenFiller).filter(Boolean);
  if (!clauses.length) return ensurePeriod(softenFiller(cleaned));

  const seed = hashSeed(`${pillar}:${cleaned}`);
  const dayHit = cleaned.match(/第\s*(\d+)\s*天/);
  const adaptHit = /适应|习惯|渐渐|开始变成|居然/.test(cleaned);
  const seaHit = /石沉大海|已读不回|没回音|石沉|拒信|挂了/.test(cleaned);
  const resumeHit = /简历|投递|海投|STAR|作品集|形容词/.test(cleaned);

  const head = clauses[0];
  const mid = clauses.slice(1, -1);
  const last = clauses.length > 1 ? clauses[clauses.length - 1] : "";
  const detail = mid.length
    ? mid.map((c) => stripPeriod(c)).join("，")
    : last
      ? stripPeriod(last)
      : "";

  let polished = "";

  if (dayHit && (adaptHit || seaHit || resumeHit || /面试|日常/.test(cleaned))) {
    const day = dayHit[1];
    const rest = clauses
      .filter((c) => !/第\s*\d+\s*天/.test(c))
      .map((c) =>
        c
          .replace(/渐渐适应了|已经渐渐适应了|适应了/g, "")
          .trim(),
      )
      .filter(Boolean);
    const before = rest[0] ? `前些天还在硬扛：${stripPeriod(rest[0])}。` : "";
    const now =
      rest.length > 1
        ? `这几天居然摸到一点节奏——\n${rest
            .slice(1)
            .map((c) =>
              stripPeriod(c)
                .replace(/都开始变成习惯/, "也开始变成习惯")
                .replace(/开始变成习惯/, "变成了习惯"),
            )
            .join("，")}。`
        : rest[0]
          ? `这几天居然开始把「${stripPeriod(rest[0])}」当成日常。`
          : "这几天居然开始摸到一点节奏。";
    polished = `投递第${day}天了。\n\n${before}\n${now}\n\n${closeFor(pillar, seed)}`;
  } else if (pillar === "rejection" || (seaHit && pillar !== "interview")) {
    polished = [
      hookFor("rejection", head, seed),
      "",
      detail ? `${ensurePeriod(detail)}` : "",
      last && mid.length ? ensurePeriod(last) : "",
      "",
      closeFor("rejection", seed + 1),
    ]
      .filter(Boolean)
      .join("\n");
  } else if (pillar === "interview") {
    polished = [
      hookFor("interview", head, seed),
      "",
      detail ? `现场真正卡住的是：${ensurePeriod(detail)}` : "现场我记的不是输赢，是哪一句没说清。",
      last && mid.length ? ensurePeriod(last) : "",
      "",
      closeFor("interview", seed + 1),
    ]
      .filter(Boolean)
      .join("\n");
  } else if (pillar === "age-edu") {
    polished = [
      hookFor("age-edu", head, seed),
      "",
      detail
        ? `具体一点：${ensurePeriod(detail)}`
        : "我不急着辩解学历和年龄，先把能交付的证据摆出来。",
      last && mid.length ? ensurePeriod(last) : "",
      "",
      closeFor("age-edu", seed + 1),
    ]
      .filter(Boolean)
      .join("\n");
  } else if (pillar === "resume") {
    polished = [
      hookFor("resume", head, seed),
      "",
      detail ? `这周真实发生的是：\n${ensurePeriod(detail)}` : ensurePeriod(last || head),
      last && mid.length ? ensurePeriod(last) : "",
      "",
      closeFor("resume", seed + 1),
    ]
      .filter(Boolean)
      .join("\n");
  } else if (pillar === "life") {
    polished = [
      hookFor("life", head, seed),
      "",
      detail ? `${ensurePeriod(detail)}` : "求职之外，我仍把日子过出一点形状。",
      last && mid.length ? ensurePeriod(last) : "",
      "",
      closeFor("life", seed + 1),
    ]
      .filter(Boolean)
      .join("\n");
  } else if (pillar === "choice") {
    polished = [
      hookFor("choice", head, seed),
      "",
      detail ? `我卡住的点是：${ensurePeriod(detail)}` : ensurePeriod(last || head),
      last && mid.length ? ensurePeriod(last) : "",
      "",
      closeFor("choice", seed + 1),
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    polished = [
      hookFor(pillar, head, seed),
      "",
      detail ? `${ensurePeriod(detail)}` : "",
      last && mid.length ? `后来我想明白一件事：\n${ensurePeriod(last)}` : last ? ensurePeriod(last) : "",
      "",
      closeFor(pillar, seed + 1),
    ]
      .filter(Boolean)
      .join("\n");
  }

  polished = compactLines(polished);
  if (!/[。！？]$/.test(polished)) polished += "。";

  if (normalizeCmp(polished) === normalizeCmp(cleaned)) {
    polished = [
      hookFor(pillar, head, seed + 7),
      "",
      ensurePeriod(cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned),
      "",
      closeFor(pillar, seed + 8),
    ].join("\n");
    polished = compactLines(polished);
  }

  return polished;
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
